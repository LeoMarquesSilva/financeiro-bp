-- Drill-down OPEX por departamento: grupos, planos e títulos.

CREATE OR REPLACE FUNCTION public.opex_departamento_grupos(
  p_ano integer,
  p_departamento text,
  p_meses integer[] DEFAULT NULL,
  p_somente_fixas boolean DEFAULT false
)
RETURNS TABLE (
  grupo_conta text,
  fixo boolean,
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
  )
  SELECT
    coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
    public.opex_grupo_fixo(i.grupo_conta) AS fixo,
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
    AND coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') = p_departamento
  GROUP BY 1, 2
  HAVING coalesce(sum(public.opex_valor_pago(i)) FILTER (
      WHERE i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
    ), 0) > 0
    OR coalesce(sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano
    ), 0) > 0
  ORDER BY greatest(
    coalesce(sum(public.opex_valor_pago(i)) FILTER (
      WHERE i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
    ), 0),
    coalesce(sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano
    ), 0)
  ) DESC, 1;
$$;

CREATE OR REPLACE FUNCTION public.opex_departamento_planos(
  p_ano integer,
  p_departamento text,
  p_grupo text,
  p_meses integer[] DEFAULT NULL,
  p_somente_fixas boolean DEFAULT false
)
RETURNS TABLE (
  plano_contas text,
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
  )
  SELECT
    coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') AS plano_contas,
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
    AND coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') = p_departamento
    AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
  GROUP BY 1
  HAVING coalesce(sum(public.opex_valor_pago(i)) FILTER (
      WHERE i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
    ), 0) > 0
    OR coalesce(sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano
    ), 0) > 0
  ORDER BY greatest(
    coalesce(sum(public.opex_valor_pago(i)) FILTER (
      WHERE i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
    ), 0),
    coalesce(sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano
    ), 0)
  ) DESC, 1;
$$;

CREATE OR REPLACE FUNCTION public.opex_departamento_titulos(
  p_ano integer,
  p_departamento text,
  p_grupo text,
  p_plano text,
  p_meses integer[] DEFAULT NULL,
  p_somente_fixas boolean DEFAULT false
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
      coalesce(nullif(trim(i.terceiros_item), ''), nullif(trim(i.terceiro_titulo), ''),
        nullif(trim(i.cliente), ''), '—') AS fornecedor,
      coalesce(nullif(trim(i.situacao_titulo), ''), '—') AS situacao_titulo,
      coalesce(nullif(trim(i.departamento), ''), '—') AS departamento,
      i.data_vencimento,
      i.data_pagamento,
      round(CASE
        WHEN i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano
          AND public.opex_mes_vencimento_no_periodo(extract(month FROM i.data_vencimento)::int, p_meses)
        THEN public.opex_valor_item(i) ELSE 0 END::numeric, 2) AS valor_previsto,
      round(CASE
        WHEN i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
          AND public.opex_mes_pagamento_no_periodo(extract(month FROM i.data_pagamento)::int, p_meses, ctx.mes_atual)
        THEN public.opex_valor_pago(i) ELSE 0 END::numeric, 2) AS valor_realizado
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_elegivel(i)
      AND (NOT p_somente_fixas OR public.opex_grupo_fixo(i.grupo_conta))
      AND coalesce(nullif(trim(i.departamento), ''), 'Sem departamento') = p_departamento
      AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
      AND coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') = p_plano
  ) sub
  WHERE sub.valor_previsto > 0 OR sub.valor_realizado > 0
  ORDER BY greatest(sub.valor_previsto, sub.valor_realizado) DESC, sub.data_vencimento DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.opex_departamento_grupos(integer, text, integer[], boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_departamento_planos(integer, text, text, integer[], boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opex_departamento_titulos(integer, text, text, text, integer[], boolean) TO anon, authenticated;
