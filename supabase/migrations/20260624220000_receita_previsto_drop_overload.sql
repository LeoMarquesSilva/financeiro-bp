-- PostgREST não resolve overload quando existem 2 e 3 parâmetros; remove versões antigas.

DROP FUNCTION IF EXISTS public.receita_previsto_por_plano(integer, integer);
DROP FUNCTION IF EXISTS public.receita_previsto_itens(integer, integer, text);

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

GRANT EXECUTE ON FUNCTION public.receita_previsto_por_plano(integer, integer, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_previsto_itens(integer, integer, text, boolean) TO anon, authenticated;
