-- OPEX metas: busca e leitura de títulos VIOS para vínculo com iniciativas estratégicas.

CREATE OR REPLACE FUNCTION public.opex_buscar_titulos(
  p_ano integer,
  p_busca text DEFAULT '',
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  nro_titulo text,
  descricao text,
  fornecedor text,
  grupo_conta text,
  plano_contas text,
  valor_previsto numeric,
  valor_realizado numeric,
  data_vencimento date,
  data_pagamento date,
  situacao_titulo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH termo AS (
    SELECT '%' || lower(trim(coalesce(p_busca, ''))) || '%' AS q
  )
  SELECT *
  FROM (
    SELECT
      i.ci_item,
      i.ci_titulo,
      coalesce(nullif(trim(i.nro_titulo), ''), '—') AS nro_titulo,
      coalesce(nullif(trim(i.descricao), ''), nullif(trim(i.nro_titulo), ''), 'Sem descrição') AS descricao,
      coalesce(
        nullif(trim(i.terceiros_item), ''),
        nullif(trim(i.terceiro_titulo), ''),
        nullif(trim(i.cliente), ''),
        '—'
      ) AS fornecedor,
      coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
      coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') AS plano_contas,
      round(
        CASE
          WHEN i.data_vencimento IS NOT NULL
            AND extract(year FROM i.data_vencimento)::int = p_ano
          THEN public.opex_valor_item(i)
          ELSE 0
        END::numeric, 2
      ) AS valor_previsto,
      round(
        CASE
          WHEN i.data_pagamento IS NOT NULL
            AND extract(year FROM i.data_pagamento)::int = p_ano
          THEN public.opex_valor_pago(i)
          ELSE 0
        END::numeric, 2
      ) AS valor_realizado,
      i.data_vencimento,
      i.data_pagamento,
      coalesce(nullif(trim(i.situacao_titulo), ''), '—') AS situacao_titulo
    FROM financeiro_parcelas_itens i
    CROSS JOIN termo t
    WHERE public.opex_item_elegivel(i)
      AND (
        trim(coalesce(p_busca, '')) = ''
        OR lower(coalesce(i.nro_titulo, '')) LIKE t.q
        OR lower(coalesce(i.descricao, '')) LIKE t.q
        OR lower(coalesce(i.terceiros_item, '')) LIKE t.q
        OR lower(coalesce(i.terceiro_titulo, '')) LIKE t.q
        OR lower(coalesce(i.grupo_conta, '')) LIKE t.q
        OR lower(coalesce(i.plano_contas, '')) LIKE t.q
      )
      AND (
        (i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano)
        OR (i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano)
      )
  ) sub
  WHERE sub.valor_previsto > 0 OR sub.valor_realizado > 0
  ORDER BY greatest(sub.valor_previsto, sub.valor_realizado) DESC, sub.descricao
  LIMIT greatest(1, least(coalesce(p_limit, 25), 50));
$$;

GRANT EXECUTE ON FUNCTION public.opex_buscar_titulos(integer, text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.opex_titulos_ci_itens(p_ci_itens integer[])
RETURNS TABLE (
  ci_item integer,
  ci_titulo integer,
  nro_titulo text,
  descricao text,
  fornecedor text,
  grupo_conta text,
  plano_contas text,
  valor_previsto numeric,
  valor_realizado numeric,
  data_vencimento date,
  data_pagamento date,
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
    coalesce(nullif(trim(i.nro_titulo), ''), '—') AS nro_titulo,
    coalesce(nullif(trim(i.descricao), ''), nullif(trim(i.nro_titulo), ''), 'Sem descrição') AS descricao,
    coalesce(
      nullif(trim(i.terceiros_item), ''),
      nullif(trim(i.terceiro_titulo), ''),
      nullif(trim(i.cliente), ''),
      '—'
    ) AS fornecedor,
    coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
    coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') AS plano_contas,
    round(public.opex_valor_item(i)::numeric, 2) AS valor_previsto,
    round(public.opex_valor_pago(i)::numeric, 2) AS valor_realizado,
    i.data_vencimento,
    i.data_pagamento,
    coalesce(nullif(trim(i.situacao_titulo), ''), '—') AS situacao_titulo
  FROM financeiro_parcelas_itens i
  WHERE public.opex_item_elegivel(i)
    AND p_ci_itens IS NOT NULL
    AND array_length(p_ci_itens, 1) > 0
    AND i.ci_item = ANY(p_ci_itens)
  ORDER BY array_position(p_ci_itens, i.ci_item);
$$;

GRANT EXECUTE ON FUNCTION public.opex_titulos_ci_itens(integer[]) TO anon, authenticated;
