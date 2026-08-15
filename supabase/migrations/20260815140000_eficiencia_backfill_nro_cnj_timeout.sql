-- Sync SharePoint: backfill nro_cnj estourava statement_timeout em
-- sp_tarefas_historico (~250k linhas) sem índice em ci_processo.

CREATE INDEX IF NOT EXISTS sp_tarefas_ci_processo_idx
  ON public.sp_tarefas (ci_processo);

CREATE INDEX IF NOT EXISTS sp_tarefas_historico_ci_processo_idx
  ON public.sp_tarefas_historico (ci_processo);

CREATE INDEX IF NOT EXISTS sp_tarefas_sem_nro_cnj_idx
  ON public.sp_tarefas (ci_processo)
  WHERE nro_cnj IS NULL OR nro_cnj = '';

CREATE INDEX IF NOT EXISTS sp_tarefas_historico_sem_nro_cnj_idx
  ON public.sp_tarefas_historico (ci_processo)
  WHERE nro_cnj IS NULL OR nro_cnj = '';

CREATE OR REPLACE FUNCTION public.eficiencia_backfill_nro_cnj_de_processo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  n_hist integer := 0;
  n_tar integer := 0;
BEGIN
  UPDATE public.sp_tarefas_historico th
  SET
    nro_cnj = p.numero,
    updated_at = now()
  FROM public.sp_processos_numero p
  WHERE th.ci_processo = p.ci
    AND (th.nro_cnj IS NULL OR th.nro_cnj = '')
    AND p.numero IS NOT NULL
    AND p.numero <> '';
  GET DIAGNOSTICS n_hist = ROW_COUNT;

  UPDATE public.sp_tarefas t
  SET
    nro_cnj = p.numero,
    updated_at = now()
  FROM public.sp_processos_numero p
  WHERE t.ci_processo = p.ci
    AND (t.nro_cnj IS NULL OR t.nro_cnj = '')
    AND p.numero IS NOT NULL
    AND p.numero <> '';
  GET DIAGNOSTICS n_tar = ROW_COUNT;

  RETURN jsonb_build_object(
    'tarefas_historico', n_hist,
    'tarefas', n_tar
  );
END;
$$;

COMMENT ON FUNCTION public.eficiencia_backfill_nro_cnj_de_processo() IS
  'Coalesce nro_cnj vazio em sp_tarefas* com sp_processos_numero.numero. Timeout 120s + índice em ci_processo.';
