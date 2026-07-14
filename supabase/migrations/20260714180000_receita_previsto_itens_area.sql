-- Itens previstos no mês filtrados por área (chave normalizada do departamento).
-- Usado no detalhe por grupo ao clicar no ponto de Previsto do gráfico por área.

CREATE OR REPLACE FUNCTION public.receita_previsto_itens_area(
  p_ano integer,
  p_mes integer,
  p_area_key text,
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
    public.receita_item_nro_titulo(i.nro_titulo, fp.nro_titulo) AS nro_titulo,
    i.data_vencimento,
    i.valor_item,
    i.plano_contas,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  INNER JOIN financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
    AND public.receita_departamento_norm_key(
      COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento')
    ) = lower(trim(p_area_key))
  ORDER BY i.valor_item DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_previsto_itens_area(integer, integer, text, boolean) IS
  'Itens previstos no mês da cota, filtrados pela chave normalizada da área (departamento).';

GRANT EXECUTE ON FUNCTION public.receita_previsto_itens_area(integer, integer, text, boolean) TO anon, authenticated;
