-- Ranking Tarefas Ops Legais: restringe às pessoas da área Operações Legais
-- (espelho do slicer/relação USUÁRIOS[Área] do BI), em vez do escritório inteiro.
-- Também exclui AGENDADO POR / usuário com "Ex" (filtro de página do PBIX TAREFAS).

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
    -- BI: USUÁRIOS (Usuários x Área) + fallback cadastro atual (colaboradores/team_members)
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
      NULLIF(TRIM(agendado_por), '') AS pessoa,
      COUNT(*)::integer AS central_pub,
      COUNT(*) FILTER (
        WHERE COALESCE(eficiencia, '') = 'DESVIO'
          OR NULLIF(TRIM(COALESCE(inconsistencias_tipo, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(inconsistencia_subtipo, '')), '') IS NOT NULL
      )::integer AS desvio_pub
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND data_recebimento_kurier >= p_inicio
      AND data_recebimento_kurier < p_fim
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND agendado_por NOT ILIKE '%Ex%'
      AND lower(trim(agendado_por)) IN (SELECT pessoa_key FROM ops_pessoas)
      -- BI: TIPO DO AGENDAMENTO "não é" CIÊNCIA NF / ABERT. DE PASTA / DUPLICIDADE / RENÚNCIA*
      AND NOT (
        COALESCE(tipo_agendamento, '') ILIKE '%CIÊNCIA NF%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%CIENCIA NF%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%ABERT. DE PASTA%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%ABERT DE PASTA%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%DUPLICIDADE%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%RENÚNCIA%'
        OR COALESCE(tipo_agendamento, '') ILIKE '%RENUNCIA%'
      )
    GROUP BY 1
  ),
  agenda AS (
    SELECT
      NULLIF(TRIM(usuario_conclusao), '') AS pessoa,
      COUNT(*)::integer AS central_agend,
      COUNT(*) FILTER (
        WHERE lower(COALESCE(fatal_sem18_d1, '')) LIKE '%fora%'
      )::integer AS desvio_agend
    FROM sp_tarefas
    WHERE data_conclusao IS NOT NULL
      AND data_conclusao >= p_inicio
      AND data_conclusao < p_fim
      AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
      AND NULLIF(TRIM(usuario_conclusao), '') IS NOT NULL
      AND usuario_conclusao NOT ILIKE '%Ex%'
      AND lower(trim(usuario_conclusao)) IN (SELECT pessoa_key FROM ops_pessoas)
    GROUP BY 1
  ),
  base AS (
    SELECT
      COALESCE(p.pessoa, a.pessoa) AS pessoa,
      COALESCE(p.central_pub, 0) AS central_pub,
      COALESCE(a.central_agend, 0) AS central_agend,
      COALESCE(p.desvio_pub, 0) AS desvio_pub,
      COALESCE(a.desvio_agend, 0) AS desvio_agend
    FROM pub p
    FULL OUTER JOIN agenda a ON p.pessoa = a.pessoa
  ),
  calc AS (
    SELECT
      pessoa,
      central_pub,
      central_agend,
      desvio_pub,
      desvio_agend,
      (central_pub + central_agend)::integer AS total_atividades,
      (desvio_pub + desvio_agend)::integer AS total_erros,
      ROUND(
        COALESCE(
          (desvio_pub + desvio_agend)::numeric
            / NULLIF(central_pub + central_agend, 0) * 100,
          0
        ),
        2
      ) AS pct_erros
    FROM base
    WHERE central_pub + central_agend > 0
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
    DENSE_RANK() OVER (ORDER BY c.pct_erros ASC)::integer AS rank_excelencia
  FROM calc c
  ORDER BY c.total_atividades DESC, c.pessoa;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_tarefas_ranking(date, date) IS
  'BI Ops Legais / TAREFAS: ranking flip cards só com pessoas da área Operações Legais (USUÁRIOS).';
