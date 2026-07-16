-- Inadimplência mensal por cliente no nível do item (mesma regra do detalhe de títulos):
-- título com vencimento no mês M quitado até o corte do mês (inclui antecipado) → inad = 0.

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
  WITH corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(p_ano, p_mes) AS dt
  ),
  itens AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      (
        CASE
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT dt FROM corte)
               AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
               AND COALESCE(v.valor_item, 0) > 0
            THEN 0::numeric(15, 2)
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= (SELECT dt FROM corte)
            THEN GREATEST(
              0,
              COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
            )::numeric(15, 2)
          ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
        END
      ) AS inad_item
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND v.data_vencimento <= (SELECT dt FROM corte)
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  )
  SELECT
    it.cliente,
    ROUND(SUM(it.valor_item), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(it.valor_item - it.inad_item), 2)::numeric(15, 2) AS recebido,
    ROUND(SUM(it.inad_item), 2)::numeric(15, 2) AS inadimplencia
  FROM itens it
  GROUP BY it.cliente
  HAVING ROUND(SUM(it.inad_item), 2) > 0
  ORDER BY inadimplencia DESC, it.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer, boolean) IS
  'Inadimplência mensal por cliente (nível item): antecipado quitado até o corte do mês não entra; alinha listagem e detalhe de títulos.';
