-- Cota de receita: inclui apenas planos de honorários definidos; demais planos ficam fora.

CREATE OR REPLACE FUNCTION public.receita_totais_mensais(p_ano integer)
RETURNS TABLE (
  mes integer,
  recebido numeric,
  previsto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH incluidos AS (
    SELECT unnest(ARRAY[
      'HONORÁRIOS MENSAIS',
      'HONORÁRIOS SPOT',
      'HONORÁRIOS DE SUCUMBÊNCIA',
      'HONORÁRIOS DE ÊXITO',
      'HONORÁRIOS DE MANUTENÇÃO',
      'HONORÁRIOS POR HORA TRABALHADA',
      'HONORARIOS ADVOCATICIOS',
      'HONORARIOS PARCERIAS',
      'HONORÁRIOS ADVOCATÍCIOS',
      'PARCERIAS'
    ]::text[]) AS plano
  ),
  base AS (
    SELECT *
    FROM financeiro_parcelas_itens i
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM incluidos inc
        WHERE upper(trim(i.plano_contas)) = upper(trim(inc.plano))
      )
  ),
  rec AS (
    SELECT
      EXTRACT(MONTH FROM data_pagamento)::integer AS mes,
      COALESCE(SUM(valor_pago_item), 0) AS total
    FROM base
    WHERE data_pagamento IS NOT NULL
      AND valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  prev AS (
    SELECT
      EXTRACT(MONTH FROM data_vencimento)::integer AS mes,
      COALESCE(SUM(valor_item), 0) AS total
    FROM base
    WHERE data_vencimento IS NOT NULL
      AND valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  meses AS (
    SELECT generate_series(1, 12) AS mes
  )
  SELECT
    m.mes,
    COALESCE(r.total, 0),
    COALESCE(p.total, 0)
  FROM meses m
  LEFT JOIN rec r ON r.mes = m.mes
  LEFT JOIN prev p ON p.mes = m.mes
  ORDER BY m.mes;
$$;

COMMENT ON FUNCTION public.receita_totais_mensais(integer) IS
  'Totais mensais de recebido e previsto considerando apenas planos de honorários da cota (whitelist).';
