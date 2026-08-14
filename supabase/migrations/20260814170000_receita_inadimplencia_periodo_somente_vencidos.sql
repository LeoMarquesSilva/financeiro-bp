-- Card Resultado R$ / grupos_periodo: no mês corrente, faturado só de títulos já vencidos.
-- Estende periodo_net_clientes (fonte do KPI) com o mesmo corte de cliente_mes.
-- Meses encerrados: corte = último dia do mês — casos Jan–Jul inalterados.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_periodo_net_clientes(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_incluir_inativos boolean DEFAULT false
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
  corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(
      p_ano,
      (SELECT mes_fim FROM bounds)
    ) AS dt
  ),
  faturado_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado,
      COUNT(DISTINCT EXTRACT(MONTH FROM v.data_vencimento)::integer) FILTER (
        WHERE COALESCE(v.valor_item, 0) > 0
      )::integer AS qtd_meses
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN bounds b
    CROSS JOIN corte c
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND v.data_vencimento <= c.dt
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1, 2
  ),
  recebido_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    CROSS JOIN bounds b
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1
  ),
  grupo_lookup AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE p_incluir_inativos OR public.receita_item_cliente_ativo(i)
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

COMMENT ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer, boolean) IS
  'Saldo líquido do período por cliente. Faturado: só títulos com vencimento <= corte (mês corrente = hoje). Recebido: caixa do intervalo (encontro de contas).';

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
  corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(
      p_ano,
      (SELECT mes_fim FROM bounds)
    ) AS dt
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
    CROSS JOIN corte c
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND v.data_vencimento <= c.dt
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
  corte AS (
    SELECT public.receita_inadimplencia_corte_vencimento(
      p_ano,
      (SELECT mes_fim FROM bounds)
    ) AS dt
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
    CROSS JOIN corte c
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
      AND v.data_vencimento <= c.dt
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
  'Inadimplência grupo×dept no período: saldo líquido do cliente (só vencidos) alocado por faturamento VIOS.';

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_departamento_periodo(integer, integer, integer, boolean) IS
  'Inadimplência cliente×dept no período: saldo líquido (só vencidos) alocado por faturamento VIOS.';
