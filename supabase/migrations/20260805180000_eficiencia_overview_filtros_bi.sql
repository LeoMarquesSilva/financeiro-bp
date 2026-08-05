-- Alinha RPCs do Overview com filtros nativos dos visuais KPI_HTML_*_MENSAL do PBIX
-- "DASHBOARD - EFICIÊNCIA OPERACIONAL - GERAL" (auditoria ago/2026).

-- ============================================================
-- SLA Protocolo (Nova / sp_tarefas_historico)
-- BI: Status=Concluída, Etiqueta=PROTOCOLO, Excludente≠Excludente,
--     Área NOT IN (Operações Legais, Tributário) — Distressd Deals permanece.
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_ranking_fatal(integer, integer);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  qtd_d1 integer,
  qtd_fatal integer,
  qtd_total integer,
  pct_eficiencia numeric,
  meta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM conclusao_completa)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'D-1') AS qtd_d1,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'FATAL') AS qtd_fatal,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 IN ('D-1', 'FATAL')) AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'D-1')::numeric
          / NULLIF(COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 IN ('D-1', 'FATAL')), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia,
    MAX(meta_d1) AS meta
  FROM sp_tarefas_historico
  WHERE EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
    AND (p_area IS NULL OR area_conclusao = p_area)
    AND status = 'Concluída'
    AND etiqueta_tarefa = 'PROTOCOLO'
    AND (excludente IS DISTINCT FROM 'Excludente')
    AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
    AND (
      tarefa IS NULL
      OR tarefa NOT IN (
        'MATERIAL MARKETING - REELS/POST/ARTIGO',
        'PROTOCOLO DUE DILIGENCE PROSPECT',
        'PROTOCOLO DUE DILLIGENCE PROSPECT'
      )
    )
    AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_fatal integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao AS usuario
    FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL'
      AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = p_mes)
      AND usuario_conclusao IS NOT NULL
      AND status = 'Concluída'
      AND etiqueta_tarefa = 'PROTOCOLO'
      AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
      AND (
        tarefa IS NULL
        OR tarefa NOT IN (
          'MATERIAL MARKETING - REELS/POST/ARTIGO',
          'PROTOCOLO DUE DILIGENCE PROSPECT',
          'PROTOCOLO DUE DILLIGENCE PROSPECT'
        )
      )
      AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_fatal,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_fatal DESC;
$$;

-- ============================================================
-- Eficiência Protocolo — BI: Área NOT IN (Tributário, Operações Legais); NULL permitido.
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_ranking_inconsistencia(integer, integer);

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  total integer,
  sem_inconsistencia integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_criada)::integer AS mes,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA') AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND (p_area IS NULL OR area = p_area)
    AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_inconsistencia integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT criado_por AS usuario
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = p_mes)
      AND criado_por IS NOT NULL
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

-- ============================================================
-- SLA Vistagem — filtros nativos distintos para risco vs comum (Overview).
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_sla_vistagem_mensal(integer, boolean, text);
DROP FUNCTION IF EXISTS public.eficiencia_sla_vistagem_por_usuario(integer, integer, boolean);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  total integer,
  vistado_d1 integer,
  pct_d1 numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM disponibilizado_vistagem)::integer AS mes,
    COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
    COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL), 0) * 100,
        0
      ), 2
    ) AS pct_d1
  FROM sp_publicacoes
  WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
    AND vistado_por IS NOT NULL
    AND (p_area IS NULL OR area = p_area)
    AND (
      p_risco IS NULL
      OR (
        p_risco = TRUE
        AND demanda_risco IS DISTINCT FROM 'Não'
        AND (p_area IS NOT NULL OR area IS NULL OR area <> 'Operações Legais')
      )
      OR (
        p_risco = FALSE
        AND UPPER(TRIM(COALESCE(demanda_risco, ''))) IN ('NÃO', 'NAO')
        AND (
          p_area IS NOT NULL
          OR area IS NULL
          OR area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
        )
      )
    )
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_por_usuario(
  p_ano integer,
  p_mes integer DEFAULT NULL,
  p_risco boolean DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  total integer,
  vistado_d1 integer,
  pct_d1 numeric,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT vistado_por, vistado_d1
    FROM sp_publicacoes
    WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = p_mes)
      AND vistado_por IS NOT NULL
      AND (
        p_risco IS NULL
        OR (
          p_risco = TRUE
          AND demanda_risco IS DISTINCT FROM 'Não'
        )
        OR (
          p_risco = FALSE
          AND UPPER(TRIM(COALESCE(demanda_risco, ''))) IN ('NÃO', 'NAO')
        )
      )
  ),
  por_usuario AS (
    SELECT
      vistado_por AS usuario,
      COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
      COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1
    FROM base
    GROUP BY 1
  ),
  total_geral AS (
    SELECT COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric AS v FROM base
  )
  SELECT
    usuario,
    total,
    vistado_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF(total, 0) * 100, 0), 2) AS pct_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF((SELECT v FROM total_geral), 0) * 100, 0), 2) AS pct_do_total
  FROM por_usuario
  ORDER BY total DESC;
$$;

