-- Lançamentos OPEX do período do painel (um CI item por linha).
-- Previsto VIOS e realizado só entram no mês que cai no recorte (filtro ou YTD),
-- para a soma bater com os cards. Plano/subplano seguem o filtro do painel.

CREATE OR REPLACE FUNCTION public.opex_lancamentos_periodo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_grupos_excluidos text[] DEFAULT NULL,
  p_planos_excluidos text[] DEFAULT NULL
)
RETURNS TABLE (
  mes_vencimento integer,
  mes_pagamento integer,
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
  valor_previsto_vios numeric,
  valor_realizado numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT CASE
      WHEN p_ano < extract(year FROM current_date)::integer THEN 12
      WHEN p_ano > extract(year FROM current_date)::integer THEN 0
      ELSE extract(month FROM current_date)::integer
    END AS mes_atual
  )
  SELECT
    CASE
      WHEN i.data_vencimento IS NOT NULL
        AND extract(year FROM i.data_vencimento)::integer = p_ano
        AND public.opex_mes_no_kpi(
          extract(month FROM i.data_vencimento)::integer,
          p_meses,
          p.mes_atual
        )
      THEN extract(month FROM i.data_vencimento)::integer
      ELSE NULL
    END AS mes_vencimento,
    CASE
      WHEN i.data_pagamento IS NOT NULL
        AND extract(year FROM i.data_pagamento)::integer = p_ano
        AND public.opex_mes_no_kpi(
          extract(month FROM i.data_pagamento)::integer,
          p_meses,
          p.mes_atual
        )
      THEN extract(month FROM i.data_pagamento)::integer
      ELSE NULL
    END AS mes_pagamento,
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
        AND extract(year FROM i.data_vencimento)::integer = p_ano
        AND public.opex_mes_no_kpi(
          extract(month FROM i.data_vencimento)::integer,
          p_meses,
          p.mes_atual
        )
      THEN public.opex_valor_item(i)
      ELSE 0
    END::numeric, 2) AS valor_previsto_vios,
    round(CASE
      WHEN i.data_pagamento IS NOT NULL
        AND extract(year FROM i.data_pagamento)::integer = p_ano
        AND public.opex_mes_no_kpi(
          extract(month FROM i.data_pagamento)::integer,
          p_meses,
          p.mes_atual
        )
      THEN public.opex_valor_pago(i)
      ELSE 0
    END::numeric, 2) AS valor_realizado
  FROM financeiro_parcelas_itens i
  CROSS JOIN params p
  WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
    AND (
      (
        i.data_vencimento IS NOT NULL
        AND extract(year FROM i.data_vencimento)::integer = p_ano
        AND public.opex_mes_no_kpi(
          extract(month FROM i.data_vencimento)::integer,
          p_meses,
          p.mes_atual
        )
      )
      OR (
        i.data_pagamento IS NOT NULL
        AND extract(year FROM i.data_pagamento)::integer = p_ano
        AND public.opex_mes_no_kpi(
          extract(month FROM i.data_pagamento)::integer,
          p_meses,
          p.mes_atual
        )
      )
    )
  ORDER BY 3, 4, 5, i.data_vencimento NULLS LAST, i.ci_item;
$$;

COMMENT ON FUNCTION public.opex_lancamentos_periodo(integer, integer[], text[], text[]) IS
  'Itens OPEX elegíveis do período do painel, uma linha por CI item, com plano (grupo) e subplano separados. Somas de realizado e previsto VIOS batem com o dashboard.';

GRANT EXECUTE ON FUNCTION public.opex_lancamentos_periodo(integer, integer[], text[], text[]) TO anon, authenticated;
