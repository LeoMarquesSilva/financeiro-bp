-- Ranking flip cards (TAREFAS): alinha Central Agend. / Desvio Agend. à tabela BI
-- "Agendamento" (proxy: tarefas de cadastro/abertura/encerramento), não à
-- "1. CIÊNCIA DOS AGENDAMENTOS".
-- Tipo de pub: espelha Not In do visual (CIÊNCIA NF*, DUPLICIDADE, RENÚNCIA*),
-- sem excluir ABERT. DE PASTA sozinha.
-- Agrupa por lower(trim(pessoa)) para não fatiar a mesma pessoa por casing.

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
      -- Visual TAREFAS: TIPO DO AGENDAMENTO Not In
      -- CIÊNCIA NF | CIÊNCIA NF, ABERT. DE PASTA | DUPLICIDADE | RENÚNCIA*
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
    -- Proxy da entidade BI Agendamento (QtdAgendaTotal / QtdEficienciaErro).
    -- Mesmas tarefas do cadastro Ops Legais; visual exclui tipo "Abertura de Pasta"
    -- no campo Abertura/Encerramento (não mapeado 1:1 no SIOE).
    SELECT
      lower(trim(usuario_conclusao)) AS pessoa_key,
      MAX(trim(usuario_conclusao)) AS pessoa,
      COUNT(*)::integer AS central_agend,
      COUNT(*) FILTER (
        WHERE fatal_sem18_d1 ILIKE 'fora do prazo'
      )::integer AS desvio_agend
    FROM sp_tarefas
    WHERE data_conclusao IS NOT NULL
      AND data_conclusao >= p_inicio
      AND data_conclusao < p_fim
      AND tarefa IN (
        'CADASTRO DE PASTA',
        'CADASTRO DE CLIENTE',
        'ATUALIZAÇÃO DE CADASTRO',
        'CIÊNCIA DA ABERTURA DE PASTA',
        'VERIFICAR ENCERRAMENTO DA PASTA'
      )
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
    FULL OUTER JOIN agenda a ON p.pessoa_key = a.pessoa_key
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
  'BI Ops Legais / TAREFAS flip cards: Central Pub (sp_publicacoes) + Central Agend (tarefas cadastro/Agendamento). Pessoas da área Operações Legais.';
