-- Rentabilidade do Escritório por grupo cliente (chave canônica da Receita/inadimplência).
-- Recebido = mesma base da Receita (receita_totais_mensais): plano_contas_na_cota + receita_item_recebido_liquido.
-- Inadimplência = saldo líquido do período (receita_inadimplencia_grupos_periodo), sem reimplementar a fórmula.
-- Hora produtiva em duas bases: pago e pago + inadimplente (mesmas horas no denominador).

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
  v_ano_ini integer := EXTRACT(YEAR FROM p_data_inicio)::integer;
  v_ano_fim integer := EXTRACT(YEAR FROM p_data_fim)::integer;
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
    (v_ano_fim - v_ano_ini) * 12
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

  v_custo_hora := COALESCE(v_custo_hora, 100.58);

  WITH rec AS (
    SELECT
      public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente) AS chave,
      array_agg(DISTINCT trim(b.cliente)) AS razoes,
      SUM(public.receita_item_recebido_liquido(i))::numeric AS recebido_total
    FROM public.receita_itens_inadimplencia_base b
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
    WHERE i.data_pagamento IS NOT NULL
      AND i.data_pagamento::date BETWEEN p_data_inicio AND p_data_fim
      AND i.valor_pago_item IS NOT NULL
      AND i.valor_pago_item <> 0
      AND NULLIF(trim(b.cliente), '') IS NOT NULL
      AND (
        lower(trim(b.grupo_cliente)) = ANY (v_grupos)
        OR lower(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente)) = ANY (v_grupos)
      )
    GROUP BY 1
  ),
  horas AS (
    SELECT
      public.receita_inadimplencia_chave_grupo(t.grupo_cliente, t.cliente) AS chave,
      array_agg(DISTINCT trim(t.cliente)) AS razoes,
      SUM(
        public.escritorio_timesheet_minutos_linha(
          COALESCE(t.total_horas_decimal, t.total_horas, 0)::numeric
        )
      )::integer AS minutos_total
    FROM timesheets t
    WHERE t.data IS NOT NULL
      AND t.data BETWEEN p_data_inicio AND p_data_fim
      AND NULLIF(trim(t.cliente), '') IS NOT NULL
      AND (
        lower(COALESCE(NULLIF(trim(t.grupo_cliente), ''), 'Sem grupo')) = ANY (v_grupos)
        OR lower(public.receita_inadimplencia_chave_grupo(t.grupo_cliente, t.cliente)) = ANY (v_grupos)
      )
      AND public.escritorio_levantamento_area_match(v_area, t.area)
    GROUP BY 1
  ),
  inad AS (
    SELECT
      lower(g.grupo_cliente) AS chave_norm,
      MAX(g.grupo_cliente) AS chave,
      SUM(g.valor)::numeric AS inadimplencia
    FROM generate_series(v_ano_ini, v_ano_fim) AS y(ano)
    CROSS JOIN LATERAL public.receita_inadimplencia_grupos_periodo(
      y.ano,
      CASE WHEN y.ano = v_ano_ini THEN EXTRACT(MONTH FROM p_data_inicio)::integer ELSE 1 END,
      CASE WHEN y.ano = v_ano_fim THEN EXTRACT(MONTH FROM p_data_fim)::integer ELSE 12 END,
      false
    ) g
    GROUP BY 1
  ),
  base AS (
    SELECT
      COALESCE(r.chave, h.chave) AS chave,
      (
        SELECT array_agg(DISTINCT x ORDER BY x)
        FROM unnest(COALESCE(r.razoes, '{}'::text[]) || COALESCE(h.razoes, '{}'::text[])) AS x
        WHERE NULLIF(x, '') IS NOT NULL
      ) AS razoes,
      COALESCE(r.recebido_total, 0) AS recebido_total,
      COALESCE(h.minutos_total, 0) AS minutos_total
    FROM rec r
    FULL OUTER JOIN horas h ON lower(r.chave) = lower(h.chave)
  ),
  todas AS (
    SELECT
      b.chave,
      b.razoes,
      b.recebido_total,
      b.minutos_total,
      COALESCE(ia.inadimplencia, 0) AS inadimplencia
    FROM base b
    LEFT JOIN inad ia ON ia.chave_norm = lower(b.chave)
    UNION ALL
    SELECT
      i2.chave,
      NULL::text[],
      0,
      0,
      i2.inadimplencia
    FROM inad i2
    WHERE i2.chave_norm = ANY (v_grupos)
      AND NOT EXISTS (SELECT 1 FROM base b2 WHERE lower(b2.chave) = i2.chave_norm)
  ),
  calc AS (
    SELECT
      t.*,
      t.recebido_total + t.inadimplencia AS pago_mais_inad,
      CASE WHEN t.minutos_total > 0 THEN t.minutos_total::numeric / v_meses / 60.0 END AS horas_mes
    FROM todas t
    WHERE NULLIF(trim(t.chave), '') IS NOT NULL
      AND (t.recebido_total > 0 OR t.inadimplencia > 0)
  )
  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.valor_contrato_mensal DESC, x.cliente), '[]'::jsonb)
  INTO v_linhas
  FROM (
    SELECT
      c.chave AS cliente,
      COALESCE(c.razoes, '{}'::text[]) AS razoes_sociais,
      ROUND(c.recebido_total, 2) AS recebido_periodo,
      ROUND(c.inadimplencia, 2) AS inadimplencia_periodo,
      ROUND(c.recebido_total / v_meses, 2) AS valor_contrato_mensal,
      ROUND(c.pago_mais_inad / v_meses, 2) AS valor_contrato_mensal_com_inadimplencia,
      ROUND(c.minutos_total::numeric / v_meses, 0)::integer AS media_horas_mes_minutos,
      ROUND((c.recebido_total / v_meses) / c.horas_mes, 2) AS valor_hora_recebido,
      ROUND((c.recebido_total / v_meses) / c.horas_mes - v_custo_hora, 2) AS resultado_hora,
      ROUND((c.pago_mais_inad / v_meses) / c.horas_mes, 2) AS valor_hora_com_inadimplencia,
      ROUND((c.pago_mais_inad / v_meses) / c.horas_mes - v_custo_hora, 2) AS resultado_hora_com_inadimplencia
    FROM calc c
  ) x;

  RETURN jsonb_build_object(
    'custo_hora_produtiva', v_custo_hora,
    'meses_periodo', v_meses,
    'linhas', COALESCE(v_linhas, '[]'::jsonb),
    'requer_grupo', false,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'area', v_area,
    'inadimplencia_corte', public.receita_inadimplencia_corte_vencimento(
      v_ano_fim, EXTRACT(MONTH FROM p_data_fim)::integer
    ),
    'inadimplencia_multi_ano', v_ano_ini <> v_ano_fim
  );
END;
$$;

COMMENT ON FUNCTION public.escritorio_rentabilidade_contratos(date, date, text[], text) IS
  'Rentabilidade por grupo cliente (receita_inadimplencia_chave_grupo): recebido na base da Receita, inadimplência do período (grupos_periodo) e valor-hora pago vs pago + inadimplente.';

GRANT EXECUTE ON FUNCTION public.escritorio_rentabilidade_contratos(date, date, text[], text)
  TO anon, authenticated;
