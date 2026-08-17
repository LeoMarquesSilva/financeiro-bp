-- Inclui departamento nos itens previstos do mês (área dominante nos top contratos da apresentação).

DROP FUNCTION IF EXISTS public.receita_previsto_mes_itens(integer, integer);

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
  situacao_titulo text,
  departamento text
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
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo,
    COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento
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
  'Itens previstos no mês (base previsto), com departamento para rateio/área.';

GRANT EXECUTE ON FUNCTION public.receita_previsto_mes_itens(integer, integer) TO anon, authenticated;
