-- Flip cards TAREFAS alinhados ao visual BI KPI_HTML_RANKING_FLIPCARDS_SUTIL:
-- 1) Base = SUMMARIZE(BASE-PUBLICAÇÕES, AGENDADO POR) — só quem tem publicação
-- 2) Central Pub = COUNTROWS pubs (TIPO Not In CIÊNCIA NF / DUPLICIDADE / RENÚNCIA)
-- 3) Central Agend / Desvio Agend = tabela Agendamento com
--    Tipo de Agendamento - Abertura/Encerramento = blank
--    → proxy: cadastro pasta/cliente/atualização (sem abertura/encerramento)
-- 4) Desvio Pub = inconsistências na pub (tipo ou subtipo)
-- 5) Total Atividades = Central Pub + Central Agend
-- 6) Total Erros / % = (Desvio Pub + Desvio Agend) / Total Atividades

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
      -- BI: TIPO DO AGENDAMENTO Not In (CIÊNCIA NF, DUPLICIDADE, RENÚNCIA)
      -- Campo no SIOE pode vir como JSON array (ex.: ["RENÚNCIA"]).
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
    -- BI Agendamento com filtro Abertura/Encerramento = blank.
    -- Proxy: cadastros “puros”, sem CIÊNCIA DA ABERTURA / VERIFICAR ENCERRAMENTO.
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
        'ATUALIZAÇÃO DE CADASTRO'
      )
      AND NULLIF(TRIM(usuario_conclusao), '') IS NOT NULL
      AND usuario_conclusao NOT ILIKE '%Ex%'
      AND lower(trim(usuario_conclusao)) IN (SELECT pessoa_key FROM ops_pessoas)
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
  'BI TAREFAS flip cards: base AGENDADO POR (pubs); Central Agend = cadastro sem abertura/encerramento; Total = pub+agenda.';
