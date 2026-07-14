-- Previsto mensal por área (departamento), para o gráfico de linha por área da Receita.

CREATE OR REPLACE FUNCTION public.receita_previsto_por_departamento_mensal(
  p_ano integer,
  p_incluir_inativos boolean DEFAULT true
)
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
    EXTRACT(MONTH FROM i.data_vencimento)::integer AS mes,
    COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
    COALESCE(SUM(i.valor_item), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND (p_incluir_inativos OR public.receita_item_cliente_ativo(i))
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
$$;

COMMENT ON FUNCTION public.receita_previsto_por_departamento_mensal(integer, boolean) IS
  'Previsto mensal por área (departamento) — usado no gráfico de linha por área da Receita.';

GRANT EXECUTE ON FUNCTION public.receita_previsto_por_departamento_mensal(integer, boolean) TO anon, authenticated;
