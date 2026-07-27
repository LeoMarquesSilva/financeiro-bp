-- Itens recebidos no mês (cota), sem filtro de área — detalhe por grupo/plano no gráfico de colunas.

CREATE OR REPLACE FUNCTION public.receita_recebido_itens_mes(
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
  ORDER BY public.receita_item_recebido_liquido(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_recebido_itens_mes(integer, integer) IS
  'Itens recebidos no mês da cota, sem filtro de área (detalhe consolidado por grupo/plano).';

GRANT EXECUTE ON FUNCTION public.receita_recebido_itens_mes(integer, integer) TO anon, authenticated;
