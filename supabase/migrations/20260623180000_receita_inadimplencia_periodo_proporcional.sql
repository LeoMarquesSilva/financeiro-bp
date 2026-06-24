-- Regra da planilha BASE VIOS (Planilha5):
-- por cliente no período = Σ proporcional vencimento − Σ proporcional pagamento.
-- No banco: valor_item (vencimento) e valor_pago_item (pagamento), equivalentes ao export.
-- KPI do período = soma dos saldos positivos por cliente (créditos negativos ficam de fora).

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_cliente_mes(
  p_ano integer,
  p_mes integer
)
RETURNS TABLE (
  cliente text,
  faturado numeric,
  recebido numeric,
  inadimplencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH faturado_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
    GROUP BY 1
  ),
  recebido_mes AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer = p_mes
    GROUP BY 1
  ),
  net AS (
    SELECT
      COALESCE(f.cliente, r.cliente) AS cliente,
      COALESCE(f.faturado, 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (
        COALESCE(f.faturado, 0) - COALESCE(r.recebido, 0)
      )::numeric(15, 2) AS valor_liquido
    FROM faturado_mes f
    FULL OUTER JOIN recebido_mes r ON r.cliente = f.cliente
  )
  SELECT
    n.cliente,
    n.faturado,
    n.recebido,
    GREATEST(n.valor_liquido, 0)::numeric(15, 2) AS inadimplencia
  FROM net n
  WHERE GREATEST(n.valor_liquido, 0) > 0;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_mes(integer, integer) IS
  'Inadimplência mensal proporcional: max(0, faturado vencimento − recebido pagamento) no mês.';

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_periodo_net_clientes(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
  grupo_cliente text,
  faturado numeric,
  recebido numeric,
  valor_liquido numeric,
  valor numeric,
  qtd_meses integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_inicio,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim
  ),
  faturado_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS faturado,
      COUNT(DISTINCT EXTRACT(MONTH FROM v.data_vencimento)::integer) FILTER (
        WHERE COALESCE(v.valor_item, 0) > 0
      )::integer AS qtd_meses
    FROM public.receita_itens_inadimplencia_elegiveis v
    CROSS JOIN bounds b
    WHERE v.data_vencimento IS NOT NULL
      AND v.valor_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
    GROUP BY 1, 2
  ),
  recebido_periodo AS (
    SELECT
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_elegiveis v
    CROSS JOIN bounds b
    WHERE v.data_pagamento IS NOT NULL
      AND v.valor_pago_item IS NOT NULL
      AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
      AND EXTRACT(MONTH FROM v.data_pagamento)::integer BETWEEN b.mes_inicio AND b.mes_fim
    GROUP BY 1
  ),
  grupo_lookup AS (
    SELECT DISTINCT ON (COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'))
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo') AS grupo_cliente
    FROM public.receita_itens_inadimplencia_elegiveis v
    ORDER BY
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente'),
      COALESCE(NULLIF(trim(v.grupo_cliente), ''), 'Sem grupo')
  ),
  net AS (
    SELECT
      COALESCE(f.cliente, r.cliente) AS cliente,
      COALESCE(f.grupo_cliente, g.grupo_cliente, 'Sem grupo') AS grupo_cliente,
      COALESCE(f.faturado, 0)::numeric(15, 2) AS faturado,
      COALESCE(r.recebido, 0)::numeric(15, 2) AS recebido,
      (COALESCE(f.faturado, 0) - COALESCE(r.recebido, 0))::numeric(15, 2) AS valor_liquido,
      COALESCE(f.qtd_meses, 0)::integer AS qtd_meses
    FROM faturado_periodo f
    FULL OUTER JOIN recebido_periodo r ON r.cliente = f.cliente
    LEFT JOIN grupo_lookup g ON g.cliente = COALESCE(f.cliente, r.cliente)
  )
  SELECT
    n.cliente,
    n.grupo_cliente,
    n.faturado,
    n.recebido,
    n.valor_liquido,
    GREATEST(n.valor_liquido, 0)::numeric(15, 2) AS valor,
    n.qtd_meses
  FROM net n;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer) IS
  'Saldo proporcional do período por cliente (planilha VIOS): faturado vencimento − recebido pagamento.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_periodo_net_clientes(integer, integer, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.receita_inadimplencia_clientes_periodo(integer, integer, integer);

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_clientes_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  cliente text,
  grupo_cliente text,
  valor numeric,
  qtd_meses integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.cliente,
    n.grupo_cliente,
    n.valor,
    n.qtd_meses
  FROM public.receita_inadimplencia_periodo_net_clientes(p_ano, p_mes_inicio, p_mes_fim) n
  WHERE n.valor > 0
  ORDER BY n.valor DESC, n.cliente;
