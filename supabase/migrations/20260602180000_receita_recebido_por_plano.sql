-- Descritivo de recebido por plano de contas (mesmo critério de receita_totais_mensais).

CREATE OR REPLACE FUNCTION public.receita_recebido_por_plano(p_ano integer, p_mes integer)
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
    COALESCE(SUM(i.valor_pago_item), 0) AS total
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
  GROUP BY i.plano_contas
  ORDER BY total DESC, i.plano_contas;
$$;

COMMENT ON FUNCTION public.receita_recebido_por_plano(integer, integer) IS
  'Breakdown mensal do recebido por plano de contas (cota, data_pagamento, valor_pago_item).';

GRANT EXECUTE ON FUNCTION public.receita_recebido_por_plano(integer, integer) TO anon, authenticated;
