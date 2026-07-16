-- Custos OPEX agregados por departamento (mesma regra de período do dashboard).

CREATE OR REPLACE FUNCTION public.opex_departamentos(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_somente_fixas boolean DEFAULT false
)
RETURNS TABLE (
  departamento text,
  realizado numeric,
  previsto numeric
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
  agg AS (
    SELECT
      coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      round(sum(public.opex_valor_pago(i)) FILTER (
        WHERE i.data_pagamento IS NOT NULL
          AND extract(year FROM i.data_pagamento)::int = p_ano
          AND public.opex_mes_pagamento_no_periodo(
            extract(month FROM i.data_pagamento)::int, p_meses, ctx.mes_atual
          )
      )::numeric, 2) AS realizado,
      round(sum(public.opex_valor_item(i)) FILTER (
        WHERE i.data_vencimento IS NOT NULL
          AND extract(year FROM i.data_vencimento)::int = p_ano
          AND public.opex_mes_vencimento_no_periodo(
            extract(month FROM i.data_vencimento)::int, p_meses
          )
      )::numeric, 2) AS previsto
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_elegivel(i)
      AND (NOT p_somente_fixas OR public.opex_grupo_fixo(i.grupo_conta))
    GROUP BY 1
  )
  SELECT a.departamento, a.realizado, a.previsto
  FROM agg a
  WHERE coalesce(a.realizado, 0) > 0 OR coalesce(a.previsto, 0) > 0
  ORDER BY greatest(coalesce(a.realizado, 0), coalesce(a.previsto, 0)) DESC, a.departamento;
$$;

COMMENT ON FUNCTION public.opex_departamentos(integer, integer[], boolean) IS
  'OPEX por departamento: previsto (vencimento) e realizado (pagamento) no período selecionado.';

GRANT EXECUTE ON FUNCTION public.opex_departamentos(integer, integer[], boolean) TO anon, authenticated;
