-- Alinha período jan–mai com BASE_2026.xlsx (VIOS manual):
-- por cliente = soma da inadimplência mensal (Lira: faturado − recebido por mês de vencimento).
-- KPI do período = soma dos fechamentos mensais (mesma base da evolução).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_clientes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
  valor numeric,
  qtd_meses integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meses AS (
    SELECT generate_series(
      GREATEST(1, LEAST(p_mes_inicio, 12)),
      GREATEST(1, LEAST(p_mes_fim, 12))
    )::integer AS mes
  )
  SELECT
    c.cliente,
    ROUND(SUM(c.inadimplencia), 2)::numeric(15, 2) AS valor,
    COUNT(*) FILTER (WHERE c.inadimplencia > 0)::integer AS qtd_meses
  FROM meses m
  CROSS JOIN LATERAL public.receita_inadimplencia_cliente_mes(p_ano, m.mes) c
  WHERE c.inadimplencia > 0
  GROUP BY c.cliente
  ORDER BY valor DESC, c.cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer) IS
  'Clientes no período — soma mensal Lira (faturado − recebido por mês de vencimento), alinhado à BASE VIOS.';

DROP FUNCTION IF EXISTS public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text);

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer,
  p_cliente text
)
RETURNS TABLE (
  mes integer,
  ci_titulo integer,
  nro_titulo text,
  descricao text,
  plano_contas text,
  situacao_titulo text,
  data_vencimento date,
  data_pagamento date,
  valor_item numeric,
  valor_pago_item numeric,
  inadimplencia numeric,
  qtd_itens integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH meses AS (
    SELECT generate_series(
      GREATEST(1, LEAST(p_mes_inicio, 12)),
      GREATEST(1, LEAST(p_mes_fim, 12))
    )::integer AS mes
  ),
  fim_mes AS (
    SELECT
      m.mes,
      (date_trunc('month', make_date(p_ano, m.mes, 1)) + interval '1 month - 1 day')::date AS dt
    FROM meses m
  ),
  itens AS (
    SELECT
      fm.mes,
      v.ci_titulo,
      COALESCE(NULLIF(trim(fp.nro_titulo), ''), v.ci_titulo::text) AS nro_titulo,
      COALESCE(NULLIF(trim(i.descricao), ''), NULLIF(trim(fp.descricao), '')) AS descricao,
      NULLIF(trim(v.plano_contas), '') AS plano_contas,
      NULLIF(trim(v.situacao_titulo), '') AS situacao_titulo,
      v.data_vencimento,
      v.data_pagamento,
      COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
      COALESCE(v.valor_pago_item, 0)::numeric(15, 2) AS valor_pago_item,
      (
        CASE
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= fm.dt
               AND COALESCE(v.valor_pago_item, 0) >= COALESCE(v.valor_item, 0)
               AND COALESCE(v.valor_item, 0) > 0
            THEN 0::numeric(15, 2)
          WHEN v.data_pagamento IS NOT NULL
               AND v.data_pagamento <= fm.dt
            THEN GREATEST(
              0,
              COALESCE(v.valor_item, 0) - COALESCE(v.valor_pago_item, 0)
            )::numeric(15, 2)
          ELSE COALESCE(v.valor_item, 0)::numeric(15, 2)
        END
      ) AS inad_item
    FROM fim_mes fm
    INNER JOIN public.receita_itens_inadimplencia_elegiveis v
      ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = fm.mes
    INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
    INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = v.ci_titulo
    WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
      AND v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
  ),
  por_mes_cliente AS (
    SELECT
      it.mes,
      SUM(it.inad_item)::numeric(15, 2) AS inad_itens,
      SUM(it.valor_item)::numeric(15, 2) AS faturado
    FROM itens it
    GROUP BY it.mes
  ),
  recebido_mes AS (
    SELECT
      fm.mes,
      COALESCE(SUM(COALESCE(v.valor_pago_item, 0)), 0)::numeric(15, 2) AS recebido
    FROM fim_mes fm
    LEFT JOIN public.receita_itens_inadimplencia_elegiveis v
      ON COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
      AND v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer = fm.mes
    GROUP BY fm.mes
  ),
  cap_mes AS (
    SELECT
      p.mes,
      p.inad_itens,
      p.faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (
        CASE
          WHEN COALESCE(r.recebido, 0) >= p.faturado AND p.faturado > 0 THEN 0::numeric(15, 2)
          WHEN p.inad_itens <= 0 THEN 0::numeric(15, 2)
          ELSE LEAST(
            p.inad_itens,
            GREATEST(0, p.faturado - COALESCE(r.recebido, 0))
          )::numeric(15, 2)
        END
      ) AS inad_cap
    FROM por_mes_cliente p
    LEFT JOIN recebido_mes r ON r.mes = p.mes
  )
  SELECT
    it.mes,
    it.ci_titulo,
    MAX(it.nro_titulo) AS nro_titulo,
    MAX(it.descricao) AS descricao,
    MAX(it.plano_contas) AS plano_contas,
    MAX(it.situacao_titulo) AS situacao_titulo,
    MIN(it.data_vencimento) AS data_vencimento,
    MAX(it.data_pagamento) AS data_pagamento,
    SUM(it.valor_item)::numeric(15, 2) AS valor_item,
    SUM(it.valor_pago_item)::numeric(15, 2) AS valor_pago_item,
    ROUND(
      SUM(it.inad_item)
      * CASE
          WHEN cm.inad_itens > 0 AND cm.inad_cap < cm.inad_itens
            THEN cm.inad_cap / cm.inad_itens
          WHEN cm.inad_cap <= 0 THEN 0
          ELSE 1
        END,
      2
    )::numeric(15, 2) AS inadimplencia,
    COUNT(*)::integer AS qtd_itens
  FROM itens it
  INNER JOIN cap_mes cm ON cm.mes = it.mes
  WHERE it.inad_item > 0
    AND cm.inad_cap > 0
  GROUP BY it.mes, it.ci_titulo, cm.inad_itens, cm.inad_cap
  HAVING ROUND(
    SUM(it.inad_item)
    * CASE
        WHEN cm.inad_itens > 0 AND cm.inad_cap < cm.inad_itens
          THEN cm.inad_cap / cm.inad_itens
        WHEN cm.inad_cap <= 0 THEN 0
        ELSE 1
      END,
    2
  ) > 0
  ORDER BY it.mes, SUM(it.inad_item) DESC, MAX(it.nro_titulo);
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text) IS
  'Títulos por mês de vencimento com inadimplência mensal Lira (cohort), alinhado à BASE VIOS.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text) TO anon, authenticated;

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
    LEFT JOIN public.receita_inadimplencia_fechamento_mensal f
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
  INTO v_evolucao, v_valor_periodo, v_previsto_periodo
  FROM evolucao_calc ec;

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
  'Dashboard inadimplência: KPI/top5 = soma mensal Lira; evolução = fechamento por mês (BASE VIOS).';
