-- Dashboard de inadimplência na página Receita: fechamentos mensais congelados + KPIs do período.

CREATE TABLE IF NOT EXISTS public.receita_inadimplencia_fechamento_mensal (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano           INTEGER NOT NULL,
  mes           INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor_total   NUMERIC(15, 2) NOT NULL DEFAULT 0,
  pct_recebido  NUMERIC(8, 4),
  congelado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT receita_inadimplencia_fechamento_mensal_ano_mes_key UNIQUE (ano, mes)
);

COMMENT ON TABLE public.receita_inadimplencia_fechamento_mensal IS
  'Snapshot congelado do valor total em inadimplência ao término de cada mês (planos da cota de receita).';

CREATE INDEX IF NOT EXISTS receita_inadimplencia_fechamento_mensal_ano_idx
  ON public.receita_inadimplencia_fechamento_mensal (ano);

ALTER TABLE public.receita_inadimplencia_fechamento_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read fechamento inadimplencia for anon"
  ON public.receita_inadimplencia_fechamento_mensal FOR SELECT TO anon USING (true);

CREATE POLICY "Allow read fechamento inadimplencia for authenticated"
  ON public.receita_inadimplencia_fechamento_mensal FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write fechamento inadimplencia for authenticated"
  ON public.receita_inadimplencia_fechamento_mensal FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Valor do item considerado em aberto / inadimplente.
CREATE OR REPLACE FUNCTION public.receita_item_valor_inadimplencia(i public.financeiro_parcelas_itens)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(i.valor_parcial_aberto, 0), i.valor_item, 0)::numeric(15, 2);
$$;

-- Itens da cota de receita (honorários), excluindo clientes/grupos inativos.
CREATE OR REPLACE FUNCTION public.receita_pessoa_categoria_inativa(categoria text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(categoria), '') = 'Cliente inativo';
$$;

CREATE OR REPLACE FUNCTION public.receita_item_cliente_ativo(i public.financeiro_parcelas_itens)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      JOIN pessoas p ON p.id = fp.pessoa_id
      WHERE fp.ci_titulo = i.ci_titulo
        AND public.receita_pessoa_categoria_inativa(p.categoria)
    ) THEN false
    WHEN EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      JOIN pessoas p ON p.id = fp.pessoa_id
      WHERE fp.ci_titulo = i.ci_titulo
        AND p.grupo_cliente IS NOT NULL
        AND trim(p.grupo_cliente) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM pessoas p2
          WHERE p2.grupo_cliente = p.grupo_cliente
            AND NOT public.receita_pessoa_categoria_inativa(p2.categoria)
        )
    ) THEN false
    WHEN NOT EXISTS (
      SELECT 1
      FROM financeiro_parcelas fp
      WHERE fp.ci_titulo = i.ci_titulo
        AND fp.pessoa_id IS NOT NULL
    )
    AND trim(coalesce(i.cliente, '')) <> ''
    AND EXISTS (
      SELECT 1
      FROM pessoas p
      WHERE upper(trim(p.nome)) = upper(trim(i.cliente))
        AND public.receita_pessoa_categoria_inativa(p.categoria)
    ) THEN false
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.receita_itens_cota_filtrados()
RETURNS SETOF public.financeiro_parcelas_itens
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR upper(trim(i.tipo)) = 'RECEBER')
    AND public.plano_contas_na_cota(i.plano_contas)
    AND public.receita_item_valor_inadimplencia(i) > 0
    AND public.receita_item_cliente_ativo(i);
$$;

-- Total em inadimplência em uma data de referência (fim de mês congelado).
CREATE OR REPLACE FUNCTION public.receita_calcular_inadimplencia_em(p_ref_date date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(public.receita_item_valor_inadimplencia(i)), 0)::numeric(15, 2)
  FROM public.receita_itens_cota_filtrados() i
  WHERE i.data_vencimento IS NOT NULL
    AND i.data_vencimento <= p_ref_date
    AND (i.data_pagamento IS NULL OR i.data_pagamento > p_ref_date);
