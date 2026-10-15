-- Campo "OBSERVAÇÕES / QUALIFICAÇÃO / ASSUNTOS" da lista SharePoint CONTROLE DE PROTOCOLOS.
-- Exibido no racional da Eficiência Protocolo (Jurídico).

ALTER TABLE public.sp_protocolos
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

COMMENT ON COLUMN public.sp_protocolos.observacoes IS
  'SharePoint OBSERVAÇÕES / QUALIFICAÇÃO / ASSUNTOS (OBSERVA_x00c7__x00d5_ES_x002f_QU), texto multilinha.';
