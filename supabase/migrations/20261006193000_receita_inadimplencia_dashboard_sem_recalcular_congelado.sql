-- O dashboard recalculava cliente_mes em todo mês do ano, inclusive nos já
-- congelados. A evolução exibe o snapshot; o recálculo só servia para estourar
-- o tempo da API. Mês fechado lê o fechamento. Só o mês ainda aberto vai ao vivo.
-- KPI e top 5 continuam em grupos_periodo (saldo líquido do intervalo).
-- Chamadas iguais no mesmo instante (a Receita dispara o dashboard em mais de um
-- bloco) esperam um único cálculo e reaproveitam o resultado por 45 segundos.

CREATE TABLE IF NOT EXISTS public.receita_inadimplencia_dashboard_cache (
  ano integer NOT NULL,
  mes_inicio integer NOT NULL,
  mes_fim integer NOT NULL,
  payload jsonb NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ano, mes_inicio, mes_fim)
);

ALTER TABLE public.receita_inadimplencia_dashboard_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.receita_inadimplencia_dashboard_cache FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_dashboard(
  p_ano integer,
  p_mes_inicio integer DEFAULT NULL,
  p_mes_fim integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
  v_valor_periodo numeric(15, 2);
  v_previsto_periodo numeric(15, 2);
  v_pct_periodo numeric(8, 2);
  v_top5 jsonb;
  v_top5_total numeric(15, 2);
  v_top5_pct numeric(8, 2);
  v_evolucao jsonb;
  v_primeiro_valor numeric(15, 2);
  v_ultimo_valor numeric(15, 2);
  v_reducao_pct numeric(8, 2);
  v_periodo_label text;
  v_resultado jsonb;
  v_cache jsonb;
  v_mes_labels text[] := ARRAY['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
BEGIN
  IF p_ano > v_ano_atual THEN
    RETURN jsonb_build_object(
      'ano', p_ano, 'mes_inicio', 1, 'mes_fim', 0, 'mes_max_disponivel', 0,
      'periodo_label', '', 'valor_total_periodo', 0, 'pct_periodo', 0,
      'top5', '[]'::jsonb, 'top5_total', 0, 'top5_pct', 0,
      'evolucao', '[]'::jsonb, 'destaque_reducao_pct', NULL
    );
  END IF;

  PERFORM public.receita_inadimplencia_congelar_meses_encerrados(p_ano);

  v_mes_max := CASE WHEN p_ano = v_ano_atual THEN v_mes_atual ELSE 12 END;
  v_mes_inicio := GREATEST(1, LEAST(COALESCE(NULLIF(p_mes_inicio, 0), 1), v_mes_max));
  v_mes_fim := GREATEST(v_mes_inicio, LEAST(COALESCE(NULLIF(p_mes_fim, 0), v_mes_max), v_mes_max));
  v_periodo_label := CASE
    WHEN v_mes_inicio = v_mes_fim THEN v_mes_labels[v_mes_inicio]
    ELSE v_mes_labels[v_mes_inicio] || '–' || v_mes_labels[v_mes_fim]
  END;

  -- Serializa o mesmo recorte. A 2ª e a 3ª chamada da página esperam esta e leem o cache.
  PERFORM pg_advisory_xact_lock(81421026, p_ano * 10000 + v_mes_inicio * 100 + v_mes_fim);

  SELECT c.payload
  INTO v_cache
  FROM public.receita_inadimplencia_dashboard_cache c
  WHERE c.ano = p_ano
    AND c.mes_inicio = v_mes_inicio
    AND c.mes_fim = v_mes_fim
    AND c.calculated_at > now() - interval '45 seconds';

  IF v_cache IS NOT NULL THEN
    RETURN v_cache;
  END IF;

  WITH previsto_por_mes AS (
    SELECT
      m.mes,
      public.receita_previsto_mes(p_ano, m.mes)::numeric(15, 2) AS previsto
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
  ),
  fechado AS (
    SELECT
      f.mes,
      f.valor_total,
      f.pct_recebido,
      f.congelado_em
    FROM public.receita_inadimplencia_fechamento_mensal f
    WHERE f.ano = p_ano
      AND f.mes BETWEEN v_mes_inicio AND v_mes_fim
  ),
  inad_vivo AS (
    SELECT
      m.mes,
      (
        SELECT COALESCE(ROUND(SUM(c.inadimplencia), 2), 0)::numeric(15, 2)
        FROM public.receita_inadimplencia_cliente_mes(p_ano, m.mes, true) c
      ) AS inad
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
    WHERE NOT EXISTS (
      SELECT 1 FROM fechado f WHERE f.mes = m.mes
    )
  ),
  evolucao_calc AS (
    SELECT
      m.mes,
      CASE
        WHEN f.mes IS NOT NULL THEN COALESCE(f.valor_total, 0)
        ELSE COALESCE(v.inad, 0)
      END::numeric(15, 2) AS valor_calc,
      COALESCE(p.previsto, 0)::numeric(15, 2) AS previsto,
      f.valor_total AS valor_congelado,
      f.pct_recebido AS pct_congelado,
      f.congelado_em,
      (f.mes IS NOT NULL) AS congelado
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
    LEFT JOIN inad_vivo v ON v.mes = m.mes
    LEFT JOIN previsto_por_mes p ON p.mes = m.mes
    LEFT JOIN fechado f ON f.mes = m.mes
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'mes', ec.mes,
        'mes_label', v_mes_labels[ec.mes],
        'valor', ec.valor_calc,
        'valor_calculado', ec.valor_calc,
        'valor_congelado', CASE WHEN ec.congelado THEN ec.valor_congelado END,
        'previsto', ec.previsto,
        'pct', CASE
          WHEN ec.congelado AND ec.pct_congelado IS NOT NULL THEN ec.pct_congelado
          WHEN ec.previsto > 0 THEN ROUND((ec.valor_calc / ec.previsto) * 100, 2)
          ELSE 0
        END,
        'pct_congelado', CASE WHEN ec.congelado THEN ec.pct_congelado END,
        'congelado', ec.congelado,
        'congelado_em', ec.congelado_em
      ) ORDER BY ec.mes
    ), '[]'::jsonb),
    COALESCE(SUM(ec.previsto), 0)
  INTO v_evolucao, v_previsto_periodo
  FROM evolucao_calc ec;

  SELECT COALESCE(ROUND(SUM(g.valor), 2), 0)::numeric(15, 2)
  INTO v_valor_periodo
  FROM public.receita_inadimplencia_grupos_periodo(
    p_ano, v_mes_inicio, v_mes_fim, true
  ) g;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.valor DESC), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT g.grupo_cliente AS cliente, g.valor
    FROM public.receita_inadimplencia_grupos_periodo(p_ano, v_mes_inicio, v_mes_fim, false) g
    WHERE g.valor > 0
    ORDER BY g.valor DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)::numeric(15, 2)
  INTO v_top5_total
  FROM jsonb_array_elements(v_top5) AS elem;

  v_pct_periodo := CASE
    WHEN v_previsto_periodo > 0 THEN ROUND((v_valor_periodo / v_previsto_periodo) * 100, 1)
    ELSE 0
  END;

  v_top5_pct := CASE
    WHEN v_valor_periodo > 0 THEN ROUND((v_top5_total / v_valor_periodo) * 100, 1)
    ELSE 0
  END;

  SELECT (elem->>'valor')::numeric INTO v_primeiro_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer LIMIT 1;

  SELECT (elem->>'valor')::numeric INTO v_ultimo_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer DESC LIMIT 1;

  v_reducao_pct := CASE
    WHEN v_primeiro_valor > 0 AND v_ultimo_valor IS NOT NULL THEN
      ROUND(((v_primeiro_valor - v_ultimo_valor) / v_primeiro_valor) * 100, 0)
    ELSE NULL
  END;

  v_resultado := jsonb_build_object(
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

  INSERT INTO public.receita_inadimplencia_dashboard_cache (
    ano, mes_inicio, mes_fim, payload, calculated_at
  )
  VALUES (p_ano, v_mes_inicio, v_mes_fim, v_resultado, now())
  ON CONFLICT (ano, mes_inicio, mes_fim) DO UPDATE
    SET payload = EXCLUDED.payload,
        calculated_at = EXCLUDED.calculated_at;

  RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_dashboard(integer, integer, integer) IS
  'KPI acumulado = saldo líquido do período (grupos_periodo). Evolução de mês congelado = fechamento; só o mês aberto recalcula. Não soma a evolução no KPI.';
