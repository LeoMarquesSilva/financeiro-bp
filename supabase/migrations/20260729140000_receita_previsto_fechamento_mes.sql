-- Fechamento explícito do previsto do mês vs composição do caixa recebido.

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
  v_receita_mes_caixa numeric(15, 2);
  v_inad_recebida numeric(15, 2);
  v_novos_total numeric(15, 2);
  v_novos_venc_mes numeric(15, 2);
  v_quitado_outro_mes numeric(15, 2);
  v_receita_mes_previsto numeric(15, 2);
  v_inad_kpi numeric(15, 2);
  v_soma_fechamento numeric(15, 2);
  v_ajuste numeric(15, 2);
  v_recebido_classificado numeric(15, 2);
  v_evolucao jsonb;
BEGIN
  v_previsto := public.receita_previsto_mes(p_ano, p_mes);

  SELECT
    COALESCE(SUM(CASE WHEN c.categoria = 'receita_mes' THEN c.valor_recebido END), 0),
    COALESCE(SUM(CASE WHEN c.categoria = 'inadimplencia' THEN c.valor_recebido END), 0),
    COALESCE(SUM(CASE WHEN c.categoria = 'novos_contratos' THEN c.valor_recebido END), 0),
    COALESCE(SUM(CASE
      WHEN c.categoria = 'novos_contratos'
        AND c.data_vencimento IS NOT NULL
        AND EXTRACT(YEAR FROM c.data_vencimento)::integer = p_ano
        AND EXTRACT(MONTH FROM c.data_vencimento)::integer = p_mes
      THEN c.valor_recebido
    END), 0),
    COALESCE(SUM(c.valor_recebido), 0)
  INTO
    v_receita_mes_caixa,
    v_inad_recebida,
    v_novos_total,
    v_novos_venc_mes,
    v_recebido_classificado
  FROM public.receita_recebido_classificacao_mes(p_ano, p_mes) c;

  SELECT COALESCE(SUM(COALESCE(i.valor_item, 0)), 0)::numeric(15, 2)
  INTO v_receita_mes_previsto
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_vencimento IS NOT NULL
    AND i.valor_item IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
    AND i.data_pagamento IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_pagamento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_pagamento)::integer = p_mes;

  SELECT COALESCE(SUM(public.receita_item_recebido_liquido(i)), 0)::numeric(15, 2)
  INTO v_quitado_outro_mes
  FROM financeiro_parcelas_itens i
  WHERE (i.tipo IS NULL OR i.tipo = 'RECEBER')
    AND i.plano_contas IS NOT NULL
    AND public.plano_contas_na_cota(i.plano_contas)
    AND i.data_vencimento IS NOT NULL
    AND EXTRACT(YEAR FROM i.data_vencimento)::integer = p_ano
    AND EXTRACT(MONTH FROM i.data_vencimento)::integer = p_mes
    AND i.data_pagamento IS NOT NULL
    AND (
      EXTRACT(YEAR FROM i.data_pagamento)::integer <> p_ano
      OR EXTRACT(MONTH FROM i.data_pagamento)::integer <> p_mes
    );

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

  v_soma_fechamento :=
    v_receita_mes_caixa + v_inad_kpi + v_quitado_outro_mes + v_novos_venc_mes;
  v_ajuste := ROUND((v_previsto - v_soma_fechamento)::numeric, 2);

  RETURN jsonb_build_object(
    'previsto', v_previsto,
    'receita_mes_caixa', v_receita_mes_caixa,
    'receita_mes_previsto', v_receita_mes_previsto,
    'inadimplencia_kpi', v_inad_kpi,
    'inad_recebida', v_inad_recebida,
    'novos_total', v_novos_total,
    'novos_venc_mes', v_novos_venc_mes,
    'quitado_outro_mes', v_quitado_outro_mes,
    'recebido_classificado', v_recebido_classificado,
    'soma_fechamento_previsto', v_soma_fechamento,
    'ajuste_tecnico', v_ajuste
  );
END;
$$;

COMMENT ON FUNCTION public.receita_previsto_fechamento_mes(integer, integer) IS
  'Decomposição do previsto do mês e do caixa recebido para exibição no detalhe de recebimento.';

GRANT EXECUTE ON FUNCTION public.receita_previsto_fechamento_mes(integer, integer) TO anon, authenticated;
