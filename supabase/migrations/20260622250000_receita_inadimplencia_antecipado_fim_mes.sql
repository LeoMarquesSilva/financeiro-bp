-- Corrige regra de pagamento antecipado: só zera inadimplência do mês M se o item
-- foi quitado até o último dia do mês M (vencimento no mês). Pagamento em M+1 continua inadimplente em M.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_mes(
  p_ano integer,
  p_mes integer
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
  WITH fim_mes AS (
    SELECT (date_trunc('month', make_date(p_ano, p_mes, 1)) + interval '1 month - 1 day')::date AS dt
  ),
  itens_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      COALESCE(v.valor_pago_item, 0)::numeric(15, 2) AS valor_pago_item,
      v.data_pagamento,
      CASE
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= (SELECT dt FROM fim_mes)
             AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
             AND COALESCE(v.valor_item, 0) > 0
          THEN 0::numeric(15, 2)
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= (SELECT dt FROM fim_mes)
          THEN GREATEST(
            0,
            COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
          )::numeric(15, 2)
        ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
      END AS inad_item
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
  ),
  por_cliente AS (
    SELECT
      i.cliente,
      SUM(i.valor_item)::numeric(15, 2) AS faturado,
      SUM(i.inad_item)::numeric(15, 2) AS inad_itens
    FROM itens_mes i
    GROUP BY i.cliente
  ),
  recebido_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer = p_mes
    GROUP BY 1
  )
  SELECT
    c.cliente,
    c.faturado,
    COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
    CASE
      WHEN COALESCE(r.recebido, 0) >= c.faturado AND c.faturado > 0 THEN 0::numeric(15, 2)
      ELSE c.inad_itens
    END AS inadimplencia
  FROM por_cliente c
  LEFT JOIN recebido_mes r ON r.cliente = c.cliente
  WHERE c.faturado > 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer) IS
  'Por cliente: faturado (venc. no mês). Inad = saldo dos itens não quitados até o fim do mês M (antecipado conta; pagamento após M não). Regra Lira: recebido no mês >= faturado zera.';
