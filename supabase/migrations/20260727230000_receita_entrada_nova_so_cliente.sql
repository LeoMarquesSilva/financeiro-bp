-- Corrige "Novos no mês": só cliente/grupo com 1º recebimento na cota no mês
-- (não inclui 1ª parcela de contrato novo de cliente já existente).

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
  WITH primeiro_pagamento AS (
    SELECT
      public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente) AS chave_cliente,
      min(i.data_pagamento) AS primeira_data
    FROM financeiro_parcelas_itens i
    LEFT JOIN public.receita_grupo_por_nome_cliente gc
      ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
      AND i.data_pagamento IS NOT NULL
      AND i.valor_pago_item IS NOT NULL
      AND i.valor_pago_item <> 0
    GROUP BY 1
  )
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
  LEFT JOIN public.receita_grupo_por_nome_cliente gc
    ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
  INNER JOIN primeiro_pagamento pp
    ON pp.chave_cliente = public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente)
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
      OR (
        EXTRACT(YEAR FROM pp.primeira_data)::integer = p_ano
        AND EXTRACT(MONTH FROM pp.primeira_data)::integer = p_mes
      )
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
  WITH primeiro_pagamento AS (
    SELECT
      public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente) AS chave_cliente,
      min(i.data_pagamento) AS primeira_data
    FROM financeiro_parcelas_itens i
    LEFT JOIN public.receita_grupo_por_nome_cliente gc
      ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
      AND i.data_pagamento IS NOT NULL
      AND i.valor_pago_item IS NOT NULL
      AND i.valor_pago_item <> 0
    GROUP BY 1
  )
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
  LEFT JOIN public.receita_grupo_por_nome_cliente gc
    ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
  INNER JOIN primeiro_pagamento pp
    ON pp.chave_cliente = public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente)
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
      OR (
        EXTRACT(YEAR FROM pp.primeira_data)::integer = p_ano
        AND EXTRACT(MONTH FROM pp.primeira_data)::integer = p_mes
      )
    )
  ORDER BY public.receita_item_recebido_liquido(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_item_entrada_nova_mes(public.financeiro_parcelas_itens, integer, integer) IS
  'Legado: preferir filtro p_somente_entrada_nova nas RPCs (1º recebimento na cota do cliente/grupo no mês).';
