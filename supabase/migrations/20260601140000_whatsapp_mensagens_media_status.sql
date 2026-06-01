-- Campos para mídia, status de entrega/leitura e reações
ALTER TABLE whatsapp_mensagens ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE whatsapp_mensagens ADD COLUMN IF NOT EXISTS reaction_to TEXT;
ALTER TABLE whatsapp_mensagens ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_meta JSONB;

COMMENT ON COLUMN whatsapp_mensagens.status IS 'PENDING, SERVER_ACK, DELIVERY_ACK, READ, PLAYED (Evolution/Baileys)';
COMMENT ON COLUMN whatsapp_mensagens.reaction_to IS 'message_id da mensagem reagida (tipo reactionMessage)';
COMMENT ON COLUMN whatsapp_mensagens.reactions IS 'Array JSON de reações agregadas [{emoji, fromMe, pushName}]';
COMMENT ON COLUMN whatsapp_mensagens.media_meta IS 'mimetype, fileName, seconds, caption, ptt, cachedAt';

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_reaction_to
  ON whatsapp_mensagens(reaction_to)
  WHERE reaction_to IS NOT NULL;