$$;

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_clientes_periodo(integer, integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_grupos_periodo(
  p_ano integer,
  p_mes_inicio integer,
  p_mes_fim integer
)
RETURNS TABLE (
  grupo_cliente text,
  valor numeric,
  qtd_meses integer,
  qtd_clientes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.grupo_cliente,
    ROUND(SUM(n.valor), 2)::numeric(15, 2) AS valor,
    MAX(n.qtd_meses)::integer AS qtd_meses,
    COUNT(*) FILTER (WHERE n.valor > 0)::integer AS qtd_clientes
  FROM public.receita_inadimplencia_periodo_net_clientes(p_ano, p_mes_inicio, p_mes_fim) n
  WHERE n.valor > 0
  GROUP BY n.grupo_cliente
  HAVING SUM(n.valor) > 0
  ORDER BY valor DESC, n.grupo_cliente;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_grupos_periodo(integer, integer, integer) IS
  'Inadimplência do período por grupo — soma dos saldos positivos das empresas (regra planilha).';

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
  WITH bounds AS (
    SELECT
      GREATEST(1, LEAST(p_mes_inicio, 12)) AS mes_inicio,
      GREATEST(1, LEAST(p_mes_fim, 12)) AS mes_fim
  )
  SELECT
    EXTRACT(MONTH FROM v.data_vencimento)::integer AS mes,
    v.ci_titulo,
    COALESCE(NULLIF(trim(fp.nro_titulo), ''), v.ci_titulo::text) AS nro_titulo,
    COALESCE(NULLIF(trim(i.descricao), ''), NULLIF(trim(fp.descricao), '')) AS descricao,
    NULLIF(trim(v.plano_contas), '') AS plano_contas,
    NULLIF(trim(v.situacao_titulo), '') AS situacao_titulo,
    v.data_vencimento,
    v.data_pagamento,
    COALESCE(v.valor_item, 0)::numeric(15, 2) AS valor_item,
    COALESCE(v.valor_pago_item, 0)::numeric(15, 2) AS valor_pago_item,
    COALESCE(v.valor_item, 0)::numeric(15, 2) AS inadimplencia,
    1::integer AS qtd_itens
  FROM bounds b
  INNER JOIN public.receita_itens_inadimplencia_elegiveis v
    ON EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM v.data_vencimento)::integer BETWEEN b.mes_inicio AND b.mes_fim
  INNER JOIN public.financeiro_parcelas_itens i ON i.id = v.id
  INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = v.ci_titulo
  WHERE COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') = p_cliente
    AND v.data_vencimento IS NOT NULL
    AND v.valor_item IS NOT NULL
    AND COALESCE(v.valor_item, 0) > 0
  ORDER BY v.data_vencimento, v.ci_titulo;
$$;

COMMENT ON FUNCTION public.receita_inadimplencia_cliente_detalhe_periodo(integer, integer, integer, text) IS
  'Títulos com vencimento no período (base proporcional da planilha VIOS).';

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

  SELECT COALESCE(ROUND(SUM(n.valor), 2), 0)::numeric(15, 2)
  INTO v_valor_periodo
  FROM public.receita_inadimplencia_periodo_net_clientes(p_ano, v_mes_inicio, v_mes_fim) n
  WHERE n.valor > 0;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.valor DESC), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT g.grupo_cliente AS cliente, g.valor
    FROM public.receita_inadimplencia_grupos_periodo(p_ano, v_mes_inicio, v_mes_fim) g
    ORDER BY g.valor DESC
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
    COALESCE(SUM(ec.previsto), 0)
  INTO v_evolucao, v_previsto_periodo
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
  'Dashboard: KPI período = saldo proporcional VIOS (só positivos); evolução = mensal proporcional.';
