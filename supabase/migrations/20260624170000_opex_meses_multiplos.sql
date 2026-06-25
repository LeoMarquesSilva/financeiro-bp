-- OPEX: filtro por múltiplos meses (p_meses integer[]).

CREATE OR REPLACE FUNCTION public.opex_tem_filtro_meses(p_meses integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_meses IS NOT NULL AND coalesce(array_length(p_meses, 1), 0) > 0;
$$;

CREATE OR REPLACE FUNCTION public.opex_mes_no_kpi(p_mes integer, p_meses integer[], p_mes_atual integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.opex_tem_filtro_meses(p_meses) THEN p_mes = ANY(p_meses)
    ELSE p_mes_atual = 0 OR p_mes <= p_mes_atual
  END;
$$;

CREATE OR REPLACE FUNCTION public.opex_mes_pagamento_no_periodo(
  p_mes_pag integer,
  p_meses integer[],
  p_mes_atual integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.opex_tem_filtro_meses(p_meses) THEN p_mes_pag = ANY(p_meses)
    ELSE p_mes_atual = 0 OR p_mes_pag <= p_mes_atual
  END;
$$;

CREATE OR REPLACE FUNCTION public.opex_mes_vencimento_no_periodo(p_mes_venc integer, p_meses integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NOT public.opex_tem_filtro_meses(p_meses) OR p_mes_venc = ANY(p_meses);
$$;

DROP FUNCTION IF EXISTS public.opex_dashboard(integer, integer);

CREATE OR REPLACE FUNCTION public.opex_dashboard(p_ano integer, p_meses integer[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes_atual integer;
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

  WITH meses AS (
    SELECT generate_series(1, 12) AS mes
  ),
  itens AS (
    SELECT * FROM financeiro_parcelas_itens i WHERE public.opex_item_elegivel(i)
  ),
  mensal_previsto AS (
    SELECT extract(month FROM i.data_vencimento)::integer AS mes,
      round(sum(public.opex_valor_item(i))::numeric, 2) AS previsto
    FROM itens i
    WHERE i.data_vencimento IS NOT NULL
      AND extract(year FROM i.data_vencimento)::integer = p_ano
    GROUP BY 1
  ),
  mensal_realizado AS (
    SELECT extract(month FROM i.data_pagamento)::integer AS mes,
      round(sum(public.opex_valor_pago(i))::numeric, 2) AS realizado
    FROM itens i
    WHERE i.data_pagamento IS NOT NULL
      AND extract(year FROM i.data_pagamento)::integer = p_ano
    GROUP BY 1
  ),
  mensal_fixas_realizado AS (
    SELECT extract(month FROM i.data_pagamento)::integer AS mes,
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
    SELECT m.mes,
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
        WHERE public.opex_mes_no_kpi(mes, p_meses, v_mes_atual)
      ), 0)::numeric, 2) AS realizado_ytd,
      round(coalesce(sum(previsto) FILTER (
        WHERE public.opex_mes_no_kpi(mes, p_meses, v_mes_atual)
      ), 0)::numeric, 2) AS previsto_ytd,
      round(coalesce(sum(previsto), 0)::numeric, 2) AS previsto_ano,
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
  SELECT totais.realizado_ytd, totais.previsto_ytd, totais.previsto_ano, totais.projetado_ano,
    coalesce((SELECT media FROM media_fixas), 0)
  INTO v_realizado_ytd, v_previsto_ytd, v_previsto_ano, v_projetado_ano, v_media_fixas
  FROM totais;

  SELECT jsonb_build_object(
    'ano', p_ano,
    'mes_atual', v_mes_atual,
    'meses_filtro', CASE
      WHEN public.opex_tem_filtro_meses(p_meses) THEN to_jsonb(p_meses)
      ELSE '[]'::jsonb
    END,
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
        SELECT m.mes, coalesce(p.previsto, 0) AS previsto, coalesce(r.realizado, 0) AS realizado,
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
              WHEN public.opex_tem_filtro_meses(p_meses) THEN 0
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
          )::numeric, 2) AS previsto_ano,
          round(sum(public.opex_valor_item(i)) FILTER (
            WHERE NOT public.opex_tem_filtro_meses(p_meses)
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

GRANT EXECUTE ON FUNCTION public.opex_dashboard(integer, integer[]) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.opex_planos_grupo(integer, text, integer);

CREATE OR REPLACE FUNCTION public.opex_planos_grupo(
  p_ano integer,
  p_grupo text,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (plano_contas text, realizado_ytd numeric, previsto_ano numeric)
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
    )::numeric, 2) AS realizado_ytd,
    round(sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL
        AND extract(year FROM i.data_vencimento)::int = p_ano
        AND public.opex_mes_vencimento_no_periodo(extract(month FROM i.data_vencimento)::int, p_meses)
    )::numeric, 2) AS previsto_ano
  FROM financeiro_parcelas_itens i
  CROSS JOIN ctx
  WHERE public.opex_item_elegivel(i)
    AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
  GROUP BY 1
  HAVING sum(public.opex_valor_pago(i)) FILTER (
      WHERE i.data_pagamento IS NOT NULL AND extract(year FROM i.data_pagamento)::int = p_ano
    ) > 0
    OR sum(public.opex_valor_item(i)) FILTER (
      WHERE i.data_vencimento IS NOT NULL AND extract(year FROM i.data_vencimento)::int = p_ano
    ) > 0
  ORDER BY realizado_ytd DESC;
$$;

GRANT EXECUTE ON FUNCTION public.opex_planos_grupo(integer, text, integer[]) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.opex_plano_titulos(integer, text, text, integer);

CREATE OR REPLACE FUNCTION public.opex_plano_titulos(
  p_ano integer,
  p_grupo text,
  p_plano text,
  p_meses integer[] DEFAULT NULL
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
      AND coalesce(nullif(trim(i.grupo_conta), ''), 'Sem grupo') = p_grupo
      AND coalesce(nullif(trim(i.plano_contas), ''), 'Sem plano') = p_plano
  ) sub
  WHERE sub.valor_previsto > 0 OR sub.valor_realizado > 0
  ORDER BY greatest(sub.valor_previsto, sub.valor_realizado) DESC, sub.data_vencimento DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.opex_plano_titulos(integer, text, text, integer[]) TO anon, authenticated;
