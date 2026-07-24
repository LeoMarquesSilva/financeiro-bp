-- Itens OPEX de um mês (exportação e validação de previsto x realizado).

CREATE OR REPLACE FUNCTION public.opex_mes_itens(p_ano integer, p_mes integer)
RETURNS TABLE (
  grupo_conta text,
  plano_contas text,
  conta_numero text,
  fixo boolean,
  ci_item integer,
  ci_titulo integer,
  nro_titulo text,
  descricao text,
  fornecedor text,
  departamento text,
  situacao_titulo text,
  data_vencimento date,
  data_pagamento date,
  valor_previsto numeric,
  valor_realizado numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM (
    SELECT
      coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
      coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') AS plano_contas,
      coalesce(nullif(trim(i.conta_numero), ''), '') AS conta_numero,
      public.opex_grupo_fixo(i.grupo_conta) AS fixo,
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
      coalesce(nullif(trim(i.departamento), ''), '—') AS departamento,
      coalesce(nullif(trim(i.situacao_titulo), ''), '—') AS situacao_titulo,
      i.data_vencimento,
      i.data_pagamento,
      round(CASE
        WHEN i.data_vencimento IS NOT NULL
          AND extract(year FROM i.data_vencimento)::int = p_ano
          AND extract(month FROM i.data_vencimento)::int = p_mes
        THEN public.opex_valor_item(i)
        ELSE 0
      END::numeric, 2) AS valor_previsto,
      round(CASE
        WHEN i.data_pagamento IS NOT NULL
          AND extract(year FROM i.data_pagamento)::int = p_ano
          AND extract(month FROM i.data_pagamento)::int = p_mes
        THEN public.opex_valor_pago(i)
        ELSE 0
      END::numeric, 2) AS valor_realizado
    FROM financeiro_parcelas_itens i
    WHERE public.opex_item_elegivel(i)
  ) sub
  WHERE sub.valor_previsto > 0 OR sub.valor_realizado > 0
  ORDER BY
    sub.grupo_conta,
    sub.plano_contas,
    greatest(sub.valor_previsto, sub.valor_realizado) DESC,
    sub.data_vencimento DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.opex_mes_itens(integer, integer) IS
  'Itens OPEX elegíveis de um mês com grupo macro, plano mínimo e valores previsto/realizado por CI item.';

GRANT EXECUTE ON FUNCTION public.opex_mes_itens(integer, integer) TO anon, authenticated;
