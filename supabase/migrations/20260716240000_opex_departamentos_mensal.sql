-- OPEX por departamento × mês (previsto por vencimento, realizado por pagamento).

CREATE OR REPLACE FUNCTION public.opex_departamentos_mensal(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_somente_fixas boolean DEFAULT false
)
RETURNS TABLE (
  mes integer,
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
  realizado_mes AS (
    SELECT
      extract(month FROM i.data_pagamento)::int AS mes,
      coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_elegivel(i)
      AND (NOT p_somente_fixas OR public.opex_grupo_fixo(i.grupo_conta))
      AND i.data_pagamento IS NOT NULL
      AND extract(year FROM i.data_pagamento)::int = p_ano
      AND public.opex_mes_pagamento_no_periodo(
        extract(month FROM i.data_pagamento)::int, p_meses, ctx.mes_atual
      )
    GROUP BY 1, 2
  ),
  previsto_mes AS (
    SELECT
      extract(month FROM i.data_vencimento)::int AS mes,
      coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') AS departamento,
      round(sum(public.opex_valor_item(i))::numeric, 2) AS previsto
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_elegivel(i)
      AND (NOT p_somente_fixas OR public.opex_grupo_fixo(i.grupo_conta))
      AND i.data_vencimento IS NOT NULL
      AND extract(year FROM i.data_vencimento)::int = p_ano
      AND public.opex_mes_vencimento_no_periodo(
        extract(month FROM i.data_vencimento)::int, p_meses
      )
    GROUP BY 1, 2
  ),
  chaves AS (
    SELECT mes, departamento FROM realizado_mes
    UNION
    SELECT mes, departamento FROM previsto_mes
  )
  SELECT
    k.mes,
    k.departamento,
    coalesce(r.realizado, 0) AS realizado,
    coalesce(p.previsto, 0) AS previsto
  FROM chaves k
  LEFT JOIN realizado_mes r USING (mes, departamento)
  LEFT JOIN previsto_mes p USING (mes, departamento)
  WHERE coalesce(r.realizado, 0) > 0 OR coalesce(p.previsto, 0) > 0
  ORDER BY k.mes, k.departamento;
$$;

COMMENT ON FUNCTION public.opex_departamentos_mensal(integer, integer[], boolean) IS
  'OPEX por departamento e mês: previsto (vencimento) e realizado (pagamento).';

GRANT EXECUTE ON FUNCTION public.opex_departamentos_mensal(integer, integer[], boolean) TO anon, authenticated;
