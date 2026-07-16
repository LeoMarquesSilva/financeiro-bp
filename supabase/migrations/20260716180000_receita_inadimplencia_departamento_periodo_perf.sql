-- Fix: materializa receita_inadimplencia_cliente_mes (1× por mês) em vez de nested loop (centenas de chamadas).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupo_departamento_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  grupo_cliente text,
  departamento text,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_inicio,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim
  ),
  meses AS (
    SELECT m.mes
    FROM bounds b
    CROSS JOIN generate_series(b.mes_inicio, b.mes_fim) AS m(mes)
  ),
  fim_mes AS (
    SELECT
      m.mes,
      (date_trunc('month', make_date(p_ano, m.mes, 1)) + interval '1 month - 1 day')::date AS dt
    FROM meses m
  ),
  cliente_mes_cache AS MATERIALIZED (
    SELECT
      fm.mes,
      c.cliente,
      c.faturado,
      c.inadimplencia
    FROM fim_mes fm
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
      p_ano, fm.mes, p_incluir_inativos
    ) c
    WHERE c.inadimplencia > 0
  ),
  itens_mes AS (
    SELECT
      fm.mes,
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      CASE
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= fm.dt
             AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
             AND COALESCE(v.valor_item, 0) > 0
          THEN 0::numeric(15, 2)
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= fm.dt
          THEN GREATEST(
            0,
            COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
          )::numeric(15, 2)
        ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
      END AS inad_item
    FROM fim_mes fm
    INNER JOIN public.receita_itens_inadimplencia_base v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente_dept AS (
    SELECT
      im.mes,
      im.cliente,
      im.grupo_cliente,
      im.departamento,
      SUM(im.valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(im.inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes im
    GROUP BY im.mes, im.cliente, im.grupo_cliente, im.departamento
  ),
  totais_cliente AS (
    SELECT
      pcd.mes,
      pcd.cliente,
      SUM(pcd.faturado_dept)::numeric(15, 2) AS faturado,
      SUM(pcd.inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept pcd
    GROUP BY pcd.mes, pcd.cliente
  ),
  alocado_mes AS (
    SELECT
      pcd.mes,
      pcd.grupo_cliente,
      pcd.departamento,
      ROUND(
        SUM(
          cm.inadimplencia * CASE
            WHEN tc.inad_itens > 0 THEN pcd.inad_itens_dept / tc.inad_itens
            WHEN tc.faturado > 0 THEN pcd.faturado_dept / tc.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept pcd
    INNER JOIN totais_cliente tc ON tc.mes = pcd.mes AND tc.cliente = pcd.cliente
    INNER JOIN cliente_mes_cache cm ON cm.mes = pcd.mes AND cm.cliente = pcd.cliente
    GROUP BY pcd.mes, pcd.grupo_cliente, pcd.departamento
  )
  SELECT
    am.grupo_cliente,
    am.departamento,
    ROUND(SUM(am.inadimplencia), 2)::numeric(15, 2) AS inadimplencia
  FROM alocado_mes am
  GROUP BY am.grupo_cliente, am.departamento
  HAVING ROUND(SUM(am.inadimplencia), 2) > 0
  ORDER BY inadimplencia DESC, am.grupo_cliente, am.departamento;
$$;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_departamento_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
)
RETURNS TABLE (
  cliente text,
  grupo_cliente text,
  departamento text,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_inicio,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim
  ),
  meses AS (
    SELECT m.mes
    FROM bounds b
    CROSS JOIN generate_series(b.mes_inicio, b.mes_fim) AS m(mes)
  ),
  fim_mes AS (
    SELECT
      m.mes,
      (date_trunc('month', make_date(p_ano, m.mes, 1)) + interval '1 month - 1 day')::date AS dt
    FROM meses m
  ),
  cliente_mes_cache AS MATERIALIZED (
    SELECT
      fm.mes,
      c.cliente,
      c.faturado,
      c.inadimplencia
    FROM fim_mes fm
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(
      p_ano, fm.mes, p_incluir_inativos
    ) c
    WHERE c.inadimplencia > 0
  ),
  itens_mes AS (
    SELECT
      fm.mes,
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      CASE
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= fm.dt
             AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
             AND COALESCE(v.valor_item, 0) > 0
          THEN 0::numeric(15, 2)
        WHEN v.data_pagamento IS NOT NULL
             AND v.data_pagamento <= fm.dt
          THEN GREATEST(
            0,
            COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
          )::numeric(15, 2)
        ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
      END AS inad_item
    FROM fim_mes fm
    INNER JOIN public.receita_itens_inadimplencia_base v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
  ),
  por_cliente_dept AS (
    SELECT
      im.mes,
      im.cliente,
      im.grupo_cliente,
      im.departamento,
      SUM(im.valor_item)::numeric(15, 2) AS faturado_dept,
      SUM(im.inad_item)::numeric(15, 2) AS inad_itens_dept
    FROM itens_mes im
    GROUP BY im.mes, im.cliente, im.grupo_cliente, im.departamento
  ),
  totais_cliente AS (
    SELECT
      pcd.mes,
      pcd.cliente,
      SUM(pcd.faturado_dept)::numeric(15, 2) AS faturado,
      SUM(pcd.inad_itens_dept)::numeric(15, 2) AS inad_itens
    FROM por_cliente_dept pcd
    GROUP BY pcd.mes, pcd.cliente
  ),
  alocado_mes AS (
    SELECT
      pcd.mes,
      pcd.cliente,
      pcd.grupo_cliente,
      pcd.departamento,
      ROUND(
        SUM(
          cm.inadimplencia * CASE
            WHEN tc.inad_itens > 0 THEN pcd.inad_itens_dept / tc.inad_itens
            WHEN tc.faturado > 0 THEN pcd.faturado_dept / tc.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM por_cliente_dept pcd
    INNER JOIN totais_cliente tc ON tc.mes = pcd.mes AND tc.cliente = pcd.cliente
    INNER JOIN cliente_mes_cache cm ON cm.mes = pcd.mes AND cm.cliente = pcd.cliente
    GROUP BY pcd.mes, pcd.cliente, pcd.grupo_cliente, pcd.departamento
  )
  SELECT
    am.cliente,
    am.grupo_cliente,
    am.departamento,
    ROUND(SUM(am.inadimplencia), 2)::numeric(15, 2) AS inadimplencia
  FROM alocado_mes am
  GROUP BY am.cliente, am.grupo_cliente, am.departamento
  HAVING ROUND(SUM(am.inadimplencia), 2) > 0
  ORDER BY inadimplencia DESC, am.grupo_cliente, am.cliente, am.departamento;
$$;
