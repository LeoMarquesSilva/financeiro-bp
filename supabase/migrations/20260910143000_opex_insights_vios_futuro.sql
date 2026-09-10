-- Insights OPEX: no ano (ou filtro com mês futuro), o compromisso inclui
-- títulos VIOS ainda a vencer. Expõe previsto_vios_futuro por grupo.

CREATE OR REPLACE FUNCTION public.opex_dashboard(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_grupos_excluidos text[] DEFAULT NULL,
  p_planos_excluidos text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes_atual integer;
  v_tem_orcamento boolean;
  v_realizado_ytd numeric := 0;
  v_previsto_ytd numeric := 0;
  v_previsto_vios_ytd numeric := 0;
  v_previsto_ano numeric := 0;
  v_previsto_vios_ano numeric := 0;
  v_projetado_ano numeric := 0;
  v_media_fixas numeric := 0;
  v_result jsonb;
BEGIN
  IF p_ano IS NULL OR p_ano < 2000 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  IF p_meses IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM unnest(p_meses) m WHERE m < 1 OR m > 12) THEN
      RAISE EXCEPTION 'Mês inválido no filtro';
    END IF;
  END IF;

  v_mes_atual := CASE
    WHEN p_ano < extract(year from current_date)::integer THEN 12
    WHEN p_ano > extract(year from current_date)::integer THEN 0
    ELSE extract(month from current_date)::integer
  END;

  v_tem_orcamento := public.opex_tem_orcamento(p_ano);

  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  ),
  mensal_orcamento AS (
    SELECT l.mes, round(sum(l.valor), 2)::numeric(15, 2) AS previsto
    FROM public.opex_orcamento_linha l
    WHERE l.ano = p_ano
      AND public.opex_orcamento_no_painel(l.grupo_conta, l.plano_contas, p_grupos_excluidos, p_planos_excluidos)
    GROUP BY l.mes
  ),
  mensal_vios AS (
    SELECT extract(month FROM i.data_vencimento)::integer AS mes,
      round(sum(public.opex_valor_item(i))::numeric, 2) AS previsto
    FROM financeiro_parcelas_itens i
    WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
      AND i.data_vencimento IS NOT NULL
      AND extract(year FROM i.data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  mensal_realizado AS (
    SELECT extract(month FROM i.data_pagamento)::integer AS mes,
      round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado
    FROM financeiro_parcelas_itens i
    WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
      AND i.data_pagamento IS NOT NULL
      AND extract(year FROM i.data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  mensal_fixas_realizado AS (
    SELECT extract(month FROM i.data_pagamento)::integer AS mes,
      round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado_fixas
    FROM financeiro_parcelas_itens i
    WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
      AND i.data_pagamento IS NOT NULL
      AND extract(year FROM i.data_pagamento)::integer = p_ano
      AND public.opex_grupo_fixo(i.grupo_conta)
    GROUP BY 1
  ),
  media_fixas AS (
    SELECT round(avg(realizado_fixas)::numeric, 2) AS media
    FROM mensal_fixas_realizado
    WHERE mes <= v_mes_atual AND v_mes_atual > 0
  ),
  evolucao AS (
    SELECT
      m.mes,
      CASE
        WHEN v_tem_orcamento THEN coalesce(o.previsto, 0)
        ELSE coalesce(v.previsto, 0)
      END AS previsto,
      coalesce(v.previsto, 0) AS previsto_vios,
      coalesce(r.realizado, 0) AS realizado,
      CASE
        WHEN m.mes > v_mes_atual AND v_mes_atual > 0 THEN coalesce((SELECT media FROM media_fixas), 0)
        ELSE coalesce(fr.realizado_fixas, 0)
      END AS projetado_fixas
    FROM meses m
    LEFT JOIN mensal_orcamento o ON o.mes = m.mes
    LEFT JOIN mensal_vios v ON v.mes = m.mes
    LEFT JOIN mensal_realizado r ON r.mes = m.mes
    LEFT JOIN mensal_fixas_realizado fr ON fr.mes = m.mes
  ),
  totais AS (
    SELECT
      round(coalesce(sum(realizado) FILTER (
        WHERE public.opex_mes_no_kpi(mes, p_meses, v_mes_atual)
      ), 0)::numeric, 2) AS realizado_ytd,
      round(coalesce(sum(previsto) FILTER (
        WHERE public.opex_mes_no_kpi(mes, p_meses, v_mes_atual)
      ), 0)::numeric, 2) AS previsto_ytd,
      round(coalesce(sum(previsto_vios) FILTER (
        WHERE public.opex_mes_no_kpi(mes, p_meses, v_mes_atual)
      ), 0)::numeric, 2) AS previsto_vios_ytd,
      round(coalesce(sum(previsto), 0)::numeric, 2) AS previsto_ano,
      round(coalesce(sum(previsto_vios), 0)::numeric, 2) AS previsto_vios_ano,
      round(
        CASE
          WHEN public.opex_tem_filtro_meses(p_meses) THEN
            coalesce(sum(previsto) FILTER (WHERE mes = ANY(p_meses)), 0)
          ELSE
            coalesce(sum(realizado) FILTER (WHERE mes <= v_mes_atual), 0)
            + coalesce(sum(previsto) FILTER (WHERE mes > v_mes_atual), 0)
        END
      ::numeric, 2) AS projetado_ano
    FROM evolucao
  )
  SELECT totais.realizado_ytd, totais.previsto_ytd, totais.previsto_vios_ytd,
    totais.previsto_ano, totais.previsto_vios_ano, totais.projetado_ano,
    coalesce((SELECT media FROM media_fixas), 0)
  INTO v_realizado_ytd, v_previsto_ytd, v_previsto_vios_ytd,
    v_previsto_ano, v_previsto_vios_ano, v_projetado_ano, v_media_fixas
  FROM totais;

  SELECT jsonb_build_object(
    'ano', p_ano,
    'mes_atual', v_mes_atual,
    'orcamento_importado', v_tem_orcamento,
    'meses_filtro', CASE
      WHEN public.opex_tem_filtro_meses(p_meses) THEN to_jsonb(p_meses)
      ELSE '[]'::jsonb
    END,
    'kpis', jsonb_build_object(
      'realizado_ytd', v_realizado_ytd,
      'previsto_ytd', v_previsto_ytd,
      'previsto_vios_ytd', v_previsto_vios_ytd,
      'previsto_ano', v_previsto_ano,
      'previsto_vios_ano', v_previsto_vios_ano,
      'projetado_ano', v_projetado_ano,
      'media_mensal_fixas', v_media_fixas,
      'variancia_ytd_pct', CASE
        WHEN v_previsto_ytd > 0 THEN round(((v_realizado_ytd - v_previsto_ytd) / v_previsto_ytd) * 1000) / 10
        ELSE 0
      END
    ),
    'evolucao', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'mes', e.mes,
          'previsto', e.previsto,
          'previsto_vios', e.previsto_vios,
          'realizado', e.realizado,
          'projetado_fixas', e.projetado_fixas,
          'variacao', round((e.realizado - e.previsto)::numeric, 2)
        ) ORDER BY e.mes
      ), '[]'::jsonb)
      FROM (
        SELECT
          m.mes,
          CASE WHEN v_tem_orcamento THEN coalesce(o.previsto, 0) ELSE coalesce(v.previsto, 0) END AS previsto,
          coalesce(v.previsto, 0) AS previsto_vios,
          coalesce(r.realizado, 0) AS realizado,
          CASE
            WHEN m.mes > v_mes_atual AND v_mes_atual > 0 THEN v_media_fixas
            ELSE coalesce(fr.realizado_fixas, 0)
          END AS projetado_fixas
        FROM generate_series(1, 12) AS m(mes)
        LEFT JOIN (
          SELECT l.mes, round(sum(l.valor), 2) AS previsto
          FROM public.opex_orcamento_linha l
          WHERE l.ano = p_ano
            AND public.opex_orcamento_no_painel(l.grupo_conta, l.plano_contas, p_grupos_excluidos, p_planos_excluidos)
          GROUP BY l.mes
        ) o ON o.mes = m.mes
        LEFT JOIN (
          SELECT extract(month FROM i.data_vencimento)::int AS mes,
            round(sum(public.opex_valor_item(i))::numeric, 2) AS previsto
          FROM financeiro_parcelas_itens i
          WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
            AND i.data_vencimento IS NOT NULL
            AND extract(year FROM i.data_vencimento)::int = p_ano
          GROUP BY 1
        ) v ON v.mes = m.mes
        LEFT JOIN (
          SELECT extract(month FROM i.data_pagamento)::int AS mes,
            round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado
          FROM financeiro_parcelas_itens i
          WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
            AND i.data_pagamento IS NOT NULL
            AND extract(year FROM i.data_pagamento)::int = p_ano
          GROUP BY 1
        ) r ON r.mes = m.mes
        LEFT JOIN (
          SELECT extract(month FROM i.data_pagamento)::int AS mes,
            round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado_fixas
          FROM financeiro_parcelas_itens i
          WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
            AND i.data_pagamento IS NOT NULL
            AND extract(year FROM i.data_pagamento)::int = p_ano
            AND public.opex_grupo_fixo(i.grupo_conta)
          GROUP BY 1
        ) fr ON fr.mes = m.mes
      ) e
    ),
    'grupos', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'grupo_conta', g.grupo_conta,
          'fixo', g.fixo,
          'realizado_ytd', g.realizado_ytd,
          'previsto_ano', g.previsto_ano,
          'previsto_vios', g.previsto_vios,
          'previsto_vios_futuro', g.previsto_vios_futuro,
          'previsto_restante', g.previsto_restante,
          'projetado_ano', round((g.realizado_ytd + g.previsto_restante
            + CASE
              WHEN public.opex_tem_filtro_meses(p_meses) THEN 0
              WHEN g.fixo AND v_mes_atual > 0 THEN
                public.opex_extrapolacao_fixas_grupo(g.realizado_ytd, v_mes_atual)
              ELSE 0
            END)::numeric, 2)
        ) ORDER BY g.realizado_ytd DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          coalesce(k.grupo_conta, 'Sem grupo') AS grupo_conta,
          coalesce(k.fixo, false) AS fixo,
          coalesce(k.realizado_ytd, 0) AS realizado_ytd,
          CASE
            WHEN v_tem_orcamento THEN coalesce(k.previsto_orc, 0)
            ELSE coalesce(k.previsto_vios, 0)
          END AS previsto_ano,
          coalesce(k.previsto_vios, 0) AS previsto_vios,
          coalesce(k.previsto_vios_futuro, 0) AS previsto_vios_futuro,
          CASE
            WHEN v_tem_orcamento THEN coalesce(k.previsto_orc_futuro, 0)
            ELSE coalesce(k.previsto_vios_futuro, 0)
          END AS previsto_restante
        FROM (
          SELECT
            coalesce(v.grupo_conta, o.grupo_conta) AS grupo_conta,
            coalesce(v.fixo, o.fixo, false) AS fixo,
            coalesce(v.realizado_ytd, 0) AS realizado_ytd,
            coalesce(o.previsto_orc, 0) AS previsto_orc,
            coalesce(v.previsto_vios, 0) AS previsto_vios,
            coalesce(o.previsto_orc_futuro, 0) AS previsto_orc_futuro,
            coalesce(v.previsto_vios_futuro, 0) AS previsto_vios_futuro
          FROM (
            SELECT
              coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
              public.opex_grupo_fixo(i.grupo_conta) AS fixo,
              round(sum(public.opex_valor_pago(i)) FILTER (
                WHERE i.data_pagamento IS NOT NULL
                  AND extract(year FROM i.data_pagamento)::int = p_ano
                  AND public.opex_mes_pagamento_no_periodo(
                    extract(month FROM i.data_pagamento)::int, p_meses, v_mes_atual
                  )
              )::numeric, 2) AS realizado_ytd,
              round(sum(public.opex_valor_item(i)) FILTER (
                WHERE i.data_vencimento IS NOT NULL
                  AND extract(year FROM i.data_vencimento)::int = p_ano
                  AND public.opex_mes_vencimento_no_periodo(
                    extract(month FROM i.data_vencimento)::int, p_meses
                  )
              )::numeric, 2) AS previsto_vios,
              round(sum(public.opex_valor_item(i)) FILTER (
                WHERE i.data_vencimento IS NOT NULL
                  AND extract(year FROM i.data_vencimento)::int = p_ano
                  AND extract(month FROM i.data_vencimento)::int > v_mes_atual
                  AND public.opex_mes_vencimento_no_periodo(
                    extract(month FROM i.data_vencimento)::int, p_meses
                  )
              )::numeric, 2) AS previsto_vios_futuro
            FROM financeiro_parcelas_itens i
            WHERE public.opex_item_no_painel(i, p_grupos_excluidos, p_planos_excluidos)
            GROUP BY 1, 2
          ) v
          FULL OUTER JOIN (
            SELECT
              l.grupo_conta,
              bool_or(l.fixo) AS fixo,
              round(sum(l.valor) FILTER (
                WHERE public.opex_mes_vencimento_no_periodo(l.mes, p_meses)
              )::numeric, 2) AS previsto_orc,
              round(sum(l.valor) FILTER (
                WHERE NOT public.opex_tem_filtro_meses(p_meses)
                  AND l.mes > v_mes_atual
              )::numeric, 2) AS previsto_orc_futuro
            FROM public.opex_orcamento_linha l
            WHERE l.ano = p_ano
              AND public.opex_orcamento_no_painel(l.grupo_conta, l.plano_contas, p_grupos_excluidos, p_planos_excluidos)
            GROUP BY l.grupo_conta
          ) o ON o.grupo_conta = v.grupo_conta
        ) k
      ) g
      WHERE g.realizado_ytd > 0 OR g.previsto_ano > 0 OR g.previsto_vios > 0
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


COMMENT ON FUNCTION public.opex_dashboard(integer, integer[], text[], text[]) IS
  'Dashboard OPEX: grupos incluem previsto_vios_futuro (títulos a vencer após o mês atual).';

GRANT EXECUTE ON FUNCTION public.opex_dashboard(integer, integer[], text[], text[]) TO anon, authenticated;
