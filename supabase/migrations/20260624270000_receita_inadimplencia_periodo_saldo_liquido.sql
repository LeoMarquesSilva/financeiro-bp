-- Corrige inflação do KPI do período: a migration anterior somou inadimplência mensal
-- (Σ por mês de vencimento), o que mais que dobrou o total. O KPI do período deve usar
-- saldo líquido no intervalo (faturado vencimento − recebido pagamento), como na planilha.
-- Mantém a regra de antecipado por item apenas na visão mensal (cliente_mes / detalhe).

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
    ROUND(GREATEST(SUM(ci.faturado) - SUM(ci.recebido), 0), 2)::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_clientes,
    COUNT(*) FILTER (
      WHERE GREATEST(ci.faturado - ci.recebido, 0) > 0
    )::integer AS qtd_clientes_inad
  FROM cliente_inad ci
  INNER JOIN cliente_grupo cg ON cg.cliente = ci.cliente
  GROUP BY cg.grupo_cliente
  ORDER BY inadimplencia DESC, cg.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer) IS
  'Inadimplência mensal por grupo: max(0, Σ faturado − Σ recebido das empresas). Mensal usa antecipado por item.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_periodo_net_clientes(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
  grupo_cliente text,
  faturado numeric,
  recebido numeric,
  valor_liquido numeric,
  valor numeric,
  qtd_meses integer
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
  faturado_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado,
      COUNT(DISTINCT EXTRACT(MONTH FROM v.data_vencimento)::integer) FILTER (
        WHERE COALESCE(v.valor_item, 0) > 0
      )::integer AS qtd_meses
    FROM public.receita_itens_inadimplencia_elegiveis v
    CROSS JOIN bounds b
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
    GROUP BY 1, 2
  ),
  recebido_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_elegiveis v
    CROSS JOIN bounds b
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer BETWEEN b.mes_inicio AND b.mes_fim
    GROUP BY 1
  ),
  grupo_lookup AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_elegiveis v
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  net AS (
    SELECT
      COALESCE(f.cliente, r.cliente) AS cliente,
      COALESCE(f.grupo_cliente, g.grupo_cliente, 'Sem grupo') AS grupo_cliente,
      COALESCE(f.faturado, 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (COALESCE(f.faturado, 0) - COALESCE(r.recebido, 0))::numeric(15, 2) AS valor_liquido,
      COALESCE(f.qtd_meses, 0)::integer AS qtd_meses
    FROM faturado_periodo f
    FULL OUTER JOIN recebido_periodo r ON r.cliente = f.cliente
    LEFT JOIN grupo_lookup g ON g.cliente = COALESCE(f.cliente, r.cliente)
  )
  SELECT
    n.cliente,
    n.grupo_cliente,
    n.faturado,
    n.recebido,
    n.valor_liquido,
    GREATEST(n.valor_liquido, 0)::numeric(15, 2) AS valor,
    n.qtd_meses
  FROM net n;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer) IS
  'Saldo proporcional do período por cliente: faturado vencimento − recebido pagamento.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupos_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  grupo_cliente text,
  valor numeric,
  qtd_meses integer,
  qtd_clientes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.grupo_cliente,
    ROUND(GREATEST(SUM(n.faturado) - SUM(n.recebido), 0), 2)::numeric(15, 2) AS valor,
    MAX(n.qtd_meses)::integer AS qtd_meses,
    COUNT(*) FILTER (
      WHERE n.faturado > 0 OR n.recebido > 0
    )::integer AS qtd_clientes
  FROM public.receita_inadimplencia_periodo_net_clientes(p_ano, p_mes_inicio, p_mes_fim) n
  GROUP BY n.grupo_cliente
  HAVING GREATEST(SUM(n.faturado) - SUM(n.recebido), 0) > 0
  ORDER BY valor DESC, n.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupos_periodo(integer, integer, integer) IS
  'Inadimplência do período por grupo: max(0, Σ faturado − Σ recebido das empresas do grupo).';
