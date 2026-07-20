-- CANÔNICO — regra fixa. Ver .cursor/rules/receita-inadimplencia-agregacao.mdc
-- Área/grupo×dept no período: saldo líquido do cliente no intervalo, alocado por faturamento VIOS.
-- Evita inadimplência fantasma quando pagamento cai no mês seguinte (ex.: Baptistella jun→jul).

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
  net_cliente AS (
    SELECT
      n.cliente,
      public.receita_inadimplencia_chave_grupo(n.grupo_cliente, n.cliente) AS chave_grupo,
      GREATEST(n.valor_liquido, 0)::numeric(15, 2) AS inad_cliente
    FROM public.receita_inadimplencia_periodo_net_clientes(
      p_ano, p_mes_inicio, p_mes_fim, p_incluir_inativos
    ) n
    WHERE GREATEST(n.valor_liquido, 0) > 0
  ),
  faturado_dept AS (
    SELECT
      public.receita_inadimplencia_chave_grupo(
        COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo'),
        COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente')
      ) AS chave_grupo,
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado_dept
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN bounds b
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1, 2, 3
  ),
  faturado_cliente AS (
    SELECT
      fd.cliente,
      SUM(fd.faturado_dept)::numeric(15, 2) AS faturado_total
    FROM faturado_dept fd
    GROUP BY fd.cliente
  ),
  alocado AS (
    SELECT
      fd.chave_grupo AS grupo_cliente,
      fd.departamento,
      ROUND(
        nc.inad_cliente * fd.faturado_dept / NULLIF(fc.faturado_total, 0),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM faturado_dept fd
    INNER JOIN net_cliente nc ON nc.cliente = fd.cliente
    INNER JOIN faturado_cliente fc ON fc.cliente = fd.cliente
  )
  SELECT
    a.grupo_cliente,
    a.departamento,
    ROUND(SUM(a.inadimplencia), 2)::numeric(15, 2) AS inadimplencia
  FROM alocado a
  GROUP BY a.grupo_cliente, a.departamento
  HAVING ROUND(SUM(a.inadimplencia), 2) > 0
  ORDER BY inadimplencia DESC, a.grupo_cliente, a.departamento;
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
  net_cliente AS (
    SELECT
      n.cliente,
      public.receita_inadimplencia_chave_grupo(n.grupo_cliente, n.cliente) AS chave_grupo,
      GREATEST(n.valor_liquido, 0)::numeric(15, 2) AS inad_cliente
    FROM public.receita_inadimplencia_periodo_net_clientes(
      p_ano, p_mes_inicio, p_mes_fim, p_incluir_inativos
    ) n
    WHERE GREATEST(n.valor_liquido, 0) > 0
  ),
  faturado_dept AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      public.receita_inadimplencia_chave_grupo(
        COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo'),
        COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente')
      ) AS chave_grupo,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado_dept
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN bounds b
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1, 2, 3
  ),
  faturado_cliente AS (
    SELECT
      fd.cliente,
      SUM(fd.faturado_dept)::numeric(15, 2) AS faturado_total
    FROM faturado_dept fd
    GROUP BY fd.cliente
  ),
  alocado AS (
    SELECT
      fd.cliente,
      fd.chave_grupo AS grupo_cliente,
      fd.departamento,
      ROUND(
        nc.inad_cliente * fd.faturado_dept / NULLIF(fc.faturado_total, 0),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM faturado_dept fd
    INNER JOIN net_cliente nc ON nc.cliente = fd.cliente
    INNER JOIN faturado_cliente fc ON fc.cliente = fd.cliente
  )
  SELECT
    a.cliente,
    a.grupo_cliente,
    a.departamento,
    ROUND(SUM(a.inadimplencia), 2)::numeric(15, 2) AS inadimplencia
  FROM alocado a
  GROUP BY a.cliente, a.grupo_cliente, a.departamento
  HAVING ROUND(SUM(a.inadimplencia), 2) > 0
  ORDER BY inadimplencia DESC, a.cliente, a.departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_departamento_periodo(integer, integer, integer, boolean) IS
  'Inadimplência grupo×dept no período: saldo líquido do cliente alocado por faturamento VIOS.';

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_departamento_periodo(integer, integer, integer, boolean) IS
  'Inadimplência cliente×dept no período: saldo líquido alocado por faturamento VIOS.';
