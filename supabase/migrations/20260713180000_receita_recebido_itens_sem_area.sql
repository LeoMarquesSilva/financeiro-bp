-- Drill-down dos títulos recebidos cujo departamento não entra no rateio por área
-- (5 áreas fixas em RECEITA_META_CONTRIBUICAO_AREA: Insolvência, Trabalhista, Cível,
-- Contratos, Recuperação de Crédito). Mantenha esta lista em sincronia com o front-end.

CREATE OR REPLACE FUNCTION public.receita_recebido_itens_sem_area(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  cliente text,
  descricao text,
  nro_titulo text,
  data_pagamento date,
  valor_recebido numeric,
  valor_pago_item numeric,
  plano_contas text,
  departamento text,
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
    i.data_pagamento,
    public.receita_item_recebido_liquido(i) AS valor_recebido,
    i.valor_pago_item,
    i.plano_contas,
    COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  INNER JOIN financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes)
    AND lower(trim(COALESCE(i.departamento, ''))) NOT IN (
      'insolvência', 'trabalhista', 'cível', 'contratos', 'recuperação de crédito'
    )
  ORDER BY public.receita_item_recebido_liquido(i) DESC NULLS LAST, i.cliente NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.receita_recebido_itens_sem_area(integer, integer) IS
  'Itens recebidos cujo departamento não é uma das 5 áreas do rateio (RECEITA_META_CONTRIBUICAO_AREA); p_mes nulo = ano todo.';

GRANT EXECUTE ON FUNCTION public.receita_recebido_itens_sem_area(integer, integer) TO anon, authenticated;
