-- Performance: view com JOIN + dashboard em batch (sem sync no read).

CREATE INDEX IF NOT EXISTS idx_fpi_data_vencimento
  ON public.financeiro_parcelas_itens (data_vencimento)
  WHERE data_vencimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fpi_data_pagamento
  ON public.financeiro_parcelas_itens (data_pagamento)
  WHERE data_pagamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fp_ci_titulo_pessoa
  ON public.financeiro_parcelas (ci_titulo, pessoa_id);

CREATE OR REPLACE VIEW public.receita_itens_inadimplencia_elegiveis AS
SELECT
  i.id,
  i.ci_item,
  i.ci_titulo,
  i.cliente,
  i.plano_contas,
  i.tipo,
  i.valor_item,
  i.valor_parcial_aberto,
  i.valor_pago_item,
  i.situacao_titulo,
  i.data_vencimento,
  i.data_pagamento,
  fp.pessoa_id,
  p.grupo_cliente,
  p.categoria
FROM public.financeiro_parcelas_itens i
INNER JOIN public.financeiro_parcelas fp ON fp.ci_titulo = i.ci_titulo
INNER JOIN public.pessoas p ON p.id = fp.pessoa_id
WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
  AND public.plano_contas_na_cota(i.plano_contas)
  AND COALESCE(trim(p.categoria), '') <> 'Cliente inativo'
  AND p.grupo_cliente IS NOT NULL
  AND trim(p.grupo_cliente) <> '';

CREATE OR REPLACE FUNCTION public.receita_itens_cota_base()
RETURNS SETOF public.financeiro_parcelas_itens
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
  FROM public.financeiro_parcelas_itens i
  INNER JOIN public.receita_itens_inadimplencia_elegiveis v ON v.ci_item = i.ci_item;
$$;

CREATE OR REPLACE FUNCTION public.receita_inadimplencia_mes_faturado(p_ano integer, p_mes integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(COALESCE(v.valor_item, 0)), 0)::numeric(15, 2)
  FROM public.receita_itens_inadimplencia_elegiveis v
  WHERE v.data_vencimento IS NOT NULL
    AND v.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM v.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM v.data_vencimento)::integer = p_mes
    AND (v.data_pagamento IS NULL OR v.data_pagamento > v.data_vencimento);
$$;

CREATE OR REPLACE FUNCTION public.receita_recebido_mes(p_ano integer, p_mes integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(v.valor_pago_item), 0)::numeric(15, 2)
  FROM public.receita_itens_inadimplencia_elegiveis v
  WHERE v.data_pagamento IS NOT NULL
    AND v.valor_pago_item IS NOT NULL
    AND EXTRACT(YEAR FROM v.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM v.data_pagamento)::integer = p_mes;
$$;

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
      COALESCE(NULLIF(trim(v.cliente), ''), 'Sem cliente') AS cliente,
      ROUND(SUM(COALESCE(v.valor_item, 0)), 2)::numeric(15, 2) AS valor
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_vencimento >= v_inicio
      AND v.data_vencimento <= v_fim
      AND v.valor_item IS NOT NULL
      AND (v.data_pagamento IS NULL OR v.data_pagamento > v.data_vencimento)
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(SUM((elem->>'valor')::numeric), 0)::numeric(15, 2)
  INTO v_top5_total
  FROM jsonb_array_elements(v_top5) AS elem;

  WITH inad_por_mes AS (
    SELECT
      EXTRACT(MONTH FROM v.data_vencimento)::integer AS mes,
      SUM(COALESCE(v.valor_item, 0))::numeric(15, 2) AS valor_calc
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_vencimento >= v_inicio
      AND v.data_vencimento <= v_fim
      AND v.valor_item IS NOT NULL
      AND (v.data_pagamento IS NULL OR v.data_pagamento > v.data_vencimento)
    GROUP BY 1
  ),
  recebido_por_mes AS (
    SELECT
      EXTRACT(MONTH FROM v.data_pagamento)::integer AS mes,
      SUM(COALESCE(v.valor_pago_item, 0))::numeric(15, 2) AS recebido
    FROM public.receita_itens_inadimplencia_elegiveis v
    WHERE v.data_pagamento >= v_inicio
      AND v.data_pagamento <= v_fim
      AND v.valor_pago_item IS NOT NULL
    GROUP BY 1
  ),
  evolucao_calc AS (
    SELECT
      m.mes,
      COALESCE(f.valor_total, COALESCE(ip.valor_calc, 0))::numeric(15, 2) AS valor,
      CASE
        WHEN COALESCE(r.recebido, 0) > 0 THEN ROUND(
          (COALESCE(f.valor_total, COALESCE(ip.valor_calc, 0)) / r.recebido) * 100, 2
        )
        ELSE COALESCE(f.pct_recebido, 0)
      END AS pct,
      (f.ano IS NOT NULL) AS congelado
    FROM generate_series(v_mes_inicio, v_mes_fim) AS m(mes)
    LEFT JOIN inad_por_mes ip ON ip.mes = m.mes
    LEFT JOIN recebido_por_mes r ON r.mes = m.mes
    LEFT JOIN receita_inadimplencia_fechamento_mensal f
      ON f.ano = p_ano AND f.mes = m.mes
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'mes', ec.mes,
        'mes_label', v_mes_labels[ec.mes],
        'valor', ec.valor,
        'pct', ec.pct,
        'congelado', ec.congelado
      ) ORDER BY ec.mes
    ), '[]'::jsonb),
    COALESCE(SUM(ec.valor), 0),
    COALESCE(SUM(COALESCE(r.recebido, 0)), 0)
  INTO v_evolucao, v_valor_periodo, v_recebido_periodo
  FROM evolucao_calc ec
  LEFT JOIN recebido_por_mes r ON r.mes = ec.mes;

  v_pct_periodo := CASE
    WHEN v_recebido_periodo > 0 THEN ROUND((v_valor_periodo / v_recebido_periodo) * 100, 1)
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

GRANT SELECT ON public.receita_itens_inadimplencia_elegiveis TO anon, authenticated;
