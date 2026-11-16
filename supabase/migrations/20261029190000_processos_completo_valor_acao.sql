-- Processos Completo: valores da ação vindos do relatório VIOS (sync ProcessoCompleto).
-- "Fase" já tinha coluna (fase_processual); só passou a vir no relatório.

ALTER TABLE public.processos_completo
  ADD COLUMN IF NOT EXISTS valor_acao numeric,
  ADD COLUMN IF NOT EXISTS valor_acao_atualizado numeric;

COMMENT ON COLUMN public.processos_completo.valor_acao IS
  'Coluna "Valor da Ação" do relatório de processos VIOS.';
COMMENT ON COLUMN public.processos_completo.valor_acao_atualizado IS
  'Coluna "Valor da ação atualizado" do relatório de processos VIOS.';
