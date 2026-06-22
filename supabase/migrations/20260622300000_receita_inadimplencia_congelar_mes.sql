-- Consulta e gravação manual do fechamento mensal de inadimplência.

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_fechamento_mes(
  p_ano integer,
  p_mes integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN f.ano IS NULL THEN jsonb_build_object('congelado', false)
    ELSE jsonb_build_object(
      'congelado', true,
      'valor_total', f.valor_total,
      'pct', f.pct_recebido,
      'congelado_em', f.congelado_em
    )
  END
  FROM (SELECT 1) AS _
  LEFT JOIN public.receita_inadimplencia_fechamento_mensal f
    ON f.ano = p_ano AND f.mes = p_mes;
$$;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_congelar_mes(
  p_ano integer,
  p_mes integer,
  p_valor_total numeric,
  p_pct numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.receita_inadimplencia_fechamento_mensal%ROWTYPE;
BEGIN
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'Mês inválido: %', p_mes;
  END IF;
  IF p_valor_total IS NULL OR p_valor_total < 0 THEN
    RAISE EXCEPTION 'Valor total inválido';
  END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RAISE EXCEPTION 'Percentual inválido';
  END IF;

  INSERT INTO public.receita_inadimplencia_fechamento_mensal (ano, mes, valor_total, pct_recebido, congelado_em)
  VALUES (p_ano, p_mes, ROUND(p_valor_total, 2), ROUND(p_pct, 2), now())
  ON CONFLICT (ano, mes) DO UPDATE SET
    valor_total = EXCLUDED.valor_total,
    pct_recebido = EXCLUDED.pct_recebido,
    congelado_em = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'congelado', true,
    'valor_total', v_row.valor_total,
    'pct', v_row.pct_recebido,
    'congelado_em', v_row.congelado_em
  );
END;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_fechamento_mes(integer, integer) IS
  'Retorna snapshot de fechamento do mês (valor, % e data de congelamento).';

COMMENT ON FUNCTION public.receita_inadimplencia_congelar_mes(integer, integer, numeric, numeric) IS
  'Grava ou atualiza o fechamento mensal de inadimplência com valor e % informados.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_fechamento_mes(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_congelar_mes(integer, integer, numeric, numeric) TO authenticated;

-- Expõe data de congelamento na evolução do dashboard.
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
  v_faturado_periodo numeric(15, 2);
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
  IF p_ano > v_ano_atual OR (p_ano = v_ano_atual AND v_mes_atual <= 1) THEN
    RETURN jsonb_build_object(
      'ano', p_ano, 'mes_inicio', 1, 'mes_fim', 0, 'mes_max_disponivel', 0,
      'periodo_label', '', 'valor_total_periodo', 0, 'pct_periodo', 0,
      'top5', '[]'::jsonb, 'top5_total', 0, 'top5_pct', 0,
      'evolucao', '[]'::jsonb, 'destaque_reducao_pct', NULL
    );
  END IF;

  v_mes_max := CASE WHEN p_ano = v_ano_atual THEN v_mes_atual - 1 ELSE 12 END;
  v_mes_inicio := GREATEST(1, LEAST(COALESCE(NULLIF(p_mes_inicio, 0), 1), v_mes_max));
  v_mes_fim := GREATEST(v_mes_inicio, LEAST(COALESCE(NULLIF(p_mes_fim, 0), v_mes_max), v_mes_max));
  v_inicio := make_date(p_ano, v_mes_inicio, 1);
  v_fim := (date_trunc('month', make_date(p_ano, v_mes_fim, 1)) + interval '1 month - 1 day')::date;
  v_periodo_label := CASE
    WHEN v_mes_inicio = v_mes_fim THEN v_mes_labels[v_mes_inicio]
    ELSE v_mes_labels[v_mes_inicio] || '–' || v_mes_labels[v_mes_fim]
  END;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.valor DESC), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT
      c.cliente,
      ROUND(SUM(c.inadimplencia), 2)::numeric(15, 2) AS valor
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
    CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(p_ano, m.mes) c
    WHERE c.inadimplencia > 0
    GROUP BY c.cliente
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)::numeric(15, 2)
  INTO v_top5_total
  FROM jsonb_array_elements(v_top5) AS elem;

  WITH previsto_por_mes AS (
    SELECT
      m.mes,
      public.receita_previsto_mes(p_ano, m.mes)::numeric(15, 2) AS previsto
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
  ),
  inad_por_mes AS (
    SELECT
      m.mes,
      (
        SELECT COALESCE(ROUND(SUM(c.inadimplencia), 2), 0)::numeric(15, 2)
        FROM public.receita_inadimplencia_cliente_mes(p_ano, m.mes) c
        WHERE c.inadimplencia > 0
      ) AS inad
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
  ),
  evolucao_calc AS (
    SELECT
      m.mes,
      COALESCE(i.inad, 0)::numeric(15, 2) AS valor_calc,
      COALESCE(p.previsto, 0)::numeric(15, 2) AS previsto,
      f.valor_total AS valor_congelado,
      f.pct_recebido AS pct_congelado,
      f.congelado_em,
      (f.ano IS NOT NULL) AS congelado
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
    LEFT JOIN inad_por_mes i ON i.mes = m.mes
    LEFT JOIN previsto_por_mes p ON p.mes = m.mes
    LEFT JOIN receita_inadimplencia_fechamento_mensal f
      ON f.ano = p_ano AND f.mes = m.mes
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'mes', ec.mes,
        'mes_label', v_mes_labels[ec.mes],
        'valor', CASE WHEN ec.congelado THEN ec.valor_congelado ELSE ec.valor_calc END,
        'valor_calculado', ec.valor_calc,
        'previsto', ec.previsto,
        'pct', CASE
          WHEN ec.congelado THEN ec.pct_congelado
          WHEN ec.previsto > 0 THEN ROUND((ec.valor_calc / ec.previsto) * 100, 2)
          ELSE 0
        END,
        'congelado', ec.congelado,
        'congelado_em', ec.congelado_em
      ) ORDER BY ec.mes
    ), '[]'::jsonb),
    COALESCE(SUM(ec.valor_calc), 0),
    COALESCE(SUM(ec.previsto), 0)
  INTO v_evolucao, v_valor_periodo, v_faturado_periodo
  FROM evolucao_calc ec;

  v_pct_periodo := CASE
    WHEN v_faturado_periodo > 0 THEN ROUND((v_valor_periodo / v_faturado_periodo) * 100, 1)
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
