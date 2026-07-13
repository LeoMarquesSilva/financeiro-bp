-- Alinha evolução mensal à planilha MAIO.xlsx (regra operacional):
-- por cliente = max(0, faturado vencimento − recebido pagamento).
-- Total do mês = soma dos positivos (sem compensar antecipados negativos entre clientes).
-- Mai/2026: R$ 364.263,80.

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
  'Inadimplência mensal VIOS: max(0, faturado − recebido) por cliente; total do mês = soma dos positivos.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupo_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT false
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
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE p_incluir_inativos OR public.receita_item_cliente_ativo(i)
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  cliente_inad AS (
    SELECT * FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes, p_incluir_inativos)
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
  HAVING SUM(ci.inadimplencia) > 0
  ORDER BY inadimplencia DESC, cg.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupo_mes(integer, integer, boolean) IS
  'Inadimplência mensal por grupo: soma dos saldos positivos por cliente (VIOS).';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_departamento_mes(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT true
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
  WITH faturado_dept AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado_dept
    FROM public.receita_itens_inadimplencia_base v
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
      AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    GROUP BY 1, 2
  ),
  cliente AS (
    SELECT *
    FROM public.receita_inadimplencia_cliente_mes(p_ano, p_mes, p_incluir_inativos)
  ),
  alocado AS (
    SELECT
      fd.departamento,
      ROUND(
        SUM(
          c.inadimplencia * CASE
            WHEN c.faturado > 0 THEN fd.faturado_dept / c.faturado
            ELSE 0
          END
        ),
        2
      )::numeric(15, 2) AS inadimplencia
    FROM faturado_dept fd
    INNER JOIN cliente c ON c.cliente = fd.cliente
    GROUP BY fd.departamento
  )
  SELECT a.departamento, a.inadimplencia
  FROM alocado a
  WHERE a.inadimplencia > 0
  ORDER BY a.inadimplencia DESC, a.departamento;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_departamento_mes(integer, integer, boolean) IS
  'Inadimplência mensal por área: aloca saldo positivo do cliente proporcional ao faturado do departamento.';

UPDATE public.receita_inadimplencia_fechamento_mensal
SET
  valor_total = 364263.80,
  pct_recebido = ROUND((364263.80 / public.receita_previsto_mes(2026, 5)) * 100, 2),
  congelado_em = now()
WHERE ano = 2026
  AND mes = 5;
