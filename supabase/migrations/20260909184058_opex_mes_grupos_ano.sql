-- Drill anual: p_mes nulo soma o ano (realizado YTD, orçamento do ano),
-- mesma regra de opex_planos_grupo / opex_plano_titulos com p_meses nulo.

CREATE OR REPLACE FUNCTION public.opex_mes_grupos(
  p_ano integer,
  p_mes integer DEFAULT NULL,
  p_grupos_excluidos text[] DEFAULT NULL,
  p_planos_excluidos text[] DEFAULT NULL
)
RETURNS TABLE (
  grupo_conta text,
  fixo boolean,
  previsto numeric,
  previsto_vios numeric,
  realizado numeric,
  variacao numeric
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
  ),
  vios AS (
    SELECT
      coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
      public.opex_grupo_fixo(i.grupo_conta) AS fixo,
      round(sum(public.opex_valor_item(i)) FILTER (
        WHERE i.data_vencimento IS NOT NULL
          AND extract(year FROM i.data_vencimento)::int = p_ano
          AND (
            p_mes IS NOT NULL AND extract(month FROM i.data_vencimento)::int = p_mes
            OR p_mes IS NULL AND public.opex_mes_vencimento_no_periodo(
              extract(month FROM i.data_vencimento)::int, NULL
            )
          )
      )::numeric, 2) AS previsto_vios,
      round(sum(public.opex_valor_pago(i)) FILTER (
        WHERE i.data_pagamento IS NOT NULL
          AND extract(year FROM i.data_pagamento)::int = p_ano
          AND (
            p_mes IS NOT NULL AND extract(month FROM i.data_pagamento)::int = p_mes
            OR p_mes IS NULL AND public.opex_mes_pagamento_no_periodo(
              extract(month FROM i.data_pagamento)::int, NULL, ctx.mes_atual
            )
          )
      )::numeric, 2) AS realizado
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
    GROUP BY 1, 2
  ),
  orc AS (
    SELECT
      l.grupo_conta,
      bool_or(l.fixo) AS fixo,
      round(sum(l.valor), 2)::numeric(15, 2) AS previsto_orc
    FROM public.opex_orcamento_linha l
    WHERE l.ano = p_ano
      AND (
        p_mes IS NOT NULL AND l.mes = p_mes
        OR p_mes IS NULL AND public.opex_mes_vencimento_no_periodo(l.mes, NULL)
      )
      AND public.opex_orcamento_no_painel(l.grupo_conta, l.plano_contas, p_grupos_excluidos, p_planos_excluidos)
    GROUP BY l.grupo_conta
  ),
  merged AS (
    SELECT
      coalesce(v.grupo_conta, o.grupo_conta) AS grupo_conta,
      coalesce(v.fixo, o.fixo, false) AS fixo,
      CASE
        WHEN public.opex_tem_orcamento(p_ano) THEN coalesce(o.previsto_orc, 0)
        ELSE coalesce(v.previsto_vios, 0)
      END AS previsto,
      coalesce(v.previsto_vios, 0) AS previsto_vios,
      coalesce(v.realizado, 0) AS realizado
    FROM vios v
    FULL OUTER JOIN orc o ON o.grupo_conta = v.grupo_conta
  )
  SELECT
    m.grupo_conta,
    m.fixo,
    m.previsto,
    m.previsto_vios,
    m.realizado,
    round((m.realizado - m.previsto)::numeric, 2) AS variacao
  FROM merged m
  WHERE m.previsto > 0 OR m.previsto_vios > 0 OR m.realizado > 0
  ORDER BY greatest(m.previsto, m.realizado) DESC;
$$;

COMMENT ON FUNCTION public.opex_mes_grupos(integer, integer, text[], text[]) IS
  'Grupos do mês (p_mes) ou do ano (p_mes nulo: realizado YTD, orçamento anual).';
