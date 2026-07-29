-- Fechamento do previsto: base valor_item (vencimento do mês), fecha sem ajuste técnico.

CREATE OR REPLACE FUNCTION public.receita_previsto_fechamento_mes(
  p_ano integer,
  p_mes integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previsto numeric(15, 2);
  v_quitado_no_mes numeric(15, 2);
  v_quitado_outro_mes numeric(15, 2);
  v_em_aberto numeric(15, 2);
  v_receita_mes_caixa numeric(15, 2);
  v_inad_recebida numeric(15, 2);
  v_novos_total numeric(15, 2);
  v_recebido_classificado numeric(15, 2);
  v_inad_kpi numeric(15, 2);
  v_evolucao jsonb;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(i.valor_item, 0)), 0)::numeric(15, 2),
    COALESCE(SUM(CASE
      WHEN i.data_pagamento IS NOT NULL
        AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
        AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes
      THEN COALESCE(i.valor_item, 0)
    END), 0)::numeric(15, 2),
    COALESCE(SUM(CASE
      WHEN i.data_pagamento IS NOT NULL
        AND (
          EXTRACT(YEAR FROM i.data_pagamento)::integer <> p_ano
          OR EXTRACT(MONTH FROM i.data_pagamento)::integer <> p_mes
        )
      THEN COALESCE(i.valor_item, 0)
    END), 0)::numeric(15, 2),
    COALESCE(SUM(CASE
      WHEN i.data_pagamento IS NULL THEN COALESCE(i.valor_item, 0)
    END), 0)::numeric(15, 2)
  INTO v_previsto, v_quitado_no_mes, v_quitado_outro_mes, v_em_aberto
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes;

  SELECT
    COALESCE(SUM(CASE WHEN c.categoria = 'receita_mes' THEN c.valor_recebido END), 0),
    COALESCE(SUM(CASE WHEN c.categoria = 'inadimplencia' THEN c.valor_recebido END), 0),
    COALESCE(SUM(CASE WHEN c.categoria = 'novos_contratos' THEN c.valor_recebido END), 0),
    COALESCE(SUM(c.valor_recebido), 0)
  INTO v_receita_mes_caixa, v_inad_recebida, v_novos_total, v_recebido_classificado
  FROM public.receita_recebido_classificacao_mes(p_ano, p_mes) c;

  v_evolucao := public.receita_inadimplencia_dashboard(p_ano, p_mes, p_mes)->'evolucao';
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN (elem->>'congelado')::boolean THEN COALESCE((elem->>'valor_congelado')::numeric, (elem->>'valor')::numeric)
        ELSE COALESCE((elem->>'valor_calculado')::numeric, (elem->>'valor')::numeric)
      END
      FROM jsonb_array_elements(v_evolucao) AS elem
      WHERE (elem->>'mes')::integer = p_mes
      LIMIT 1
    ),
    0
  )::numeric(15, 2)
  INTO v_inad_kpi;

  RETURN jsonb_build_object(
    'previsto', v_previsto,
    'quitado_no_mes', v_quitado_no_mes,
    'quitado_outro_mes', v_quitado_outro_mes,
    'em_aberto', v_em_aberto,
    'inadimplencia_kpi', v_inad_kpi,
    'receita_mes_caixa', v_receita_mes_caixa,
    'inad_recebida', v_inad_recebida,
    'novos_total', v_novos_total,
    'recebido_classificado', v_recebido_classificado
  );
END;
$$;

COMMENT ON FUNCTION public.receita_previsto_fechamento_mes(integer, integer) IS
  'Previsto do mês = quitado no mês + quitado em outro mês + em aberto (valor_item). Caixa classificado separado.';
