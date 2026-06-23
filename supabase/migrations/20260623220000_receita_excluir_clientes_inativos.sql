-- Módulo Receita: exclui clientes/grupos inativos (mesmo critério do Escritório).
-- Reverte inclusão histórica de 20260622220000_receita_inadimplencia_incluir_inativos.

CREATE OR REPLACE VIEW public.receita_itens_inadimplencia_elegiveis AS
SELECT
  i.id,
  i.ci_item,
  i.ci_titulo,
  i.cliente,
  i.plano_contas,
  i.tipo,
  i.valor_item,
  i.valor_parcial_aberto,
  i.valor_pago_item,
  i.situacao_titulo,
  i.data_vencimento,
  i.data_pagamento,
  fp.pessoa_id,
  COALESCE(
    gc.grupo_cliente,
    NULLIF(trim(p.grupo_cliente), ''),
    'Sem grupo'
  ) AS grupo_cliente,
  p.categoria
FROM public.financeiro_parcelas_itens i
INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
LEFT JOIN public.pessoas p ON p.id = fp.pessoa_id
LEFT JOIN public.receita_grupo_por_nome_cliente gc
  ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
  AND public.plano_contas_na_cota(i.plano_contas)
  AND public.receita_item_cliente_ativo(i);

COMMENT ON VIEW public.receita_itens_inadimplencia_elegiveis IS
  'Base da inadimplência na Receita: planos da cota, grupo canônico, somente clientes ativos.';

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
  WITH base AS (
    SELECT i.*
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
      AND public.receita_item_cliente_ativo(i)
  ),
  rec AS (
    SELECT
      EXTRACT(MONTH FROM data_pagamento)::integer AS mes,
      COALESCE(SUM(valor_pago_item), 0) AS total
    FROM base
    WHERE data_pagamento IS NOT NULL
      AND valor_pago_item IS NOT NULL
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
    COALESCE(p.total, 0)
  FROM meses m
  LEFT JOIN rec r ON r.mes = m.mes
  LEFT JOIN prev p ON p.mes = m.mes
  ORDER BY m.mes;
$$;

COMMENT ON FUNCTION public.receita_totais_mensais(integer) IS
  'Totais mensais de recebido e previsto (cota de honorários), excluindo clientes/grupos inativos.';

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
    COALESCE(SUM(i.valor_pago_item), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_cliente_ativo(i)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  GROUP BY i.plano_contas
  ORDER BY total DESC, i.plano_contas;
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
    COALESCE(SUM(i.valor_pago_item), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_cliente_ativo(i)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
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
    COALESCE(SUM(i.valor_pago_item), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_cliente_ativo(i)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
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
  valor_pago_item numeric,
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
    i.valor_pago_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_cliente_ativo(i)
    AND i.plano_contas = p_plano_contas
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  ORDER BY i.valor_pago_item DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_recebido_por_plano(integer, integer) IS
  'Breakdown mensal do recebido por plano (cota, clientes ativos).';

COMMENT ON FUNCTION public.receita_recebido_por_plano_mensal(integer) IS
  'Recebido por mês e plano (cota, clientes ativos).';

COMMENT ON FUNCTION public.receita_recebido_por_departamento_mensal(integer) IS
  'Recebido por mês e departamento (cota, clientes ativos).';

COMMENT ON FUNCTION public.receita_recebido_itens(integer, integer, text) IS
  'Itens pagos no mês/plano (cota, clientes ativos).';
