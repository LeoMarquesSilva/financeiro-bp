-- Lista de clientes inadimplentes agregada por período (soma mensal calculada).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_clientes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
  valor numeric,
  qtd_meses integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meses AS (
    SELECT generate_series(
      GREATEST(1, LEAST(p_mes_inicio, 12)),
      GREATEST(1, LEAST(p_mes_fim, 12))
    )::integer AS mes
  )
  SELECT
    c.cliente,
    ROUND(SUM(c.inadimplencia), 2)::numeric(15, 2) AS valor,
    COUNT(*) FILTER (WHERE c.inadimplencia > 0)::integer AS qtd_meses
  FROM meses m
  CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(p_ano, m.mes) c
  WHERE c.inadimplencia > 0
  GROUP BY c.cliente
  ORDER BY valor DESC, c.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer) IS
  'Clientes com inadimplência no período — soma dos valores calculados mês a mês.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer) TO anon, authenticated;
