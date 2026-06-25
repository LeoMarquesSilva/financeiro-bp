-- OPEX: detalhamento de títulos por plano de contas.

CREATE OR REPLACE FUNCTION public.opex_plano_titulos(
  p_ano integer,
  p_grupo text,
  p_plano text,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  ci_item integer,
  nro_titulo text,
  descricao text,
  fornecedor text,
  situacao_titulo text,
  departamento text,
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
  WITH ctx AS (
    SELECT CASE
      WHEN p_ano < extract(year FROM current_date)::int THEN 12
      WHEN p_ano > extract(year FROM current_date)::int THEN 0
      ELSE extract(month FROM current_date)::int
    END AS mes_atual
  )
  SELECT *
  FROM (
    SELECT
      i.ci_item,
      coalesce(nullif(trim(i.nro_titulo), ''), '—') AS nro_titulo,
      coalesce(nullif(trim(i.descricao), ''), nullif(trim(i.nro_titulo), ''), 'Sem descrição') AS descricao,
      coalesce(
        nullif(trim(i.terceiros_item), ''),
        nullif(trim(i.terceiro_titulo), ''),
        nullif(trim(i.cliente), ''),
        '—'
      ) AS fornecedor,
      coalesce(nullif(trim(i.situacao_titulo), ''), '—') AS situacao_titulo,
      coalesce(nullif(trim(i.departamento), ''), '—') AS departamento,
      i.data_vencimento,
      i.data_pagamento,
      round(
        CASE
          WHEN i.data_vencimento IS NOT NULL
            AND extract(year FROM i.data_vencimento)::int = p_ano
            AND (p_mes IS NULL OR extract(month FROM i.data_vencimento)::int = p_mes)
          THEN public.opex_valor_item(i)
          ELSE 0
        END::numeric, 2
      ) AS valor_previsto,
      round(
        CASE
          WHEN i.data_pagamento IS NOT NULL
            AND extract(year FROM i.data_pagamento)::int = p_ano
            AND (
              (p_mes IS NOT NULL AND extract(month FROM i.data_pagamento)::int = p_mes)
              OR (p_mes IS NULL AND (ctx.mes_atual = 0 OR extract(month FROM i.data_pagamento)::int <= ctx.mes_atual))
            )
          THEN public.opex_valor_pago(i)
          ELSE 0
        END::numeric, 2
      ) AS valor_realizado
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_elegivel(i)
      AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
      AND coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') = p_plano
  ) sub
  WHERE sub.valor_previsto > 0 OR sub.valor_realizado > 0
  ORDER BY greatest(sub.valor_previsto, sub.valor_realizado) DESC, sub.data_vencimento DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.opex_plano_titulos(integer, text, text, integer) IS
  'Títulos/itens OPEX de um plano de contas com vencimento, pagamento e valores.';

GRANT EXECUTE ON FUNCTION public.opex_plano_titulos(integer, text, text, integer) TO anon, authenticated;
