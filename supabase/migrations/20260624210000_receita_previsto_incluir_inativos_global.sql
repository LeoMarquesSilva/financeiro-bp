-- Previsto na Receita inclui clientes inativos (faturado por vencimento na cota).
-- Recebido e inadimplência (saldo) continuam considerando só clientes ativos.

CREATE OR REPLACE FUNCTION public.receita_totais_mensais(p_ano integer)
RETURNS TABLE (
  mes integer,
  recebido numeric,
  previsto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base_recebido AS (
    SELECT i.*
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
      AND public.receita_item_cliente_ativo(i)
  ),
  base_previsto AS (
    SELECT i.*
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
  ),
  rec AS (
    SELECT
      EXTRACT(MONTH FROM data_pagamento)::integer AS mes,
      COALESCE(SUM(valor_pago_item), 0) AS total
    FROM base_recebido
    WHERE data_pagamento IS NOT NULL
      AND valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  prev AS (
    SELECT
      EXTRACT(MONTH FROM data_vencimento)::integer AS mes,
      COALESCE(SUM(valor_item), 0) AS total
    FROM base_previsto
    WHERE data_vencimento IS NOT NULL
      AND valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(1, 12) AS mes
  )
  SELECT
    m.mes,
    COALESCE(r.total, 0),
    COALESCE(p.total, 0)
  FROM meses m
  LEFT JOIN rec r ON r.mes = m.mes
  LEFT JOIN prev p ON p.mes = m.mes
  ORDER BY m.mes;
$$;

CREATE OR REPLACE FUNCTION public.receita_previsto_mes(p_ano integer, p_mes integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(i.valor_item, 0)), 0)::numeric(15, 2)
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes;
$$;

CREATE OR REPLACE FUNCTION public.receita_previsto_por_plano(
  p_ano integer,
  p_mes integer,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE (
  plano_contas text,
  quantidade bigint,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.plano_contas,
    COUNT(*)::bigint AS quantidade,
    COALESCE(SUM(i.valor_item), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
  GROUP BY i.plano_contas
  ORDER BY total DESC, i.plano_contas;
$$;

CREATE OR REPLACE FUNCTION public.receita_previsto_itens(
  p_ano integer,
  p_mes integer,
  p_plano_contas text,
  p_incluir_inativos boolean DEFAULT true
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  cliente text,
  descricao text,
  nro_titulo text,
  data_vencimento date,
  valor_item numeric,
  plano_contas text,
  situacao_titulo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.ci_item,
    i.ci_titulo,
    NULLIF(TRIM(i.cliente), '') AS cliente,
    NULLIF(TRIM(i.descricao), '') AS descricao,
    NULLIF(TRIM(i.nro_titulo), '') AS nro_titulo,
    i.data_vencimento,
    i.valor_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    AND i.plano_contas = p_plano_contas
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
  ORDER BY i.valor_item DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_totais_mensais(integer) IS
  'Totais mensais: recebido (só clientes ativos) e previsto (todos na cota, incluindo inativos).';

COMMENT ON FUNCTION public.receita_previsto_mes(integer, integer) IS
  'Faturado no mês (vencimento) na cota, incluindo clientes inativos.';

COMMENT ON FUNCTION public.receita_previsto_por_plano(integer, integer, boolean) IS
  'Breakdown do previsto por plano. Padrão inclui clientes inativos.';

COMMENT ON FUNCTION public.receita_previsto_itens(integer, integer, text, boolean) IS
  'Itens do previsto no mês/plano. Padrão inclui clientes inativos.';
