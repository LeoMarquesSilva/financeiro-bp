-- Rentabilidade do escritório inteiro, sem exigir grupo cliente.
-- Valor efetivo da hora = recebido (cota, líquido, data de pagamento) ÷ horas do timesheet.
-- Valor médio previsto/faturado = valor_item com vencimento no período ÷ as mesmas horas.
-- A média do escritório usa todas as horas do período. A do grupo usa só as horas do grupo.
-- Inadimplência não entra. Filtro de área vale para departamento do item e para a área do timesheet.

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
  v_area text := NULLIF(trim(COALESCE(p_area, '')), '');
  v_minutos bigint := 0;
  v_recebido numeric := 0;
  v_previsto numeric := 0;
  v_linhas jsonb;
BEGIN
  -- p_grupos permanece na assinatura e é ignorado: a visão é o escritório inteiro.

  SELECT COALESCE(SUM(
    public.escritorio_timesheet_minutos_linha(
      COALESCE(t.total_horas_decimal, t.total_horas, 0)::numeric
    )
  ), 0)::bigint
  INTO v_minutos
  FROM timesheets t
  WHERE t.data IS NOT NULL
    AND t.data BETWEEN p_data_inicio AND p_data_fim
    AND public.escritorio_levantamento_area_match(v_area, t.area);

  SELECT COALESCE(SUM(public.receita_item_recebido_liquido(i)), 0)
  INTO v_recebido
  FROM public.receita_itens_inadimplencia_base b
  INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
  WHERE i.data_pagamento IS NOT NULL
    AND i.data_pagamento BETWEEN p_data_inicio AND p_data_fim
    AND i.valor_pago_item IS NOT NULL
    AND i.valor_pago_item <> 0
    AND public.escritorio_levantamento_area_match(v_area, i.departamento);

  SELECT COALESCE(SUM(i.valor_item), 0)
  INTO v_previsto
  FROM public.receita_itens_inadimplencia_base b
  INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
  WHERE i.data_vencimento IS NOT NULL
    AND i.data_vencimento BETWEEN p_data_inicio AND p_data_fim
    AND i.valor_item IS NOT NULL
    AND public.escritorio_levantamento_area_match(v_area, i.departamento);

  WITH rec AS (
    SELECT
      lower(trim(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente))) AS chave_norm,
      MAX(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente)) AS chave,
      array_agg(DISTINCT trim(b.cliente)) FILTER (WHERE NULLIF(trim(b.cliente), '') IS NOT NULL) AS razoes,
      SUM(public.receita_item_recebido_liquido(i))::numeric AS recebido
    FROM public.receita_itens_inadimplencia_base b
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
    WHERE i.data_pagamento IS NOT NULL
      AND i.data_pagamento BETWEEN p_data_inicio AND p_data_fim
      AND i.valor_pago_item IS NOT NULL
      AND i.valor_pago_item <> 0
      AND public.escritorio_levantamento_area_match(v_area, i.departamento)
      AND NULLIF(trim(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente)), '') IS NOT NULL
    GROUP BY 1
  ),
  prev AS (
    SELECT
      lower(trim(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente))) AS chave_norm,
      MAX(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente)) AS chave,
      array_agg(DISTINCT trim(b.cliente)) FILTER (WHERE NULLIF(trim(b.cliente), '') IS NOT NULL) AS razoes,
      SUM(i.valor_item)::numeric AS previsto
    FROM public.receita_itens_inadimplencia_base b
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = b.id
    WHERE i.data_vencimento IS NOT NULL
      AND i.data_vencimento BETWEEN p_data_inicio AND p_data_fim
      AND i.valor_item IS NOT NULL
      AND public.escritorio_levantamento_area_match(v_area, i.departamento)
      AND NULLIF(trim(public.receita_inadimplencia_chave_grupo(b.grupo_cliente, b.cliente)), '') IS NOT NULL
    GROUP BY 1
  ),
  horas AS (
    SELECT
      lower(trim(public.receita_inadimplencia_chave_grupo(t.grupo_cliente, t.cliente))) AS chave_norm,
      MAX(public.receita_inadimplencia_chave_grupo(t.grupo_cliente, t.cliente)) AS chave,
      array_agg(DISTINCT trim(t.cliente)) FILTER (WHERE NULLIF(trim(t.cliente), '') IS NOT NULL) AS razoes,
      SUM(
        public.escritorio_timesheet_minutos_linha(
          COALESCE(t.total_horas_decimal, t.total_horas, 0)::numeric
        )
      )::bigint AS minutos
    FROM timesheets t
    WHERE t.data IS NOT NULL
      AND t.data BETWEEN p_data_inicio AND p_data_fim
      AND public.escritorio_levantamento_area_match(v_area, t.area)
      AND NULLIF(trim(public.receita_inadimplencia_chave_grupo(t.grupo_cliente, t.cliente)), '') IS NOT NULL
    GROUP BY 1
  ),
  chaves AS (
    SELECT chave_norm FROM rec
    UNION
    SELECT chave_norm FROM prev
    UNION
    SELECT chave_norm FROM horas
  ),
  calc AS (
    SELECT
      COALESCE(r.chave, p.chave, h.chave) AS cliente,
      (
        SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}'::text[])
        FROM unnest(
          COALESCE(r.razoes, '{}'::text[])
          || COALESCE(p.razoes, '{}'::text[])
          || COALESCE(h.razoes, '{}'::text[])
        ) AS x
        WHERE NULLIF(trim(x), '') IS NOT NULL
      ) AS razoes,
      COALESCE(r.recebido, 0) AS recebido,
      COALESCE(p.previsto, 0) AS previsto,
      COALESCE(h.minutos, 0) AS minutos
    FROM chaves c
    LEFT JOIN rec r ON r.chave_norm = c.chave_norm
    LEFT JOIN prev p ON p.chave_norm = c.chave_norm
    LEFT JOIN horas h ON h.chave_norm = c.chave_norm
    WHERE COALESCE(r.recebido, 0) <> 0
       OR COALESCE(p.previsto, 0) <> 0
       OR COALESCE(h.minutos, 0) > 0
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.valor_hora_efetivo DESC NULLS LAST, x.cliente), '[]'::jsonb)
  INTO v_linhas
  FROM (
    SELECT
      c.cliente,
      c.razoes AS razoes_sociais,
      ROUND(c.recebido, 2) AS recebido_periodo,
      ROUND(c.previsto, 2) AS previsto_periodo,
      c.minutos AS horas_minutos,
      CASE
        WHEN c.minutos > 0 THEN ROUND(c.recebido / (c.minutos / 60.0), 2)
      END AS valor_hora_efetivo,
      CASE
        WHEN c.minutos > 0 THEN ROUND(c.previsto / (c.minutos / 60.0), 2)
      END AS valor_hora_previsto
    FROM calc c
  ) x;

  RETURN jsonb_build_object(
    'horas_minutos', v_minutos,
    'recebido_escritorio', ROUND(v_recebido, 2),
    'previsto_escritorio', ROUND(v_previsto, 2),
    'valor_hora_efetivo_escritorio',
      CASE WHEN v_minutos > 0 THEN ROUND(v_recebido / (v_minutos / 60.0), 2) END,
    'valor_hora_previsto_escritorio',
      CASE WHEN v_minutos > 0 THEN ROUND(v_previsto / (v_minutos / 60.0), 2) END,
    'linhas', COALESCE(v_linhas, '[]'::jsonb),
    'requer_grupo', false,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'area', v_area
  );
END;
$$;

COMMENT ON FUNCTION public.escritorio_rentabilidade_contratos(date, date, text[], text) IS
  'Rentabilidade do escritório inteiro: hora efetiva (recebido ÷ horas) e hora prevista/faturada (valor do item ÷ horas), com ranking por grupo. Não usa inadimplência.';

GRANT EXECUTE ON FUNCTION public.escritorio_rentabilidade_contratos(date, date, text[], text)
  TO anon, authenticated;