$$;

-- Recebido no mês (mesma base da cota).
CREATE OR REPLACE FUNCTION public.receita_recebido_mes(p_ano integer, p_mes integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(i.valor_pago_item), 0)::numeric(15, 2)
  FROM public.receita_itens_cota_filtrados() i
  WHERE i.data_pagamento IS NOT NULL
    AND i.valor_pago_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes;
$$;

-- Congela fechamentos de meses já encerrados (não sobrescreve existentes).
CREATE OR REPLACE FUNCTION public.receita_inadimplencia_sincronizar(p_ano integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes integer;
  v_mes_fim integer;
  v_ref date;
  v_valor numeric(15, 2);
  v_recebido numeric(15, 2);
  v_pct numeric(8, 4);
  v_hoje date := CURRENT_DATE;
  v_ano_atual integer := EXTRACT(YEAR FROM v_hoje)::integer;
  v_mes_atual integer := EXTRACT(MONTH FROM v_hoje)::integer;
BEGIN
  IF p_ano > v_ano_atual THEN
    RETURN;
  END IF;

  IF p_ano = v_ano_atual THEN
    v_mes_fim := v_mes_atual - 1;
  ELSE
    v_mes_fim := 12;
  END IF;

  IF v_mes_fim < 1 THEN
    RETURN;
  END IF;

  -- Congela meses encerrados, exceto o mês anterior imediato (ainda exibido ao vivo no dashboard).
  IF p_ano = v_ano_atual THEN
    v_mes_fim := v_mes_atual - 2;
  END IF;

  IF v_mes_fim < 1 THEN
    RETURN;
  END IF;

  FOR v_mes IN 1..v_mes_fim LOOP
    IF EXISTS (
      SELECT 1 FROM receita_inadimplencia_fechamento_mensal f
      WHERE f.ano = p_ano AND f.mes = v_mes
    ) THEN
      CONTINUE;
    END IF;

    v_ref := (date_trunc('month', make_date(p_ano, v_mes, 1)) + interval '1 month - 1 day')::date;
    v_valor := public.receita_calcular_inadimplencia_em(v_ref);
    v_recebido := public.receita_recebido_mes(p_ano, v_mes);
    v_pct := CASE WHEN v_recebido > 0 THEN ROUND((v_valor / v_recebido) * 100, 2) ELSE NULL END;

    INSERT INTO receita_inadimplencia_fechamento_mensal (ano, mes, valor_total, pct_recebido)
    VALUES (p_ano, v_mes, v_valor, v_pct);
  END LOOP;
END;
$$;

-- Dashboard completo: KPIs do período Jan..mês anterior + evolução congelada.
CREATE OR REPLACE FUNCTION public.receita_inadimplencia_dashboard(p_ano integer)
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
    v_mes_fim := v_mes_atual - 1;
  ELSE
    v_mes_fim := 12;
  END IF;

  IF v_mes_fim < 1 THEN
    RETURN jsonb_build_object(
      'ano', p_ano,
      'mes_inicio', 1,
      'mes_fim', 0,
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

  v_inicio := make_date(p_ano, 1, 1);
  v_fim := (date_trunc('month', make_date(p_ano, v_mes_fim, 1)) + interval '1 month - 1 day')::date;

  IF v_mes_fim = 1 THEN
    v_periodo_label := v_mes_labels[1];
  ELSE
    v_periodo_label := v_mes_labels[1] || '–' || v_mes_labels[v_mes_fim];
  END IF;

  -- Valor total de inadimplência do período: títulos que venceram no intervalo e não foram pagos em dia.
  SELECT COALESCE(SUM(public.receita_item_valor_inadimplencia(i)), 0)::numeric(15, 2)
  INTO v_valor_periodo
  FROM public.receita_itens_cota_filtrados() i
  WHERE i.data_vencimento IS NOT NULL
    AND i.data_vencimento >= v_inicio
    AND i.data_vencimento <= v_fim
    AND (i.data_pagamento IS NULL OR i.data_pagamento > i.data_vencimento);

  SELECT COALESCE(SUM(public.receita_recebido_mes(p_ano, gs.m)), 0)::numeric(15, 2)
  INTO v_recebido_periodo
  FROM generate_series(1, v_mes_fim) AS gs(m);

  v_pct_periodo := CASE
    WHEN v_recebido_periodo > 0 THEN ROUND((v_valor_periodo / v_recebido_periodo) * 100, 1)
    ELSE 0
  END;

  -- Top 5 inadimplentes do período (por cliente).
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.valor DESC), '[]'::jsonb)
  INTO v_top5
  FROM (
    SELECT
      COALESCE(NULLIF(trim(i.cliente), ''), 'Sem cliente') AS cliente,
      ROUND(SUM(public.receita_item_valor_inadimplencia(i)), 2)::numeric(15, 2) AS valor
    FROM public.receita_itens_cota_filtrados() i
    WHERE i.data_vencimento IS NOT NULL
      AND i.data_vencimento >= v_inicio
      AND i.data_vencimento <= v_fim
      AND (
        COALESCE(upper(trim(i.situacao_titulo)), '') = 'ABERTO'
        OR i.data_pagamento IS NULL
        OR i.data_pagamento > i.data_vencimento
      )
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

  -- Evolução: congelados + mês anterior ao vivo (se ainda não congelado).
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
      COALESCE(
        f.valor_total,
        public.receita_calcular_inadimplencia_em(
          (date_trunc('month', make_date(p_ano, gs.m, 1)) + interval '1 month - 1 day')::date
        )
      ) AS valor,
      COALESCE(
        f.pct_recebido,
        CASE
          WHEN public.receita_recebido_mes(p_ano, gs.m) > 0 THEN ROUND(
            (
              public.receita_calcular_inadimplencia_em(
                (date_trunc('month', make_date(p_ano, gs.m, 1)) + interval '1 month - 1 day')::date
              ) / public.receita_recebido_mes(p_ano, gs.m)
            ) * 100,
            2
          )
          ELSE 0
        END
      ) AS pct,
      (f.ano IS NOT NULL) AS congelado
    FROM generate_series(1, v_mes_fim) AS gs(m)
    LEFT JOIN receita_inadimplencia_fechamento_mensal f
      ON f.ano = p_ano AND f.mes = gs.m
  ) e;

  SELECT (elem->>'valor')::numeric
  INTO v_primeiro_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer
  LIMIT 1;

  SELECT (elem->>'valor')::numeric
  INTO v_ultimo_valor
  FROM jsonb_array_elements(v_evolucao) AS elem
  ORDER BY (elem->>'mes')::integer DESC
  LIMIT 1;

  v_reducao_pct := CASE
    WHEN v_primeiro_valor IS NOT NULL AND v_primeiro_valor > 0 AND v_ultimo_valor IS NOT NULL THEN
      ROUND(((v_primeiro_valor - v_ultimo_valor) / v_primeiro_valor) * 100, 0)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'mes_inicio', 1,
    'mes_fim', v_mes_fim,
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

COMMENT ON FUNCTION public.receita_inadimplencia_dashboard(integer) IS
  'KPIs de inadimplência para a página Receita: período Jan..mês anterior, top 5, evolução congelada e concentração.';

GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_sincronizar(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_inadimplencia_dashboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_calcular_inadimplencia_em(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receita_recebido_mes(integer, integer) TO anon, authenticated;

-- Valores de referência manual (slide Jan–Abr/2026)
INSERT INTO public.receita_inadimplencia_fechamento_mensal (ano, mes, valor_total, pct_recebido)
VALUES
  (2026, 1, 405640.63, 35),
  (2026, 2, 391030.60, 34),
  (2026, 3, 264848.44, 22),
  (2026, 4, 170085.43, 14)
ON CONFLICT (ano, mes) DO UPDATE SET
  valor_total = EXCLUDED.valor_total,
  pct_recebido = EXCLUDED.pct_recebido,
  congelado_em = now();
