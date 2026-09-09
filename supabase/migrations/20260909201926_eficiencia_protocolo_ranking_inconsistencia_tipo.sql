CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_tipo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (tipo_inconsistencia text, qtd_inconsistencia integer, pct_do_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(trim(inconsistencia_juridico), ''),
        '(sem tipo)'
      ) AS tipo_inconsistencia
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area)
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
      AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    tipo_inconsistencia,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_tipo(integer, integer[], text) IS
  'Ranking de inconsistências de protocolo por tipo (campo Inconsistência - Jurídico).';

GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_tipo(integer, integer[], text) TO anon, authenticated;
