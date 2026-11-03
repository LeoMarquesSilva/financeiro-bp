-- Processos Completo: síntese do processo vinda do relatório VIOS (sync ProcessoCompleto).
-- A vistagem de publicações (Orquestra) mostra essa síntese para o jurídico.

ALTER TABLE public.processos_completo
  ADD COLUMN IF NOT EXISTS observacoes text;

COMMENT ON COLUMN public.processos_completo.observacoes IS
  'Coluna "Observações (síntese do processo)" do relatório de processos VIOS.';
