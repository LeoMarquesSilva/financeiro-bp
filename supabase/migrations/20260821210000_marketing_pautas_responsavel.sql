ALTER TABLE public.sp_tarefas
  ADD COLUMN IF NOT EXISTS responsavel TEXT;

ALTER TABLE public.sp_tarefas_historico
  ADD COLUMN IF NOT EXISTS responsavel TEXT;

CREATE INDEX IF NOT EXISTS sp_tarefas_responsavel_idx
  ON public.sp_tarefas (lower(trim(responsavel)))
  WHERE responsavel IS NOT NULL;

CREATE INDEX IF NOT EXISTS sp_tarefas_historico_responsavel_idx
  ON public.sp_tarefas_historico (lower(trim(responsavel)))
  WHERE responsavel IS NOT NULL;

COMMENT ON COLUMN public.sp_tarefas.responsavel IS
  'Pessoa explicitamente atribuída à tarefa na agenda de origem; não inferida pelo usuário de conclusão.';

COMMENT ON COLUMN public.sp_tarefas_historico.responsavel IS
  'Pessoa explicitamente atribuída à tarefa na agenda de origem; não inferida pelo usuário de conclusão.';
