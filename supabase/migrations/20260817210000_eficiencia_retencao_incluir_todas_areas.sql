-- Retenção de Talentos: população = todo sp_turnover (inclui Distressd Deals e Tributário).
-- Reverte exclusão introduzida em 20260805180000_eficiencia_overview_filtros_bi.sql.

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
    WHERE p_area IS NULL OR area = p_area
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

COMMENT ON FUNCTION public.eficiencia_turnover_anual(integer, text) IS
  'Retenção anual (Overview): toda a base sp_turnover; filtro opcional por área.';
