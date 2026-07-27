-- Receita: identificar entradas novas (contrato ou cliente/grupo) no mês do recebimento.

CREATE OR REPLACE FUNCTION public.receita_recebido_chave_cliente(p_cliente text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.receita_inadimplencia_chave_grupo(
    public.receita_grupo_cliente_canonico(p_cliente),
    COALESCE(NULLIF(trim(p_cliente), ''), 'Sem cliente')
  );
$$;

CREATE OR REPLACE FUNCTION public.receita_item_contrato_novo_mes(
  i public.financeiro_parcelas_itens,
  p_ano integer,
  p_mes integer
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    COALESCE(i.reincidencia_titulo, '') ~ '^1/'
    OR (
      i.data_cadastro_titulo IS NOT NULL
      AND EXTRACT(YEAR FROM i.data_cadastro_titulo)::integer = p_ano
      AND EXTRACT(MONTH FROM i.data_cadastro_titulo)::integer = p_mes
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.receita_item_cliente_novo_mes(
  i public.financeiro_parcelas_itens,
  p_ano integer,
  p_mes integer
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM financeiro_parcelas_itens prev
    WHERE (prev.tipo IS NULL OR prev.tipo = 'RECEBER')
      AND prev.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(prev.plano_contas)
      AND prev.data_pagamento IS NOT NULL
      AND prev.valor_pago_item IS NOT NULL
      AND prev.valor_pago_item <> 0
      AND public.receita_recebido_chave_cliente(prev.cliente)
        = public.receita_recebido_chave_cliente(i.cliente)
      AND prev.data_pagamento < make_date(p_ano, p_mes, 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.receita_item_entrada_nova_mes(
  i public.financeiro_parcelas_itens,
  p_ano integer,
  p_mes integer
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.receita_item_contrato_novo_mes(i, p_ano, p_mes)
    OR public.receita_item_cliente_novo_mes(i, p_ano, p_mes);
$$;

COMMENT ON FUNCTION public.receita_item_entrada_nova_mes(public.financeiro_parcelas_itens, integer, integer) IS
  'Contrato novo (1ª parcela ou cadastro do título no mês) ou 1º recebimento na cota do cliente/grupo.';

GRANT EXECUTE ON FUNCTION public.receita_recebido_chave_cliente(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_contrato_novo_mes(public.financeiro_parcelas_itens, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_cliente_novo_mes(public.financeiro_parcelas_itens, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_item_entrada_nova_mes(public.financeiro_parcelas_itens, integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.receita_recebido_itens_mes(
  p_ano integer,
  p_mes integer,
  p_somente_entrada_nova boolean DEFAULT false
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
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
    AND (
      NOT COALESCE(p_somente_entrada_nova, false)
      OR public.receita_item_entrada_nova_mes(i, p_ano, p_mes)
    )
  ORDER BY public.receita_item_recebido_liquido(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

CREATE OR REPLACE FUNCTION public.receita_recebido_itens_area(
  p_ano integer,
  p_mes integer,
  p_area_key text,
  p_somente_entrada_nova boolean DEFAULT false
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
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
    AND public.receita_departamento_norm_key(
      COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento')
    ) = lower(trim(p_area_key))
    AND (
      NOT COALESCE(p_somente_entrada_nova, false)
      OR public.receita_item_entrada_nova_mes(i, p_ano, p_mes)
    )
  ORDER BY public.receita_item_recebido_liquido(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

GRANT EXECUTE ON FUNCTION public.receita_recebido_itens_mes(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_recebido_itens_area(integer, integer, text, boolean) TO anon, authenticated;
