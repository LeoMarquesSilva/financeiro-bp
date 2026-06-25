-- OPEX: filtro por mês e detalhamento mensal por grupo de conta.

DROP FUNCTION IF EXISTS public.opex_dashboard(integer);

CREATE OR REPLACE FUNCTION public.opex_dashboard(p_ano integer, p_mes integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes_atual integer;
  v_mes_filtro integer;
  v_realizado_ytd numeric := 0;
  v_previsto_ytd numeric := 0;
  v_previsto_ano numeric := 0;
  v_projetado_ano numeric := 0;
  v_media_fixas numeric := 0;
  v_result jsonb;
BEGIN
  IF p_ano IS NULL OR p_ano < 2000 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;

  IF p_mes IS NOT NULL AND (p_mes < 1 OR p_mes > 12) THEN
    RAISE EXCEPTION 'Mês inválido';
  END IF;

  v_mes_atual := CASE
    WHEN p_ano < extract(year from current_date)::integer THEN 12
    WHEN p_ano > extract(year from current_date)::integer THEN 0
    ELSE extract(month from current_date)::integer
  END;

  v_mes_filtro := p_mes;

  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  ),
  itens AS (
    SELECT *
    FROM financeiro_parcelas_itens i
    WHERE public.opex_item_elegivel(i)
  ),
  mensal_previsto AS (
    SELECT
      extract(month FROM i.data_vencimento)::integer AS mes,
      round(sum(public.opex_valor_item(i))::numeric, 2) AS previsto
    FROM itens i
    WHERE i.data_vencimento IS NOT NULL
      AND extract(year FROM i.data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  mensal_realizado AS (
    SELECT
      extract(month FROM i.data_pagamento)::integer AS mes,
      round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado
    FROM itens i
    WHERE i.data_pagamento IS NOT NULL
      AND extract(year FROM i.data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  mensal_fixas_realizado AS (
    SELECT
      extract(month FROM i.data_pagamento)::integer AS mes,
      round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado_fixas
    FROM itens i
    WHERE i.data_pagamento IS NOT NULL
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
      coalesce(p.previsto, 0) AS previsto,
      coalesce(r.realizado, 0) AS realizado,
      CASE
        WHEN m.mes > v_mes_atual AND v_mes_atual > 0 THEN coalesce((SELECT media FROM media_fixas), 0)
        ELSE coalesce(fr.realizado_fixas, 0)
      END AS projetado_fixas
    FROM meses m
    LEFT JOIN mensal_previsto p ON p.mes = m.mes
    LEFT JOIN mensal_realizado r ON r.mes = m.mes
    LEFT JOIN mensal_fixas_realizado fr ON fr.mes = m.mes
  ),
  totais AS (
    SELECT
      round(coalesce(sum(realizado) FILTER (
        WHERE v_mes_filtro IS NULL AND mes <= v_mes_atual
          OR v_mes_filtro IS NOT NULL AND mes = v_mes_filtro
      ), 0)::numeric, 2) AS realizado_ytd,
      round(coalesce(sum(previsto) FILTER (
        WHERE v_mes_filtro IS NULL AND mes <= v_mes_atual
          OR v_mes_filtro IS NOT NULL AND mes = v_mes_filtro
      ), 0)::numeric, 2) AS previsto_ytd,
      round(coalesce(sum(previsto), 0)::numeric, 2) AS previsto_ano,
      round(
        CASE
          WHEN v_mes_filtro IS NOT NULL THEN coalesce(sum(previsto) FILTER (WHERE mes = v_mes_filtro), 0)
          ELSE coalesce(sum(realizado) FILTER (WHERE mes <= v_mes_atual), 0)
            + coalesce(sum(previsto) FILTER (WHERE mes > v_mes_atual), 0)
        END
      ::numeric, 2) AS projetado_ano
    FROM evolucao
  )
  SELECT
    totais.realizado_ytd,
    totais.previsto_ytd,
    totais.previsto_ano,
    totais.projetado_ano,
    coalesce((SELECT media FROM media_fixas), 0)
  INTO v_realizado_ytd, v_previsto_ytd, v_previsto_ano, v_projetado_ano, v_media_fixas
  FROM totais;

  SELECT jsonb_build_object(
    'ano', p_ano,
    'mes_atual', v_mes_atual,
    'mes_filtro', v_mes_filtro,
    'kpis', jsonb_build_object(
      'realizado_ytd', v_realizado_ytd,
      'previsto_ytd', v_previsto_ytd,
      'previsto_ano', v_previsto_ano,
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
          'realizado', e.realizado,
          'projetado_fixas', e.projetado_fixas,
          'variacao', round((e.realizado - e.previsto)::numeric, 2)
        ) ORDER BY e.mes
      ), '[]'::jsonb)
      FROM (
        SELECT m.mes,
          coalesce(p.previsto, 0) AS previsto,
          coalesce(r.realizado, 0) AS realizado,
          CASE
            WHEN m.mes > v_mes_atual AND v_mes_atual > 0 THEN v_media_fixas
            ELSE coalesce(fr.realizado_fixas, 0)
          END AS projetado_fixas
        FROM generate_series(1, 12) AS m(mes)
        LEFT JOIN (
          SELECT extract(month FROM i.data_vencimento)::int AS mes,
            round(sum(public.opex_valor_item(i))::numeric, 2) AS previsto
          FROM financeiro_parcelas_itens i
          WHERE public.opex_item_elegivel(i)
            AND i.data_vencimento IS NOT NULL
            AND extract(year FROM i.data_vencimento)::int = p_ano
          GROUP BY 1
        ) p ON p.mes = m.mes
        LEFT JOIN (
          SELECT extract(month FROM i.data_pagamento)::int AS mes,
            round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado
          FROM financeiro_parcelas_itens i
          WHERE public.opex_item_elegivel(i)
            AND i.data_pagamento IS NOT NULL
            AND extract(year FROM i.data_pagamento)::int = p_ano
          GROUP BY 1
        ) r ON r.mes = m.mes
        LEFT JOIN (
          SELECT extract(month FROM i.data_pagamento)::int AS mes,
            round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado_fixas
          FROM financeiro_parcelas_itens i
          WHERE public.opex_item_elegivel(i)
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
          'previsto_restante', g.previsto_restante,
          'projetado_ano', round((g.realizado_ytd + g.previsto_restante
            + CASE
              WHEN v_mes_filtro IS NOT NULL THEN 0
              WHEN g.fixo AND v_mes_atual > 0 THEN v_media_fixas * (12 - v_mes_atual)
              ELSE 0
            END)::numeric, 2)
        ) ORDER BY g.realizado_ytd DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') AS grupo_conta,
          public.opex_grupo_fixo(i.grupo_conta) AS fixo,
          round(sum(public.opex_valor_pago(i)) FILTER (
            WHERE i.data_pagamento IS NOT NULL
              AND extract(year FROM i.data_pagamento)::int = p_ano
              AND (
                (v_mes_filtro IS NULL AND (v_mes_atual = 0 OR extract(month FROM i.data_pagamento)::int <= v_mes_atual))
                OR (v_mes_filtro IS NOT NULL AND extract(month FROM i.data_pagamento)::int = v_mes_filtro)
              )
          )::numeric, 2) AS realizado_ytd,
          round(sum(public.opex_valor_item(i)) FILTER (
            WHERE i.data_vencimento IS NOT NULL
              AND extract(year FROM i.data_vencimento)::int = p_ano
              AND (v_mes_filtro IS NULL OR extract(month FROM i.data_vencimento)::int = v_mes_filtro)
          )::numeric, 2) AS previsto_ano,
          round(sum(public.opex_valor_item(i)) FILTER (
            WHERE v_mes_filtro IS NULL
              AND i.data_vencimento IS NOT NULL
              AND extract(year FROM i.data_vencimento)::int = p_ano
              AND extract(month FROM i.data_vencimento)::int > v_mes_atual
          )::numeric, 2) AS previsto_restante
        FROM financeiro_parcelas_itens i
        WHERE public.opex_item_elegivel(i)
        GROUP BY 1, 2
      ) g
      WHERE g.realizado_ytd > 0 OR g.previsto_ano > 0
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.opex_dashboard(integer, integer) IS
  'Dashboard OPEX com filtro opcional por mês (p_mes).';

GRANT EXECUTE ON FUNCTION public.opex_dashboard(integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.opex_mes_grupos(p_ano integer, p_mes integer)
RETURNS TABLE (
  grupo_conta text,
  fixo boolean,
  previsto numeric,
  realizado numeric,
  variacao numeric
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
      public.opex_grupo_fixo(i.grupo_conta) AS fixo,
      round(sum(public.opex_valor_item(i)) FILTER (
        WHERE i.data_vencimento IS NOT NULL
          AND extract(year FROM i.data_vencimento)::int = p_ano
          AND extract(month FROM i.data_vencimento)::int = p_mes
      )::numeric, 2) AS previsto,
      round(sum(public.opex_valor_pago(i)) FILTER (
        WHERE i.data_pagamento IS NOT NULL
          AND extract(year FROM i.data_pagamento)::int = p_ano
          AND extract(month FROM i.data_pagamento)::int = p_mes
      )::numeric, 2) AS realizado,
      round((
        coalesce(sum(public.opex_valor_pago(i)) FILTER (
          WHERE i.data_pagamento IS NOT NULL
            AND extract(year FROM i.data_pagamento)::int = p_ano
            AND extract(month FROM i.data_pagamento)::int = p_mes
        ), 0)
        - coalesce(sum(public.opex_valor_item(i)) FILTER (
          WHERE i.data_vencimento IS NOT NULL
            AND extract(year FROM i.data_vencimento)::int = p_ano
            AND extract(month FROM i.data_vencimento)::int = p_mes
        ), 0)
      )::numeric, 2) AS variacao
    FROM financeiro_parcelas_itens i
    WHERE public.opex_item_elegivel(i)
    GROUP BY 1, 2
    HAVING coalesce(sum(public.opex_valor_pago(i)) FILTER (
        WHERE i.data_pagamento IS NOT NULL
          AND extract(year FROM i.data_pagamento)::int = p_ano
          AND extract(month FROM i.data_pagamento)::int = p_mes
      ), 0) > 0
      OR coalesce(sum(public.opex_valor_item(i)) FILTER (
        WHERE i.data_vencimento IS NOT NULL
          AND extract(year FROM i.data_vencimento)::int = p_ano
          AND extract(month FROM i.data_vencimento)::int = p_mes
      ), 0) > 0
  ) sub
  ORDER BY greatest(sub.previsto, sub.realizado) DESC;
$$;

COMMENT ON FUNCTION public.opex_mes_grupos(integer, integer) IS
  'Detalhamento OPEX de um mês por grupo de conta (previsto x realizado).';

GRANT EXECUTE ON FUNCTION public.opex_mes_grupos(integer, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.opex_planos_grupo(integer, text);

CREATE OR REPLACE FUNCTION public.opex_planos_grupo(
  p_ano integer,
  p_grupo text,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  plano_contas text,
  realizado_ytd numeric,
  previsto_ano numeric
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
        AND (
          (p_mes IS NOT NULL AND extract(month FROM i.data_pagamento)::int = p_mes)
          OR (p_mes IS NULL AND (ctx.mes_atual = 0 OR extract(month FROM i.data_pagamento)::int <= ctx.mes_atual))
        )
    )::numeric, 2) AS realizado_ytd,
    round(sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL
        AND extract(year FROM i.data_vencimento)::int = p_ano
        AND (p_mes IS NULL OR extract(month FROM i.data_vencimento)::int = p_mes)
    )::numeric, 2) AS previsto_ano
  FROM financeiro_parcelas_itens i
  CROSS JOIN ctx
  WHERE public.opex_item_elegivel(i)
    AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
  GROUP BY 1
  HAVING sum(public.opex_valor_pago(i)) FILTER (
      WHERE i.data_pagamento IS NOT NULL
        AND extract(year FROM i.data_pagamento)::int = p_ano
    ) > 0
    OR sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL
        AND extract(year FROM i.data_vencimento)::int = p_ano
    ) > 0
  ORDER BY realizado_ytd DESC;
$$;

GRANT EXECUTE ON FUNCTION public.opex_planos_grupo(integer, text, integer) TO anon, authenticated;
