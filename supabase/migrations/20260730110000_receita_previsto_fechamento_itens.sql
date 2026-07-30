-- Itens que compõem cada bucket do fechamento do previsto (validação).

CREATE OR REPLACE FUNCTION public.receita_previsto_fechamento_itens(
  p_ano integer,
  p_mes integer,
  p_bucket text
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
  WITH bounds AS (
    SELECT
      make_date(p_ano, p_mes, 1) AS mes_inicio,
      (date_trunc('month', make_date(p_ano, p_mes, 1)) + interval '1 month - 1 day')::date AS mes_fim
  )
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
  CROSS JOIN bounds b
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
    AND CASE p_bucket
      WHEN 'em_aberto' THEN i.data_pagamento IS NULL
      WHEN 'quitado_no_mes' THEN
        i.data_pagamento IS NOT NULL
        AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
        AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
      WHEN 'quitado_antecipado' THEN
        i.data_pagamento IS NOT NULL
        AND i.data_pagamento < b.mes_inicio
      WHEN 'quitado_pago_depois' THEN
        i.data_pagamento IS NOT NULL
        AND i.data_pagamento > b.mes_fim
      ELSE false
    END
  ORDER BY i.valor_item DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_previsto_fechamento_itens(integer, integer, text) IS
  'Itens do fechamento do previsto por bucket: em_aberto, quitado_no_mes, quitado_antecipado, quitado_pago_depois.';

GRANT EXECUTE ON FUNCTION public.receita_previsto_fechamento_itens(integer, integer, text) TO anon, authenticated;
