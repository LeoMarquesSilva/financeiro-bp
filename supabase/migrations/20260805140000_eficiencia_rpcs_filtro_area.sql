-- Adiciona filtro por área (p_area) às RPCs de eficiência que ainda não tinham
-- (eficiencia_sla_vistagem_mensal já tinha desde a criação).
-- Assinatura muda (novo parâmetro) -> precisa DROP antes de recriar.

DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_mensal(integer);
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_mensal(integer);
DROP FUNCTION IF EXISTS public.eficiencia_agendamento_mensal(integer);
DROP FUNCTION IF EXISTS public.eficiencia_turnover_anual(integer);
DROP FUNCTION IF EXISTS public.eficiencia_treinamentos_anual(integer);

-- ============================================================
-- SLA de Protocolo (sp_tarefas_historico) com área
-- ============================================================
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
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- Eficiência de Protocolo (sp_protocolos) com área
-- ============================================================
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
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- Agendamento / Ciência D+1 (sp_tarefas) com área
-- ============================================================
CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  dentro_prazo integer,
  fora_prazo integer,
  pct_dentro_prazo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_conclusao)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo') AS dentro_prazo,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo') AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'),
              0
            ) * 100,
        0
      ), 2
    ) AS pct_dentro_prazo
  FROM sp_tarefas
  WHERE EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
    AND (p_area IS NULL OR area_conclusao = p_area)
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- Turnover anual (sp_turnover) com área
-- ============================================================
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
  WITH ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
      AND (p_area IS NULL OR area = p_area)
  ),
  saidas AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover
    WHERE tipo_desligamento = 'Voluntário'
      AND EXTRACT(YEAR FROM desligamento)::integer = p_ano
      AND (p_area IS NULL OR area = p_area)
  )
  -- Meta do BI (cartão Overview "Retenção de Talentos"): 90% de retenção mínima.
  SELECT
    ativos.n,
    saidas.n,
    ROUND(100 - COALESCE(saidas.n::numeric / NULLIF(ativos.n, 0) * 100, 0), 2) AS pct_retencao,
    90.0 AS meta_pct_retencao_minima
  FROM ativos, saidas;
$$;

-- ============================================================
-- Treinamentos anual (sp_treinamentos_presenca) com área — via join por nome em sp_turnover
-- ============================================================
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
  WITH minutos AS (
    SELECT COALESCE(SUM(t.duracao_minutos), 0) AS v
    FROM sp_treinamentos_presenca t
    LEFT JOIN sp_turnover tv ON UPPER(TRIM(tv.nome)) = UPPER(TRIM(t.colaborador))
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND (p_area IS NULL OR tv.area = p_area)
  ),
  ativos AS (
    SELECT COUNT(*)::integer AS n
    FROM sp_turnover
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
      AND (p_area IS NULL OR area = p_area)
  )
  SELECT
    minutos.v,
    ativos.n,
    (ativos.n * 14 * 60)::numeric AS meta_minutos,
    ROUND(COALESCE(minutos.v / NULLIF(ativos.n * 14 * 60, 0) * 100, 0), 2) AS pct_atingimento
  FROM minutos, ativos;
$$;

-- ============================================================
-- Treinamentos mensal (para o heat-strip do Overview) com área
-- ============================================================
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
    FROM sp_turnover
    WHERE EXTRACT(YEAR FROM admissao)::integer <= p_ano
      AND (desligamento IS NULL OR EXTRACT(YEAR FROM desligamento)::integer > p_ano)
      AND (p_area IS NULL OR area = p_area)
  ),
  meta AS (
    SELECT (ativos.n * 14 * 60)::numeric AS minutos FROM ativos
  ),
  por_mes AS (
    SELECT
      EXTRACT(MONTH FROM t.data)::integer AS mes,
      COALESCE(SUM(t.duracao_minutos), 0) AS minutos_lancados
    FROM sp_treinamentos_presenca t
    LEFT JOIN sp_turnover tv ON UPPER(TRIM(tv.nome)) = UPPER(TRIM(t.colaborador))
    WHERE EXTRACT(YEAR FROM t.data)::integer = p_ano
      AND (p_area IS NULL OR tv.area = p_area)
    GROUP BY 1
  )
  SELECT
    por_mes.mes,
    por_mes.minutos_lancados,
    meta.minutos AS meta_minutos,
    ROUND(COALESCE(por_mes.minutos_lancados / NULLIF(meta.minutos, 0) * 100, 0), 2) AS pct_atingimento
  FROM por_mes, meta
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) IS
  'SLA de Protocolo mensal (sp_tarefas_historico / "Nova"): D-1 vs FATAL, com meta vigente no período. Filtrável por área.';
COMMENT ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) IS
  'Eficiência de Protocolo mensal (sp_protocolos): % sem inconsistência jurídica. Filtrável por área.';
COMMENT ON FUNCTION public.eficiencia_agendamento_mensal(integer, text) IS
  'Agendamento/Ciência D+1 mensal (sp_tarefas). Filtrável por área.';
COMMENT ON FUNCTION public.eficiencia_turnover_anual(integer, text) IS
  'Turnover anual: funcionários ativos, saídas voluntárias, % retenção e meta mínima (90%, cartão Overview). Filtrável por área.';
COMMENT ON FUNCTION public.eficiencia_treinamentos_anual(integer, text) IS
  'Atingimento anual de treinamentos: minutos lançados vs meta (14h/pessoa ativa). Filtrável por área (via join com sp_turnover por nome).';
COMMENT ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) IS
  'Atingimento mensal de treinamentos (para heat-strip do Overview). Filtrável por área.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_turnover_anual(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_anual(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_treinamentos_mensal(integer, text) TO anon, authenticated;