-- ============================================================
-- Turnover / Retenção — exclui Distressd Deals e Tributário na base (Overview).
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_turnover_anual(integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_turnover_anual(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  funcionarios_ativos integer,
  saidas_voluntarias integer,
  pct_retencao numeric,
  meta_pct_retencao_minima numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM sp_turnover
    WHERE (p_area IS NULL OR area = p_area)
      AND (
        p_area IS NOT NULL
        OR area IS NULL
        OR area NOT IN ('Distressd Deals', 'Tributário')
      )
  ),
  ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM base
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
  ),
  saidas AS (
    SELECT COUNT(*)::integer AS n
    FROM base
    WHERE tipo_desligamento = 'Voluntário'
      AND EXTRACT(YEAR FROM desligamento)::integer = p_ano
  )
  SELECT
    ativos.n,
    saidas.n,
    ROUND(100 - COALESCE(saidas.n::numeric / NULLIF(ativos.n, 0) * 100, 0), 2) AS pct_retencao,
    90.0 AS meta_pct_retencao_minima
  FROM ativos, saidas;
$$;

-- ============================================================
-- Treinamentos — exclui Tributário e cargos de liderança; meta mensal prorrateada (14h/12).
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_anual(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_mensal(integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_anual(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  minutos_lancados numeric,
  pessoas_ativas integer,
  meta_minutos numeric,
  pct_atingimento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover tv
    WHERE EXTRACT(YEAR FROM tv.admissao)::integer <= p_ano
      AND (tv.desligamento IS NULL OR EXTRACT(YEAR FROM tv.desligamento)::integer > p_ano)
      AND (p_area IS NULL OR tv.area = p_area)
      AND (p_area IS NOT NULL OR tv.area IS NULL OR tv.area <> 'Tributário')
      AND (
        tv.cargo IS NULL
        OR tv.cargo NOT IN (
          'Coordenador Ops. Legais',
          'Gerente',
          'Sócio de Área',
          'Supervisor Ops. Legais'
        )
      )
  ),
  minutos AS (
    SELECT COALESCE(SUM(t.duracao_minutos), 0) AS v
    FROM sp_treinamentos_presenca t
    INNER JOIN sp_turnover tv ON UPPER(TRIM(tv.nome)) = UPPER(TRIM(t.colaborador))
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND (p_area IS NULL OR tv.area = p_area)
      AND (p_area IS NOT NULL OR tv.area IS NULL OR tv.area <> 'Tributário')
      AND (
        tv.cargo IS NULL
        OR tv.cargo NOT IN (
          'Coordenador Ops. Legais',
          'Gerente',
          'Sócio de Área',
          'Supervisor Ops. Legais'
        )
      )
  )
  SELECT
    minutos.v,
    ativos.n,
    (ativos.n * 14 * 60)::numeric AS meta_minutos,
    ROUND(COALESCE(minutos.v / NULLIF(ativos.n * 14 * 60, 0) * 100, 0), 2) AS pct_atingimento
  FROM minutos, ativos;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_treinamentos_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  minutos_lancados numeric,
  meta_minutos numeric,
  pct_atingimento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover tv
    WHERE EXTRACT(YEAR FROM tv.admissao)::integer <= p_ano
      AND (tv.desligamento IS NULL OR EXTRACT(YEAR FROM tv.desligamento)::integer > p_ano)
      AND (p_area IS NULL OR tv.area = p_area)
      AND (p_area IS NOT NULL OR tv.area IS NULL OR tv.area <> 'Tributário')
      AND (
        tv.cargo IS NULL
        OR tv.cargo NOT IN (
          'Coordenador Ops. Legais',
          'Gerente',
          'Sócio de Área',
          'Supervisor Ops. Legais'
        )
      )
  ),
  meta_mes AS (
    SELECT (ativos.n * 14 * 60 / 12.0)::numeric AS minutos FROM ativos
  ),
  por_mes AS (
    SELECT
      EXTRACT(MONTH FROM t.data)::integer AS mes,
      COALESCE(SUM(t.duracao_minutos), 0) AS minutos_lancados
    FROM sp_treinamentos_presenca t
    INNER JOIN sp_turnover tv ON UPPER(TRIM(tv.nome)) = UPPER(TRIM(t.colaborador))
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND (p_area IS NULL OR tv.area = p_area)
      AND (p_area IS NOT NULL OR tv.area IS NULL OR tv.area <> 'Tributário')
      AND (
        tv.cargo IS NULL
        OR tv.cargo NOT IN (
          'Coordenador Ops. Legais',
          'Gerente',
          'Sócio de Área',
          'Supervisor Ops. Legais'
        )
      )
    GROUP BY 1
  )
  SELECT
    por_mes.mes,
    por_mes.minutos_lancados,
    meta_mes.minutos AS meta_minutos,
    ROUND(COALESCE(por_mes.minutos_lancados / NULLIF(meta_mes.minutos, 0) * 100, 0), 2) AS pct_atingimento
  FROM por_mes, meta_mes
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) IS
  'SLA Protocolo mensal (Overview KPI_HTML_SLAPROT_MENSAL): excludente≠Excludente, exclui Ops Legais/Tributário.';
COMMENT ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) IS
  'Eficiência Protocolo mensal (Overview KPI_HTML_EFICIENCIA_PROTOCOLO_MENSAL): exclui Ops Legais/Tributário.';
COMMENT ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) IS
  'SLA Vistagem mensal com filtros nativos distintos para demanda de risco vs comum.';
COMMENT ON FUNCTION public.eficiencia_turnover_anual(integer, text) IS
  'Retenção anual (Overview): exclui Distressd Deals e Tributário da população base.';
COMMENT ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) IS
  'Desenvolvimento Equipe mensal: exclui Tributário e cargos de liderança; meta = 14h/12 por mês.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_por_usuario(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_turnover_anual(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_anual(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) TO anon, authenticated;
