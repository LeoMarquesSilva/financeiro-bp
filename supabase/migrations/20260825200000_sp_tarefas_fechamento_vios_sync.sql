-- Tarefas de Fechamento financeiro Ops Legais (9 tipos VIOS, qualquer status).
-- Populada pelo sync VIOS (runSyncTarefasFechamento) a partir de Tarefas.csv.

CREATE TABLE public.sp_tarefas_fechamento (
  ci                   BIGINT PRIMARY KEY,
  tarefa               TEXT NOT NULL,
  status               TEXT,
  usuario_conclusao    TEXT,
  data_conclusao       DATE,
  data_para_conclusao  DATE,
  data_limite          DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sp_tarefas_fechamento_tarefa_idx
  ON public.sp_tarefas_fechamento (tarefa);
CREATE INDEX sp_tarefas_fechamento_data_limite_idx
  ON public.sp_tarefas_fechamento (data_limite);
CREATE INDEX sp_tarefas_fechamento_status_idx
  ON public.sp_tarefas_fechamento (status);

COMMENT ON TABLE public.sp_tarefas_fechamento IS
  'Tarefas VIOS do ciclo de Fechamento financeiro Ops Legais (9 tipos, qualquer status). '
  'Sync diário via runSyncTarefasFechamento (Tarefas.csv). Isolada de sp_tarefas.';

CREATE TRIGGER sp_tarefas_fechamento_updated_at
  BEFORE UPDATE ON public.sp_tarefas_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.sp_tarefas_fechamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon"
  ON public.sp_tarefas_fechamento FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated"
  ON public.sp_tarefas_fechamento FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Replace atômico: snapshot do CSV filtrado (fonte da verdade do recorte VIOS).
CREATE OR REPLACE FUNCTION public.sync_sp_tarefas_fechamento_replace(
  p_cis bigint[] DEFAULT '{}',
  p_rows jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
  upserted_count int;
BEGIN
  DELETE FROM public.sp_tarefas_fechamento
  WHERE (p_cis IS NULL OR array_length(p_cis, 1) IS NULL OR array_length(p_cis, 1) = 0)
     OR NOT (ci = ANY(p_cis));
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO public.sp_tarefas_fechamento (
      ci,
      tarefa,
      status,
      usuario_conclusao,
      data_conclusao,
      data_para_conclusao,
      data_limite
    )
    SELECT
      (r->>'ci')::bigint,
      NULLIF(TRIM(r->>'tarefa'), ''),
      NULLIF(TRIM(r->>'status'), ''),
      NULLIF(TRIM(r->>'usuario_conclusao'), ''),
      NULLIF(r->>'data_conclusao', '')::date,
      NULLIF(r->>'data_para_conclusao', '')::date,
      NULLIF(r->>'data_limite', '')::date
    FROM jsonb_array_elements(p_rows) AS r
    ON CONFLICT (ci) DO UPDATE SET
      tarefa              = EXCLUDED.tarefa,
      status              = EXCLUDED.status,
      usuario_conclusao   = EXCLUDED.usuario_conclusao,
      data_conclusao      = EXCLUDED.data_conclusao,
      data_para_conclusao = EXCLUDED.data_para_conclusao,
      data_limite         = EXCLUDED.data_limite,
      updated_at          = now();
    GET DIAGNOSTICS upserted_count = ROW_COUNT;
  ELSE
    upserted_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'deleted', deleted_count,
    'upserted', upserted_count
  );
END;
$$;

COMMENT ON FUNCTION public.sync_sp_tarefas_fechamento_replace(bigint[], jsonb) IS
  'Sync VIOS Tarefas.csv filtrado (9 tarefas Fechamento): remove CIs fora do snapshot e faz upsert.';

GRANT EXECUTE ON FUNCTION public.sync_sp_tarefas_fechamento_replace(bigint[], jsonb)
  TO anon, authenticated;

-- KPI Fechamento: lê sp_tarefas_fechamento (não sp_tarefas).
CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_fechamento_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total_fechamentos integer,
  qtd_dentro_prazo integer,
  qtd_fora_prazo integer,
  pct_fechamento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH kpi AS (
    SELECT
      EXTRACT(
        MONTH FROM (date_trunc('month', t.data_limite) - interval '1 month')
      )::integer AS mes,
      t.data_conclusao,
      t.data_limite
    FROM public.sp_tarefas_fechamento t
    WHERE t.tarefa = 'ENVIO FECHAMENTO COMPLETO E DL APURADA'
      AND t.data_limite IS NOT NULL
      AND EXTRACT(
        YEAR FROM (date_trunc('month', t.data_limite) - interval '1 month')
      )::integer = p_ano
  ),
  avaliacao AS (
    SELECT
      mes,
      CASE
        WHEN data_conclusao IS NOT NULL AND data_conclusao <= data_limite THEN 'dentro'
        ELSE 'fora'
      END AS status_kpi
    FROM kpi
  )
  SELECT
    mes,
    COUNT(*)::integer AS total_fechamentos,
    COUNT(*) FILTER (WHERE status_kpi = 'dentro')::integer AS qtd_dentro_prazo,
    COUNT(*) FILTER (WHERE status_kpi = 'fora')::integer AS qtd_fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_kpi = 'dentro')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_fechamento
  FROM avaliacao
  GROUP BY mes
  ORDER BY mes;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_fechamento_mensal(integer) IS
  'BI Ops Legais / Fechamento: % por competência na tarefa '
  'ENVIO FECHAMENTO COMPLETO E DL APURADA (sp_tarefas_fechamento).';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_fechamento_mensal(integer) TO authenticated;
