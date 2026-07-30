-- Correção monetária INPC + juros moratórios TJSP (1% a.m.) para inadimplência judicializada.

CREATE TABLE IF NOT EXISTS public.indices_inpc_mensal (
  referencia_mes DATE PRIMARY KEY,
  variacao_pct   NUMERIC(8, 4) NOT NULL
);

COMMENT ON TABLE public.indices_inpc_mensal IS
  'Variação mensal do INPC (IBGE). referencia_mes = primeiro dia do mês de referência.';

INSERT INTO public.indices_inpc_mensal (referencia_mes, variacao_pct) VALUES
  ('2023-01-01', 0.4600),
  ('2023-02-01', 0.7700),
  ('2023-03-01', 0.6400),
  ('2023-04-01', 0.5300),
  ('2023-05-01', 0.3600),
  ('2023-06-01', -0.1000),
  ('2023-07-01', -0.0900),
  ('2023-08-01', 0.2000),
  ('2023-09-01', 0.1100),
  ('2023-10-01', 0.1200),
  ('2023-11-01', 0.1000),
  ('2023-12-01', 0.5500),
  ('2024-01-01', 0.5700),
  ('2024-02-01', 0.8100),
  ('2024-03-01', 0.1900),
  ('2024-04-01', 0.3700),
  ('2024-05-01', 0.4600),
  ('2024-06-01', 0.2500),
  ('2024-07-01', 0.2600),
  ('2024-08-01', -0.1400),
  ('2024-09-01', 0.4800),
  ('2024-10-01', 0.6100),
  ('2024-11-01', 0.3300),
  ('2024-12-01', 0.4800),
  ('2025-01-01', 0.0000),
  ('2025-02-01', 1.4800),
  ('2025-03-01', 0.5100),
  ('2025-04-01', 0.4800),
  ('2025-05-01', 0.3500),
  ('2025-06-01', 0.2300),
  ('2025-07-01', 0.2100),
  ('2025-08-01', -0.2100),
  ('2025-09-01', 0.5200),
  ('2025-10-01', 0.0300),
  ('2025-11-01', 0.0300),
  ('2025-12-01', 0.2100),
  ('2026-01-01', 0.3900),
  ('2026-02-01', 0.5600),
  ('2026-03-01', 0.9100),
  ('2026-04-01', 0.8100),
  ('2026-05-01', 0.6500),
  ('2026-06-01', 0.1400)
ON CONFLICT (referencia_mes) DO UPDATE
  SET variacao_pct = EXCLUDED.variacao_pct;

ALTER TABLE public.indices_inpc_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS indices_inpc_mensal_select ON public.indices_inpc_mensal;
CREATE POLICY indices_inpc_mensal_select
  ON public.indices_inpc_mensal FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS indices_inpc_mensal_select_anon ON public.indices_inpc_mensal;
CREATE POLICY indices_inpc_mensal_select_anon
  ON public.indices_inpc_mensal FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION public.atualizar_valor_inpc_tjsp(
  p_valor NUMERIC,
  p_data_inicio DATE,
  p_data_fim DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  valor_nominal NUMERIC,
  valor_corrigido_inpc NUMERIC,
  valor_correcao_inpc NUMERIC,
  valor_juros_mora NUMERIC,
  valor_atualizado NUMERIC,
  meses_atualizacao INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_corrigido NUMERIC;
  v_mes DATE;
  v_mes_fim DATE;
  v_variacao NUMERIC;
  v_meses INTEGER := 0;
  v_juros NUMERIC;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 OR p_data_inicio IS NULL THEN
    RETURN QUERY
    SELECT
      COALESCE(p_valor, 0)::NUMERIC(15, 2),
      COALESCE(p_valor, 0)::NUMERIC(15, 2),
      0::NUMERIC(15, 2),
      0::NUMERIC(15, 2),
      COALESCE(p_valor, 0)::NUMERIC(15, 2),
      0;
    RETURN;
  END IF;

  v_corrigido := p_valor;
  v_mes := date_trunc('month', p_data_inicio)::DATE;
  v_mes_fim := date_trunc('month', p_data_fim)::DATE;

  WHILE v_mes <= v_mes_fim LOOP
    SELECT i.variacao_pct
      INTO v_variacao
      FROM public.indices_inpc_mensal i
     WHERE i.referencia_mes = v_mes;

    IF v_variacao IS NOT NULL THEN
      v_corrigido := v_corrigido * (1 + v_variacao / 100.0);
    END IF;

    v_meses := v_meses + 1;
    v_mes := (v_mes + INTERVAL '1 month')::DATE;
  END LOOP;

  v_juros := p_valor * 0.01 * v_meses;

  RETURN QUERY
  SELECT
    ROUND(p_valor, 2)::NUMERIC(15, 2),
    ROUND(v_corrigido, 2)::NUMERIC(15, 2),
    ROUND(v_corrigido - p_valor, 2)::NUMERIC(15, 2),
    ROUND(v_juros, 2)::NUMERIC(15, 2),
    ROUND(v_corrigido + v_juros, 2)::NUMERIC(15, 2),
    v_meses;
END;
$$;

COMMENT ON FUNCTION public.atualizar_valor_inpc_tjsp(NUMERIC, DATE, DATE) IS
  'Correção INPC (composta) + juros moratórios TJSP 1% a.m. simples sobre o principal, do mês da judicialização até a data fim.';

DROP VIEW IF EXISTS public.inadimplencia_judicializada_list;

CREATE VIEW public.inadimplencia_judicializada_list AS
SELECT
  j.id,
  j.grupo_cliente,
  j.grupo_chave,
  j.processo_id,
  j.valor_em_aberto_auto,
  j.valor_em_aberto_ajuste,
  COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto) AS valor_em_aberto_nominal,
  COALESCE(atual.valor_atualizado, COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto)) AS valor_em_aberto,
  COALESCE(atual.valor_correcao_inpc, 0)::NUMERIC(15, 2) AS valor_correcao_inpc,
  COALESCE(atual.valor_juros_mora, 0)::NUMERIC(15, 2) AS valor_juros_mora,
  COALESCE(atual.meses_atualizacao, 0) AS meses_atualizacao,
  j.data_judicializacao,
  j.observacoes,
  j.encerrado_at,
  j.created_by,
  j.created_at,
  j.updated_at,
  COALESCE(j.nro_cnj, p.nro_cnj) AS nro_cnj,
  p.acao,
  p.area,
  p.departamento,
  p.situacao_processo,
  p.fase_processual,
  p.advogado_responsavel,
  p.cliente AS processo_cliente,
  j.parte_passiva,
  j.valor_causa,
  j.status_planilha,
  j.andamentos_resumo,
  j.providencias_planilha,
  j.citacao,
  j.tribunal,
  j.tipo_acao_planilha,
  j.importado_em,
  j.importado_de,
  j.andamentos_sync_em,
  j.andamentos_fonte
FROM public.inadimplencia_judicializada j
JOIN public.processos_completo p ON p.id = j.processo_id
LEFT JOIN LATERAL public.atualizar_valor_inpc_tjsp(
  COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto),
  j.data_judicializacao
) atual ON j.data_judicializacao IS NOT NULL
  AND COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto) > 0;

COMMENT ON VIEW public.inadimplencia_judicializada_list IS
  'Lista judicializada com valor em aberto atualizado (INPC + juros TJSP 1% a.m.) a partir de data_judicializacao.';
