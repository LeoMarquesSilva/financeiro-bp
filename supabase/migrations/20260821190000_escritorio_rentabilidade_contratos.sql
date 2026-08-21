-- Rentabilidade de contratos no Escritório: recebido médio mensal × horas médias (timesheet).

INSERT INTO public.app_settings (key, value)
VALUES ('escritorio_custo_hora_produtiva', to_jsonb(100.58))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.escritorio_rentabilidade_contratos(
  p_data_inicio date,
  p_data_fim date,
  p_grupos text[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupos text[] := NULL;
  v_area text := NULLIF(trim(COALESCE(p_area, '')), '');
  v_meses integer;
  v_custo_hora numeric;
  v_linhas jsonb;
BEGIN
  IF p_grupos IS NOT NULL AND cardinality(p_grupos) > 0 THEN
    SELECT array_agg(DISTINCT lower(trim(g))) INTO v_grupos
    FROM unnest(p_grupos) AS g WHERE NULLIF(trim(g), '') IS NOT NULL;
  END IF;

  IF v_grupos IS NULL THEN
    RETURN jsonb_build_object(
      'custo_hora_produtiva', NULL,
      'meses_periodo', 0,
      'linhas', '[]'::jsonb,
      'requer_grupo', true
    );
  END IF;

  v_meses := GREATEST(
    1,
    (EXTRACT(YEAR FROM p_data_fim)::integer - EXTRACT(YEAR FROM p_data_inicio)::integer) * 12
      + EXTRACT(MONTH FROM p_data_fim)::integer - EXTRACT(MONTH FROM p_data_inicio)::integer + 1
  );

  SELECT COALESCE(
    CASE
      WHEN jsonb_typeof(value) = 'number' THEN (value)::text::numeric
      ELSE NULLIF(trim(value #>> '{}'), '')::numeric
    END,
    100.58
  )
  INTO v_custo_hora
  FROM public.app_settings
  WHERE key = 'escritorio_custo_hora_produtiva';

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.valor_contrato_mensal DESC), '[]'::jsonb)
  INTO v_linhas
  FROM (
    SELECT
      c.cliente,
      ROUND(c.recebido_total / v_meses, 2) AS valor_contrato_mensal,
      ROUND(c.minutos_total::numeric / v_meses, 0)::integer AS media_horas_mes_minutos,
      CASE
        WHEN c.minutos_total > 0 THEN
          ROUND((c.recebido_total / v_meses) / (c.minutos_total::numeric / v_meses / 60.0), 2)
        ELSE NULL
      END AS valor_hora_recebido,
      CASE
        WHEN c.minutos_total > 0 THEN
          ROUND(
            ((c.recebido_total / v_meses) / (c.minutos_total::numeric / v_meses / 60.0)) - v_custo_hora,
            2
          )
        ELSE NULL
      END AS resultado_hora
    FROM (
      SELECT
        COALESCE(NULLIF(r.cliente, ''), NULLIF(h.cliente, '')) AS cliente,
        COALESCE(r.recebido_total, 0) AS recebido_total,
        COALESCE(h.minutos_total, 0) AS minutos_total
      FROM (
        SELECT
          trim(i.cliente) AS cliente,
          SUM(COALESCE(i.valor_pago_item, 0))::numeric AS recebido_total
        FROM receita_itens_inadimplencia_elegiveis i
        WHERE i.data_pagamento IS NOT NULL
          AND i.data_pagamento::date BETWEEN p_data_inicio AND p_data_fim
          AND NULLIF(trim(i.cliente), '') IS NOT NULL
          AND lower(trim(COALESCE(i.grupo_cliente, ''))) = ANY (v_grupos)
        GROUP BY 1
      ) r
      FULL OUTER JOIN (
        SELECT
          trim(t.cliente) AS cliente,
          SUM(
            public.escritorio_timesheet_minutos_linha(
              COALESCE(t.total_horas_decimal, t.total_horas, 0)::numeric
            )
          )::integer AS minutos_total
        FROM timesheets t
        WHERE t.data IS NOT NULL
          AND t.data BETWEEN p_data_inicio AND p_data_fim
          AND NULLIF(trim(t.cliente), '') IS NOT NULL
          AND lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos)
          AND public.escritorio_levantamento_area_match(v_area, t.area)
        GROUP BY 1
      ) h ON r.cliente = h.cliente
      WHERE COALESCE(r.recebido_total, 0) > 0 OR COALESCE(h.minutos_total, 0) > 0
    ) c
    WHERE NULLIF(trim(c.cliente), '') IS NOT NULL
      AND c.recebido_total > 0
  ) x;

  RETURN jsonb_build_object(
    'custo_hora_produtiva', v_custo_hora,
    'meses_periodo', v_meses,
    'linhas', COALESCE(v_linhas, '[]'::jsonb),
    'requer_grupo', false,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'area', v_area
  );
END;
$$;

COMMENT ON FUNCTION public.escritorio_rentabilidade_contratos(date, date, text[], text) IS
  'Rentabilidade por razão social: média mensal recebida (financeiro) vs horas timesheet (área opcional).';

GRANT EXECUTE ON FUNCTION public.escritorio_rentabilidade_contratos(date, date, text[], text)
  TO anon, authenticated;
