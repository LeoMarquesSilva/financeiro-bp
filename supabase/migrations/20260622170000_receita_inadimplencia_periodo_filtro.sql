-- Filtro de período (mês inicial e final) no dashboard de inadimplência.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_dashboard(
  p_ano integer,
  p_mes_inicio integer DEFAULT NULL,
  p_mes_fim integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje date := CURRENT_DATE;
  v_ano_atual integer := EXTRACT(YEAR FROM v_hoje)::integer;
  v_mes_atual integer := EXTRACT(MONTH FROM v_hoje)::integer;
  v_mes_max integer;
  v_mes_inicio integer;
  v_mes_fim integer;
  v_inicio date;
  v_fim date;
  v_valor_periodo numeric(15, 2);
  v_recebido_periodo numeric(15, 2);
  v_pct_periodo numeric(8, 2);
  v_top5 jsonb;
  v_top5_total numeric(15, 2);
  v_top5_pct numeric(8, 2);
  v_evolucao jsonb;
  v_primeiro_valor numeric(15, 2);
  v_ultimo_valor numeric(15, 2);
  v_reducao_pct numeric(8, 2);
  v_periodo_label text;
  v_mes_labels text[] := ARRAY['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
BEGIN
  PERFORM public.receita_inadimplencia_sincronizar(p_ano);

  IF p_ano > v_ano_atual THEN
    RETURN jsonb_build_object(
      'ano', p_ano,
      'mes_inicio', 1,
      'mes_fim', 0,
      'mes_max_disponivel', 0,
      'periodo_label', '',
      'valor_total_periodo', 0,
      'pct_periodo', 0,
      'top5', '[]'::jsonb,
      'top5_total', 0,
      'top5_pct', 0,
      'evolucao', '[]'::jsonb,
      'destaque_reducao_pct', NULL
    );
  END IF;

  IF p_ano = v_ano_atual THEN
    v_mes_max := v_mes_atual - 1;
  ELSE
    v_mes_max := 12;
  END IF;

  IF v_mes_max < 1 THEN
    RETURN jsonb_build_object(
      'ano', p_ano,
      'mes_inicio', 1,
      'mes_fim', 0,
      'mes_max_disponivel', 0,
      'periodo_label', '',
      'valor_total_periodo', 0,
      'pct_periodo', 0,
      'top5', '[]'::jsonb,
      'top5_total', 0,
      'top5_pct', 0,
      'evolucao', '[]'::jsonb,
      'destaque_reducao_pct', NULL
    );
  END IF;

  v_mes_inicio := COALESCE(NULLIF(p_mes_inicio, 0), 1);
  v_mes_fim := COALESCE(NULLIF(p_mes_fim, 0), v_mes_max);
  v_mes_inicio := GREATEST(1, LEAST(v_mes_inicio, v_mes_max));
  v_mes_fim := GREATEST(v_mes_inicio, LEAST(v_mes_fim, v_mes_max));

  v_inicio := make_date(p_ano, v_mes_inicio, 1);
  v_fim := (date_trunc('month', make_date(p_ano, v_mes_fim, 1)) + interval '1 month - 1 day')::date;

  IF v_mes_inicio = v_mes_fim THEN
    v_periodo_label := v_mes_labels[v_mes_inicio];
  ELSE
    v_periodo_label := v_mes_labels[v_mes_inicio] || '–' || v_mes_labels[v_mes_fim];
  END IF;

  SELECT COALESCE(SUM(e.valor), 0)::numeric(15, 2)
  INTO v_valor_periodo
  FROM (
    SELECT COALESCE(f.valor_total, public.receita_inadimplencia_mes_faturado(p_ano, gs.m)) AS valor
    FROM generate_series(v_mes_inicio, v_mes_fim) AS gs(m)
    LEFT JOIN receita_inadimplencia_fechamento_mensal f
      ON f.ano = p_ano AND f.mes = gs.m
  ) e;

  SELECT COALESCE(SUM(public.receita_recebido_mes(p_ano, gs.m)), 0)::numeric(15, 2)
  INTO v_recebido_periodo
  FROM generate_series(v_mes_inicio, v_mes_fim) AS gs(m);

  v_pct_periodo := CASE
    WHEN v_recebido_periodo > 0 THEN ROUND((v_valor_periodo / v_recebido_periodo) * 100, 1)
    ELSE 0
  END;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.valor DESC), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT
      COALESCE(NULLIF(trim(i.cliente), ''), 'Sem cliente') AS cliente,
      ROUND(SUM(COALESCE(i.valor_item, 0)), 2)::numeric(15, 2) AS valor
    FROM public.receita_itens_cota_base() i
    WHERE i.data_vencimento IS NOT NULL
      AND i.valor_item IS NOT NULL
      AND i.data_vencimento >= v_inicio
      AND i.data_vencimento <= v_fim
      AND (i.data_pagamento IS NULL OR i.data_pagamento > i.data_vencimento)
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)::numeric(15, 2)
  INTO v_top5_total
  FROM jsonb_array_elements(v_top5) AS elem;

  v_top5_pct := CASE
    WHEN v_valor_periodo > 0 THEN ROUND((v_top5_total / v_valor_periodo) * 100, 1)
    ELSE 0
  END;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'mes', e.mes,
      'mes_label', v_mes_labels[e.mes],
      'valor', e.valor,
      'pct', e.pct,
      'congelado', e.congelado
    ) ORDER BY e.mes
  ), '[]'::jsonb)
  INTO v_evolucao
  FROM (
    SELECT
      gs.m AS mes,
      COALESCE(f.valor_total, public.receita_inadimplencia_mes_faturado(p_ano, gs.m)) AS valor,
      COALESCE(f.pct_recebido, public.receita_inadimplencia_pct_mes(p_ano, gs.m)) AS pct,
      (f.ano IS NOT NULL) AS congelado
    FROM generate_series(v_mes_inicio, v_mes_fim) AS gs(m)
    LEFT JOIN receita_inadimplencia_fechamento_mensal f
      ON f.ano = p_ano AND f.mes = gs.m
  ) e;

  SELECT (elem->>'valor')::numeric INTO v_primeiro_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer LIMIT 1;

  SELECT (elem->>'valor')::numeric INTO v_ultimo_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer DESC LIMIT 1;

  v_reducao_pct := CASE
    WHEN v_primeiro_valor IS NOT NULL AND v_primeiro_valor > 0 AND v_ultimo_valor IS NOT NULL THEN
      ROUND(((v_primeiro_valor - v_ultimo_valor) / v_primeiro_valor) * 100, 0)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'mes_inicio', v_mes_inicio,
    'mes_fim', v_mes_fim,
    'mes_max_disponivel', v_mes_max,
    'periodo_label', v_periodo_label,
    'valor_total_periodo', v_valor_periodo,
    'pct_periodo', v_pct_periodo,
    'top5', v_top5,
    'top5_total', v_top5_total,
    'top5_pct', v_top5_pct,
    'evolucao', v_evolucao,
    'destaque_reducao_pct', v_reducao_pct
  );
END;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_dashboard(integer, integer, integer) IS
  'Dashboard de inadimplência com filtro opcional de mês inicial e final.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_dashboard(integer, integer, integer) TO anon, authenticated;
