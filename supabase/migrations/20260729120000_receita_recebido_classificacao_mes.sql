-- Detalhe do recebido no mês classificado: inadimplência, novos contratos, receita do mês.

CREATE OR REPLACE FUNCTION public.receita_recebido_classificacao_mes(
  p_ano integer,
  p_mes integer
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  cliente text,
  descricao text,
  nro_titulo text,
  data_pagamento date,
  data_vencimento date,
  valor_recebido numeric,
  valor_encargos numeric,
  valor_pago_item numeric,
  valor_fluxo_item numeric,
  plano_contas text,
  situacao_titulo text,
  departamento text,
  categoria text
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
    public.receita_item_nro_titulo(i.nro_titulo, fp.nro_titulo) AS nro_titulo,
    i.data_pagamento,
    i.data_vencimento,
    public.receita_item_recebido_liquido(i) AS valor_recebido,
    public.receita_item_encargos(i) AS valor_encargos,
    i.valor_pago_item,
    i.valor_fluxo_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo,
    COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
    CASE
      WHEN pp.primeira_data IS NOT NULL
        AND EXTRACT(YEAR FROM pp.primeira_data)::integer = p_ano
        AND EXTRACT(MONTH FROM pp.primeira_data)::integer = p_mes
      THEN 'novos_contratos'
      WHEN i.data_vencimento IS NOT NULL
        AND i.data_vencimento < make_date(p_ano, p_mes, 1)
      THEN 'inadimplencia'
      ELSE 'receita_mes'
    END AS categoria
  FROM financeiro_parcelas_itens i
  INNER JOIN financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  LEFT JOIN public.receita_grupo_por_nome_cliente gc
    ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
  LEFT JOIN primeiro_pagamento pp
    ON pp.chave_cliente = public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente)
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  ORDER BY valor_recebido DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_recebido_classificacao_mes(integer, integer) IS
  'Itens recebidos no mês com classificação: novos_contratos (1º pagamento na cota), inadimplencia (vencimento anterior), receita_mes (demais).';

GRANT EXECUTE ON FUNCTION public.receita_recebido_classificacao_mes(integer, integer) TO anon, authenticated;
