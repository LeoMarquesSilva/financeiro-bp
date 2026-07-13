-- Restaura compensação Lira na inadimplência mensal:
-- 1) saldo por item (antecipado zera; pago após o mês continua inadimplente);
-- 2) recebido = todos os pagamentos no calendário do mês;
-- 3) inadimplência = min(saldo itens, faturado − recebido) quando recebido < faturado.
-- Sem isso o recálculo ao vivo inflava (ex.: mai/2026 ~499k em vez de ~345k).

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
      WHEN c.inad_itens <= 0 THEN 0::numeric(15, 2)
      ELSE LEAST(
        c.inad_itens,
        GREATEST(0, c.faturado - COALESCE(r.recebido, 0))
      )::numeric(15, 2)
    END AS inadimplencia
  FROM por_cliente c
  LEFT JOIN recebido_mes r ON r.cliente = c.cliente
  WHERE c.faturado > 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer) IS
  'Inad por cliente: min(saldo itens no mês, faturado − recebido no calendário). Antecipado zera item; pagamento parcial no mês compensa.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupo_mes(
  p_ano integer,
  p_mes integer
)
RETURNS TABLE (
  grupo_cliente text,
  faturado numeric,
  recebido numeric,
  inadimplencia numeric,
  qtd_clientes integer,
  qtd_clientes_inad integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cliente_grupo AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_elegiveis v
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  cliente_inad AS (
    SELECT * FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes)
  )
  SELECT
    cg.grupo_cliente,
    ROUND(SUM(ci.faturado), 2)::numeric(15, 2) AS faturado,
    ROUND(SUM(ci.recebido), 2)::numeric(15, 2) AS recebido,
    ROUND(SUM(ci.inadimplencia), 2)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_clientes,
    COUNT(*) FILTER (WHERE ci.inadimplencia > 0)::integer AS qtd_clientes_inad
  FROM cliente_inad ci
  INNER JOIN cliente_grupo cg ON cg.cliente = ci.cliente
  GROUP BY cg.grupo_cliente
  ORDER BY inadimplencia DESC, cg.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer) IS
  'Inadimplência mensal por grupo: soma dos saldos por cliente (regra Lira + antecipado).';
