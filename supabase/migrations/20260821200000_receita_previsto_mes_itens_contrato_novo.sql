-- Marca previsto do mês como contrato novo: 1º pagamento na cota em M
-- ou, sem pagamento ainda, 1º vencimento na cota em M (contrato novo em aberto).

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
  departamento text,
  contrato_novo boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH primeiro_pagamento AS (
    SELECT
      public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente) AS chave_cliente,
      min(i.data_pagamento) AS primeira_data
    FROM financeiro_parcelas_itens i
    LEFT JOIN public.receita_grupo_por_nome_cliente gc
      ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
      AND i.data_pagamento IS NOT NULL
      AND i.valor_pago_item IS NOT NULL
      AND i.valor_pago_item <> 0
    GROUP BY 1
  ),
  primeiro_vencimento AS (
    SELECT
      public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente) AS chave_cliente,
      min(i.data_vencimento) AS primeiro_vencimento
    FROM financeiro_parcelas_itens i
    LEFT JOIN public.receita_grupo_por_nome_cliente gc
      ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
    WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
      AND i.plano_contas IS NOT NULL
      AND public.plano_contas_na_cota(i.plano_contas)
      AND i.data_vencimento IS NOT NULL
      AND i.valor_item IS NOT NULL
    GROUP BY 1
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
    NULLIF(TRIM(i.situacao_titulo), '') AS situacao_titulo,
    COALESCE(NULLIF(TRIM(i.departamento), ''), 'Sem departamento') AS departamento,
    (
      (
        pp.primeira_data IS NOT NULL
        AND EXTRACT(YEAR FROM pp.primeira_data)::integer = p_ano
        AND EXTRACT(MONTH FROM pp.primeira_data)::integer = p_mes
      )
      OR (
        pp.primeira_data IS NULL
        AND pv.primeiro_vencimento IS NOT NULL
        AND EXTRACT(YEAR FROM pv.primeiro_vencimento)::integer = p_ano
        AND EXTRACT(MONTH FROM pv.primeiro_vencimento)::integer = p_mes
      )
    ) AS contrato_novo
  FROM financeiro_parcelas_itens i
  INNER JOIN financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
  LEFT JOIN public.receita_grupo_por_nome_cliente gc
    ON gc.cliente_norm = lower(trim(COALESCE(i.cliente, '')))
  LEFT JOIN primeiro_pagamento pp
    ON pp.chave_cliente = public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente)
  LEFT JOIN primeiro_vencimento pv
    ON pv.chave_cliente = public.receita_recebido_chave_cliente_lookup(i.cliente, gc.grupo_cliente)
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
  'Itens previstos no mês, com departamento e contrato_novo (1º pagamento ou 1º vencimento na cota em M).';

GRANT EXECUTE ON FUNCTION public.receita_previsto_mes_itens(integer, integer) TO anon, authenticated;
