-- "PRAZO NÃO PEREMPTÓRIO - ESTRATÉGIA PROCESSUAL" voltou a "Não" porque o
-- sync do SharePoint regrava sp_tarefas_historico.excludente via
-- computeExcludente. A correção de 2026-09-04 só atualizou o histórico
-- já carregado; o upsert seguinte desfez a flag.
--
-- O trigger garante a classificação mesmo se o sync em produção ainda
-- estiver com a lista antiga.

CREATE OR REPLACE FUNCTION public.sp_tarefas_historico_forcar_excludente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF upper(trim(COALESCE(NEW.justificativa_fatal, '')))
     = upper(trim('PRAZO NÃO PEREMPTÓRIO - ESTRATÉGIA PROCESSUAL')) THEN
    NEW.excludente := 'Excludente';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sp_tarefas_historico_forcar_excludente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sp_tarefas_historico_forcar_excludente() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_sp_tarefas_historico_excludente ON public.sp_tarefas_historico;

CREATE TRIGGER trg_sp_tarefas_historico_excludente
  BEFORE INSERT OR UPDATE OF justificativa_fatal, excludente
  ON public.sp_tarefas_historico
  FOR EACH ROW
  EXECUTE FUNCTION public.sp_tarefas_historico_forcar_excludente();

UPDATE public.sp_tarefas_historico
SET excludente = 'Excludente'
WHERE upper(trim(justificativa_fatal))
      = upper(trim('PRAZO NÃO PEREMPTÓRIO - ESTRATÉGIA PROCESSUAL'))
  AND excludente IS DISTINCT FROM 'Excludente';
