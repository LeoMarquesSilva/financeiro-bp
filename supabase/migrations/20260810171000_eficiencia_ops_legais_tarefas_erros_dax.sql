-- Flip cards TAREFAS — erros alinhados ao DAX do BI:
--   Qtd_InconsistenciaPUB = SEARCH("AGENDAMENTO", INCONSISTÊNCIAS - TIPO) > 0
--   QtdEficienciaErro     = Agendamento[DePara] = "Inconsistência"
--     (DePara calculado no BI ≈ inconsistência jurídica preenchida)
--   Total_Erros           = Qtd_InconsistenciaPUB + QtdEficienciaErro

ALTER TABLE public.sp_agendamento
  ADD COLUMN IF NOT EXISTS de_para text;

COMMENT ON COLUMN public.sp_agendamento.de_para IS
  'Coluna calculada do BI Agendamento[DePara]: Inconsistência se inconsistencia_juridico preenchida; senão Eficiência.';

UPDATE public.sp_agendamento
SET de_para = CASE
  WHEN NULLIF(TRIM(COALESCE(inconsistencia_juridico, '')), '') IS NOT NULL THEN 'Inconsistência'
  ELSE 'Eficiência'
END
WHERE de_para IS NULL
   OR de_para <> CASE
        WHEN NULLIF(TRIM(COALESCE(inconsistencia_juridico, '')), '') IS NOT NULL THEN 'Inconsistência'
        ELSE 'Eficiência'
      END;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_tarefas_ranking(
  p_inicio date,
  p_fim date
)
RETURNS TABLE (
  pessoa text,
  total_atividades integer,
  central_pub integer,
  central_agend integer,
  desvio_pub integer,
  desvio_agend integer,
  total_erros integer,
  pct_erros numeric,
  rank_atividades integer,
  rank_excelencia integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ops_pessoas AS (
    SELECT DISTINCT lower(trim(nome)) AS pessoa_key
    FROM sp_usuarios_area
    WHERE area = 'Operações Legais'
      AND position(';' IN nome) = 0
      AND NULLIF(trim(nome), '') IS NOT NULL
    UNION
    SELECT DISTINCT lower(trim(full_name))
    FROM colaboradores
    WHERE area = 'Operações Legais'
      AND NULLIF(trim(full_name), '') IS NOT NULL
    UNION
    SELECT DISTINCT lower(trim(full_name))
    FROM team_members
    WHERE area = 'Operações Legais'
      AND NULLIF(trim(full_name), '') IS NOT NULL
  ),
  pub AS (
    SELECT
      lower(trim(agendado_por)) AS pessoa_key,
      MAX(trim(agendado_por)) AS pessoa,
      COUNT(*)::integer AS central_pub,
      -- Qtd_InconsistenciaPUB
      COUNT(*) FILTER (
        WHERE inconsistencias_tipo ILIKE '%AGENDAMENTO%'
      )::integer AS desvio_pub
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND data_recebimento_kurier >= p_inicio
      AND data_recebimento_kurier < p_fim
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND agendado_por NOT ILIKE '%Ex%'
      AND lower(trim(agendado_por)) IN (SELECT pessoa_key FROM ops_pessoas)
      AND NOT (
        COALESCE(tipo_agendamento, '') ILIKE '%CIÊNCIA NF%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%CIENCIA NF%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%DUPLICIDADE%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%RENÚNCIA%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%RENUNCIA%'
      )
    GROUP BY 1
  ),
  agenda AS (
    SELECT
      lower(trim(agendado_por)) AS pessoa_key,
      MAX(trim(agendado_por)) AS pessoa,
      COUNT(*)::integer AS central_agend,
      -- QtdEficienciaErro: DePara = Inconsistência
      COUNT(*) FILTER (
        WHERE COALESCE(de_para, CASE
          WHEN NULLIF(TRIM(COALESCE(inconsistencia_juridico, '')), '') IS NOT NULL
            THEN 'Inconsistência'
          ELSE 'Eficiência'
        END) = 'Inconsistência'
      )::integer AS desvio_agend
    FROM sp_agendamento
    WHERE solicitado_em IS NOT NULL
      AND solicitado_em >= p_inicio
      AND solicitado_em < p_fim
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND agendado_por NOT ILIKE '%Ex%'
      AND NULLIF(TRIM(COALESCE(tipo_abertura_encerramento, '')), '') IS NULL
    GROUP BY 1
  ),
  calc AS (
    SELECT
      p.pessoa,
      p.central_pub,
      COALESCE(a.central_agend, 0) AS central_agend,
      p.desvio_pub,
      COALESCE(a.desvio_agend, 0) AS desvio_agend,
      (p.central_pub + COALESCE(a.central_agend, 0))::integer AS total_atividades,
      -- Total_Erros
      (p.desvio_pub + COALESCE(a.desvio_agend, 0))::integer AS total_erros,
      ROUND(
        COALESCE(
          (p.desvio_pub + COALESCE(a.desvio_agend, 0))::numeric
            / NULLIF(p.central_pub + COALESCE(a.central_agend, 0), 0) * 100,
          0
        ),
        2
      ) AS pct_erros
    FROM pub p
    LEFT JOIN agenda a ON a.pessoa_key = p.pessoa_key
    WHERE p.central_pub > 0
  )
  SELECT
    c.pessoa,
    c.total_atividades,
    c.central_pub,
    c.central_agend,
    c.desvio_pub,
    c.desvio_agend,
    c.total_erros,
    c.pct_erros,
    DENSE_RANK() OVER (ORDER BY c.total_atividades DESC, c.pessoa)::integer AS rank_atividades,
    DENSE_RANK() OVER (ORDER BY c.pct_erros ASC, c.pessoa)::integer AS rank_excelencia
  FROM calc c
  ORDER BY c.total_atividades DESC, c.pessoa;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_tarefas_ranking(date, date) IS
  'BI TAREFAS flip cards: Total=pubs+Agendamento; Desvio Pub=INCONSIST tipo AGENDAMENTO; Desvio Agend=DePara Inconsistência.';
