-- Restaura grupo_cliente em clientes_periodo (removido ao adicionar p_incluir_inativos).

DROP FUNCTION IF EXISTS public.receita_inadimplencia_clientes_periodo(integer, integer, integer, boolean);

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_clientes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  cliente text,
  grupo_cliente text,
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
  ),
  cliente_grupo AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE p_incluir_inativos OR public.receita_item_cliente_ativo(i)
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  )
  SELECT
    c.cliente,
    cg.grupo_cliente,
    ROUND(SUM(c.inadimplencia), 2)::numeric(15, 2) AS valor,
    COUNT(*) FILTER (WHERE c.inadimplencia > 0)::integer AS qtd_meses
  FROM meses m
  CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
    p_ano, m.mes, p_incluir_inativos
  ) c
  INNER JOIN cliente_grupo cg ON cg.cliente = c.cliente
  WHERE c.inadimplencia > 0
  GROUP BY c.cliente, cg.grupo_cliente
  ORDER BY valor DESC, c.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer, boolean) IS
  'Clientes inadimplentes no período com grupo_cliente (drill-down). p_incluir_inativos=true alinha ao KPI acumulado.';
