-- Títulos do plano: respeitar o mês do drill-down e não repetir o orçamento do plano em cada linha.

CREATE OR REPLACE FUNCTION public.opex_plano_titulos(p_ano integer, p_grupo text, p_plano text, p_meses integer[] DEFAULT NULL, p_grupos_excluidos text[] DEFAULT NULL, p_planos_excluidos text[] DEFAULT NULL)
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
  valor_orcamento numeric,
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
      round(coalesce((
        SELECT sum(l.valor)
        FROM public.opex_orcamento_linha l
        WHERE l.ano = p_ano
          AND public.opex_mes_vencimento_no_periodo(l.mes, p_meses)
          AND public.opex_orcamento_no_painel(l.grupo_conta, l.plano_contas, p_grupos_excluidos, p_planos_excluidos)
          AND l.grupo_conta = coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo')
          AND l.plano_contas = coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano')
          AND nullif(trim(l.titulo_ref), '') IS NOT NULL
          AND trim(l.titulo_ref) NOT IN ('—', '-', 'Sem descrição', 'Sem título')
          AND (
            trim(l.titulo_ref) = nullif(trim(i.nro_titulo), '')
            OR trim(l.titulo_ref) = nullif(trim(i.descricao), '')
          )
      ), 0)::numeric, 2) AS valor_orcamento,
      round(CASE
        WHEN i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
          AND public.opex_mes_pagamento_no_periodo(extract(month FROM i.data_pagamento)::int, p_meses, ctx.mes_atual)
        THEN public.opex_valor_pago(i) ELSE 0 END::numeric, 2) AS valor_realizado
    FROM financeiro_parcelas_itens i
    CROSS JOIN ctx
    WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
      AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
      AND coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') = p_plano
      AND (
        NOT public.opex_tem_filtro_meses(p_meses)
        OR (
          i.data_pagamento IS NOT NULL
          AND extract(year FROM i.data_pagamento)::int = p_ano
          AND public.opex_mes_pagamento_no_periodo(extract(month FROM i.data_pagamento)::int, p_meses, ctx.mes_atual)
        )
        OR (
          i.data_vencimento IS NOT NULL
          AND extract(year FROM i.data_vencimento)::int = p_ano
          AND public.opex_mes_vencimento_no_periodo(extract(month FROM i.data_vencimento)::int, p_meses)
        )
      )
  ) sub
  WHERE sub.valor_previsto > 0
    OR sub.valor_orcamento > 0
    OR sub.valor_realizado > 0
  ORDER BY greatest(sub.valor_previsto, sub.valor_orcamento, sub.valor_realizado) DESC,
    sub.data_vencimento DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.opex_plano_titulos(integer, text, text, integer[], text[], text[]) TO anon, authenticated;
