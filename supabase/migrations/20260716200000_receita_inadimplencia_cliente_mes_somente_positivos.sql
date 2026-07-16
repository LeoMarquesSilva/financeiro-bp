-- Alinha KPI (evolução) e sheet de grupos: inadimplência mensal por cliente continua
-- max(0, faturado − recebido), mantendo o corte de vencimento no mês corrente.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  cliente text,
  faturado numeric,
  recebido numeric,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH faturado_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND v.data_vencimento <= public.receita_inadimplencia_corte_vencimento(p_ano, p_mes)
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1
  ),
  recebido_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1
  ),
  net AS (
    SELECT
      COALESCE(f.cliente, r.cliente) AS cliente,
      COALESCE(f.faturado, 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      GREATEST(
        COALESCE(f.faturado, 0) - COALESCE(r.recebido, 0),
        0
      )::numeric(15, 2) AS inadimplencia
    FROM faturado_mes f
    FULL OUTER JOIN recebido_mes r ON r.cliente = f.cliente
  )
  SELECT n.cliente, n.faturado, n.recebido, n.inadimplencia
  FROM net n
  WHERE n.inadimplencia > 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer, boolean) IS
  'Inadimplência mensal VIOS: max(0, faturado − recebido) por cliente; mês corrente só vencidos até hoje.';
