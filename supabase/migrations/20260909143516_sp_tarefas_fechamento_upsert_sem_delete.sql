-- Fechamento: sync incremental. O Tarefas.csv do VIOS pode vir só com
-- concluídas dos últimos dias — não apagar CIs que não vieram no recorte.

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
  upserted_count int;
BEGIN
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
    'deleted', 0,
    'upserted', upserted_count
  );
END;
$$;

COMMENT ON FUNCTION public.sync_sp_tarefas_fechamento_replace(bigint[], jsonb) IS
  'Sync VIOS Tarefas.csv (9 tarefas Fechamento): upsert por CI. '
  'Não remove linhas ausentes do recorte (p_cis ignorado).';
