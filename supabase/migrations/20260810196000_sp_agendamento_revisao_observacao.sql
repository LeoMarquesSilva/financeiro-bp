-- Motivo do racional Cadastro = BI "REVISÃO - OBSERVAÇÃO"

ALTER TABLE public.sp_agendamento
  ADD COLUMN IF NOT EXISTS revisao_observacao text;

COMMENT ON COLUMN public.sp_agendamento.revisao_observacao IS
  'SharePoint REVISÃO - OBSERVAÇÃO (motivo da inconsistência no Cadastro).';
