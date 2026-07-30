-- Itens previstos no mês (vencimento no mês) — detalhe por grupo no sheet de visão gerencial.

CREATE OR REPLACE FUNCTION public.receita_previsto_mes_itens(
  p_ano integer,
  p_mes integer
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  cliente text,
  descricao text,
  nro_titulo text,
  data_vencimento date,
  data_pagamento date,
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
    public.receita_item_nro_titulo(i.nro_titulo, fp.nro_titulo) AS nro_titulo,
    i.data_vencimento,
    i.data_pagamento,
    i.valor_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  INNER JOIN financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
  ORDER BY i.valor_item DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_previsto_mes_itens(integer, integer) IS
  'Todos os itens com vencimento no mês (base previsto). Inclui data_pagamento para quitado vs em aberto.';

GRANT EXECUTE ON FUNCTION public.receita_previsto_mes_itens(integer, integer) TO anon, authenticated;
