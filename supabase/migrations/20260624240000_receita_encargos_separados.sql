-- Recebido na cota usa valor líquido (sem encargos de boleto/juros).
-- Encargos = max(0, valor_pago_item - valor_fluxo_item) quando fluxo > 0 e pago > fluxo.

CREATE OR REPLACE FUNCTION public.receita_item_encargos(i public.financeiro_parcelas_itens)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN i.valor_pago_item IS NOT NULL
      AND i.valor_fluxo_item IS NOT NULL
      AND i.valor_fluxo_item > 0
      AND i.valor_pago_item > i.valor_fluxo_item + 0.001
    THEN ROUND((i.valor_pago_item - i.valor_fluxo_item)::numeric, 2)
    ELSE 0::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.receita_item_recebido_liquido(i public.financeiro_parcelas_itens)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    CASE
      WHEN i.valor_pago_item IS NULL OR i.valor_pago_item = 0 THEN 0::numeric
      WHEN i.valor_fluxo_item IS NOT NULL
        AND i.valor_fluxo_item > 0
        AND i.valor_pago_item > i.valor_fluxo_item + 0.001
      THEN i.valor_fluxo_item
      ELSE i.valor_pago_item
    END,
    0
  )::numeric(15, 2);
$$;

COMMENT ON FUNCTION public.receita_item_encargos(public.financeiro_parcelas_itens) IS
  'Encargos de boleto/juros: max(0, valor_pago_item − valor_fluxo_item) com fluxo > 0.';

COMMENT ON FUNCTION public.receita_item_recebido_liquido(public.financeiro_parcelas_itens) IS
  'Recebido líquido na cota (honorários), excluindo encargos quando pago > fluxo.';

GRANT EXECUTE ON FUNCTION public.receita_item_encargos(public.financeiro_parcelas_itens) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_recebido_liquido(public.financeiro_parcelas_itens) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.receita_totais_mensais(integer);
DROP FUNCTION IF EXISTS public.receita_recebido_itens(integer, integer, text);

CREATE OR REPLACE FUNCTION public.receita_totais_mensais(p_ano integer)
RETURNS TABLE (
  mes integer,
  recebido numeric,
  previsto numeric,
  encargos numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT i.*
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
  ),
  rec AS (
    SELECT
      EXTRACT(MONTH FROM data_pagamento)::integer AS mes,
      COALESCE(SUM(public.receita_item_recebido_liquido(i)), 0) AS total,
      COALESCE(SUM(public.receita_item_encargos(i)), 0) AS encargos
    FROM base i
    WHERE data_pagamento IS NOT NULL
      AND valor_pago_item IS NOT NULL
      AND valor_pago_item <> 0
      AND EXTRACT(YEAR FROM data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  prev AS (
    SELECT
      EXTRACT(MONTH FROM data_vencimento)::integer AS mes,
      COALESCE(SUM(valor_item), 0) AS total
    FROM base
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
    COALESCE(p.total, 0),
    COALESCE(r.encargos, 0)
  FROM meses m
  LEFT JOIN rec r ON r.mes = m.mes
  LEFT JOIN prev p ON p.mes = m.mes
  ORDER BY m.mes;
$$;

CREATE OR REPLACE FUNCTION public.receita_recebido_por_plano(p_ano integer, p_mes integer)
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
    COALESCE(SUM(public.receita_item_recebido_liquido(i)), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  GROUP BY i.plano_contas
  ORDER BY 3 DESC, i.plano_contas;
$$;

CREATE OR REPLACE FUNCTION public.receita_recebido_por_plano_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  plano_contas text,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM i.data_pagamento)::integer AS mes,
    public.canonical_plano_contas(i.plano_contas) AS plano_contas,
    COALESCE(SUM(public.receita_item_recebido_liquido(i)), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.receita_recebido_por_departamento_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  departamento text,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM i.data_pagamento)::integer AS mes,
    COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
    COALESCE(SUM(public.receita_item_recebido_liquido(i)), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
$$;

CREATE OR REPLACE FUNCTION public.receita_recebido_itens(
  p_ano integer,
  p_mes integer,
  p_plano_contas text
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  cliente text,
  descricao text,
  nro_titulo text,
  data_pagamento date,
  valor_recebido numeric,
  valor_encargos numeric,
  valor_pago_item numeric,
  valor_fluxo_item numeric,
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
    i.data_pagamento,
    public.receita_item_recebido_liquido(i) AS valor_recebido,
    public.receita_item_encargos(i) AS valor_encargos,
    i.valor_pago_item,
    i.valor_fluxo_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.plano_contas = p_plano_contas
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  ORDER BY public.receita_item_recebido_liquido(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

CREATE OR REPLACE FUNCTION public.receita_encargos_por_plano(p_ano integer, p_mes integer)
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
    COALESCE(SUM(public.receita_item_encargos(i)), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND public.receita_item_encargos(i) > 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  GROUP BY i.plano_contas
  HAVING COALESCE(SUM(public.receita_item_encargos(i)), 0) > 0
  ORDER BY 3 DESC, i.plano_contas;
$$;

CREATE OR REPLACE FUNCTION public.receita_encargos_itens(
  p_ano integer,
  p_mes integer,
  p_plano_contas text
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  cliente text,
  descricao text,
  nro_titulo text,
  data_pagamento date,
  valor_encargos numeric,
  valor_pago_item numeric,
  valor_fluxo_item numeric,
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
    i.data_pagamento,
    public.receita_item_encargos(i) AS valor_encargos,
    i.valor_pago_item,
    i.valor_fluxo_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.plano_contas = p_plano_contas
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND public.receita_item_encargos(i) > 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  ORDER BY public.receita_item_encargos(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_totais_mensais(integer) IS
  'Totais mensais: recebido líquido, previsto e encargos (boleto/juros) na cota.';

COMMENT ON FUNCTION public.receita_recebido_itens(integer, integer, text) IS
  'Itens pagos no mês/plano com recebido líquido, encargos e valores VIOS.';

COMMENT ON FUNCTION public.receita_encargos_por_plano(integer, integer) IS
  'Encargos de boleto/juros por plano no mês (cota).';

COMMENT ON FUNCTION public.receita_encargos_itens(integer, integer, text) IS
  'Itens com encargos no mês/plano para drill-down.';

GRANT EXECUTE ON FUNCTION public.receita_encargos_por_plano(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_encargos_itens(integer, integer, text) TO anon, authenticated;
