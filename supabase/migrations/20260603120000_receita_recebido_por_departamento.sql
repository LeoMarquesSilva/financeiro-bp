-- Recebido mensal por departamento (área) para gráfico de colunas empilhadas.

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
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
$$;

COMMENT ON FUNCTION public.receita_recebido_por_departamento_mensal(integer) IS
  'Recebido por mês e departamento (área) para gráfico de colunas empilhadas na Receita.';

GRANT EXECUTE ON FUNCTION public.receita_recebido_por_departamento_mensal(integer) TO anon, authenticated;
