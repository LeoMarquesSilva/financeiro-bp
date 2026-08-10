-- Lista SharePoint "SOLICITAÇÃO DE AGENDAMENTOS E REAGENDAMENTOS"
-- (BI: tabela Agendamento, list id d586975b-…).
-- Flip cards TAREFAS:
--   TotalAtividades = Qtd_IDs (pubs) + Qtd_Agendamentos_Atual (Agendamento via AGENDADO POR)
--   Visual filtra Tipo de Agendamento - Abertura/Encerramento = blank

CREATE TABLE IF NOT EXISTS public.sp_agendamento (
  sp_id                      BIGINT PRIMARY KEY,
  solicitado_em              DATE,
  criado                     TIMESTAMPTZ,
  agendado_por               TEXT,
  tipo_abertura_encerramento TEXT,
  tipo_agendamento           TEXT,
  adesao_indicador           TEXT,
  inconsistencia_juridico    TEXT,
  status                     TEXT,
  area_equipe                TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sp_agendamento_solicitado_em_idx
  ON public.sp_agendamento (solicitado_em);
CREATE INDEX IF NOT EXISTS sp_agendamento_agendado_por_idx
  ON public.sp_agendamento (agendado_por);
CREATE INDEX IF NOT EXISTS sp_agendamento_abertura_idx
  ON public.sp_agendamento (tipo_abertura_encerramento);

COMMENT ON TABLE public.sp_agendamento IS
  'Espelho da lista SharePoint SOLICITAÇÃO DE AGENDAMENTOS E REAGENDAMENTOS (CONTROLADORIAJURDICA, d586975b). Entidade Agendamento do BI Ops Legais.';
COMMENT ON COLUMN public.sp_agendamento.solicitado_em IS
  'DATAATUAL renomeada para SOLICITADO EM no Power Query do BI.';
COMMENT ON COLUMN public.sp_agendamento.tipo_abertura_encerramento IS
  'Tipo de Agendamento - Abertura/Encerramento. Visual TAREFAS filtra blank.';

DROP TRIGGER IF EXISTS sp_agendamento_updated_at ON public.sp_agendamento;
CREATE TRIGGER sp_agendamento_updated_at
  BEFORE UPDATE ON public.sp_agendamento
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.sp_agendamento ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sp_agendamento' AND policyname = 'Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON public.sp_agendamento
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sp_agendamento' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON public.sp_agendamento
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

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
    -- Qtd_IDs / Central Pub = COUNTROWS(BASE-PUBLICAÇÕES)
    SELECT
      lower(trim(agendado_por)) AS pessoa_key,
      MAX(trim(agendado_por)) AS pessoa,
      COUNT(*)::integer AS central_pub,
      COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(inconsistencia_subtipo, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(inconsistencias_tipo, '')), '') IS NOT NULL
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
    -- Qtd_Agendamentos_Atual / QtdAgendaTotal sob filtro Abertura/Encerramento blank
    SELECT
      lower(trim(agendado_por)) AS pessoa_key,
      MAX(trim(agendado_por)) AS pessoa,
      COUNT(*)::integer AS central_agend,
      -- Proxy QtdEficienciaErro: Adesão ao Indicador preenchida (erros de adesão).
      -- Confirmar com DAX oficial se divergir do BI.
      COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(adesao_indicador, '')), '') IS NOT NULL
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
  'BI TAREFAS: TotalAtividades = pubs + Agendamento (lista SharePoint) com Abertura/Encerramento blank; base SUMMARIZE AGENDADO POR.';
