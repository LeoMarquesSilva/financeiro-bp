-- Categorias de conversas WhatsApp (filtro e classificação manual).

ALTER TABLE whatsapp_chats
  ADD COLUMN IF NOT EXISTS categoria TEXT;

ALTER TABLE whatsapp_chats DROP CONSTRAINT IF EXISTS whatsapp_chats_categoria_check;
ALTER TABLE whatsapp_chats ADD CONSTRAINT whatsapp_chats_categoria_check
  CHECK (categoria IS NULL OR categoria IN ('COBRANCA', 'COLABORADOR_BP', 'SOCIO'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_categoria ON whatsapp_chats(categoria);

COMMENT ON COLUMN whatsapp_chats.categoria IS
  'Categoria manual da conversa: COBRANCA, COLABORADOR_BP, SOCIO.';
