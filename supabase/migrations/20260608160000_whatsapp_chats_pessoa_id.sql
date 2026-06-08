-- Vínculo manual: conversa WhatsApp -> cliente (pessoa) do escritório.
ALTER TABLE whatsapp_chats
  ADD COLUMN IF NOT EXISTS pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_pessoa_id
  ON whatsapp_chats(pessoa_id)
  WHERE pessoa_id IS NOT NULL;
