-- Inadimplência mensal por departamento (área), alocada a partir do total por cliente (regra Lira).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_departamento_mes(
  p_ano integer,
  p_mes integer
)
RETURNS TABLE (
  departamento text,
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
      COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
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
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
  ),
  por_cliente_dept AS (
    SELECT
      cliente,
      departamento,
      SUM(valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes
    GROUP BY cliente, departamento
  ),
  totais_cliente AS (
    SELECT
      cliente,
      SUM(faturado_dept)::numeric(15, 2) AS faturado,
      SUM(inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept
    GROUP BY cliente
  ),
  cliente_final AS (
    SELECT c.cliente, c.inadimplencia
    FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes) c
    WHERE c.inadimplencia > 0
  ),
  alocado AS (
    SELECT
      d.departamento,
      ROUND(
        SUM(
          cf.inadimplencia * CASE
            WHEN t.inad_itens > 0 THEN d.inad_itens_dept / t.inad_itens
            WHEN t.faturado > 0 THEN d.faturado_dept / t.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept d
    INNER JOIN totais_cliente t ON t.cliente = d.cliente
    INNER JOIN cliente_final cf ON cf.cliente = d.cliente
    WHERE d.inad_itens_dept > 0 OR d.faturado_dept > 0
    GROUP BY d.departamento
  )
  SELECT departamento, inadimplencia
  FROM alocado
  WHERE inadimplencia > 0
  ORDER BY inadimplencia DESC, departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer) IS
  'Inadimplência do mês por área, alocada proporcionalmente ao total por cliente (Lira).';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer) TO anon, authenticated;
