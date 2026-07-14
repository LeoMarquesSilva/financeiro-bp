-- Inadimplência mensal por área (departamento), somente para meses já congelados —
-- redistribui o valor total congelado do mês proporcionalmente ao peso de cada área
-- no cálculo ao vivo (mesma alocação usada em receita_inadimplencia_departamento_mes).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_departamento_mensal_congelado(
  p_ano integer,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE (
  mes integer,
  departamento text,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meses_congelados AS (
    SELECT f.mes, f.valor_total
    FROM public.receita_inadimplencia_fechamento_mensal f
    WHERE f.ano = p_ano
  ),
  dept_live AS (
    SELECT mc.mes, d.departamento, d.inadimplencia AS valor_live
    FROM meses_congelados mc
    CROSS JOIN LATERAL public.receita_inadimplencia_departamento_mes(p_ano, mc.mes, p_incluir_inativos) d
  ),
  dept_total_live AS (
    SELECT mes, SUM(valor_live) AS total_live
    FROM dept_live
    GROUP BY mes
  )
  SELECT
    dl.mes,
    dl.departamento,
    ROUND(
      CASE WHEN tl.total_live > 0
        THEN mc.valor_total * (dl.valor_live / tl.total_live)
        ELSE 0
      END,
      2
    )::numeric(15, 2) AS inadimplencia
  FROM dept_live dl
  INNER JOIN dept_total_live tl ON tl.mes = dl.mes
  INNER JOIN meses_congelados mc ON mc.mes = dl.mes
  ORDER BY dl.mes, inadimplencia DESC;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_departamento_mensal_congelado(integer, boolean) IS
  'Inadimplência por área somente para meses congelados — redistribui o valor total congelado proporcionalmente ao peso de cada área no cálculo ao vivo.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_departamento_mensal_congelado(integer, boolean) TO anon, authenticated;
