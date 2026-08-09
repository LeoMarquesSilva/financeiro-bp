-- Participação por área no painel Eficiência (jurídico):
-- exclui Operações Legais do volume e do denominador (% soma ~100% só com áreas jurídicas).

CREATE OR REPLACE FUNCTION public.eficiencia_area_participacao(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (
  area text,
  qtd integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT COALESCE(NULLIF(TRIM(area), ''), '(sem área)') AS area
    FROM sp_protocolos
    WHERE data_criada IS NOT NULL
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (
        p_meses IS NULL
        OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses)
      )
      AND area IS NOT NULL
      AND TRIM(area) <> ''
      AND area IN (
        'Cível',
        'Contratos',
        'Recuperação de Crédito',
        'Reestruturação',
        'Trabalhista'
      )
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    b.area,
    COUNT(*)::integer AS qtd,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base b
  GROUP BY 1
  ORDER BY qtd DESC, area;
$$;

COMMENT ON FUNCTION public.eficiencia_area_participacao(integer, integer[]) IS
  '% de protocolos (data_criada) por área jurídica no período — sem Operações Legais.';
