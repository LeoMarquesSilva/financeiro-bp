-- Vínculo N:N: conversa WhatsApp pode estar ligada a vários clientes.
CREATE TABLE IF NOT EXISTS whatsapp_chat_pessoas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_jid TEXT NOT NULL REFERENCES whatsapp_chats(remote_jid) ON DELETE CASCADE,
  pessoa_id  UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (remote_jid, pessoa_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_pessoas_remote_jid
  ON whatsapp_chat_pessoas (remote_jid);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_pessoas_pessoa_id
  ON whatsapp_chat_pessoas (pessoa_id);

ALTER TABLE whatsapp_chat_pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on whatsapp_chat_pessoas"
  ON whatsapp_chat_pessoas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon on whatsapp_chat_pessoas"
  ON whatsapp_chat_pessoas FOR ALL TO anon USING (true) WITH CHECK (true);

-- Migra vínculo legado (coluna única pessoa_id).
INSERT INTO whatsapp_chat_pessoas (remote_jid, pessoa_id)
SELECT wc.remote_jid, wc.pessoa_id
FROM whatsapp_chats wc
WHERE wc.pessoa_id IS NOT NULL
ON CONFLICT (remote_jid, pessoa_id) DO NOTHING;
