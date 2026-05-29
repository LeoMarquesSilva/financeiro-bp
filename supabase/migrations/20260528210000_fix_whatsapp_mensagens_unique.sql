-- Corrige a constraint de idempotência das mensagens de WhatsApp.
-- O índice único PARCIAL (WHERE message_id IS NOT NULL) não pode ser usado como
-- alvo de ON CONFLICT pelo PostgREST (upsert onConflict: 'message_id'), o que fazia
-- TODOS os inserts de mensagem falharem silenciosamente (0 mensagens gravadas).
-- Substitui por uma UNIQUE constraint completa (NULLS DISTINCT permite múltiplos NULL).

DROP INDEX IF EXISTS uq_whatsapp_mensagens_message_id;
ALTER TABLE whatsapp_mensagens DROP CONSTRAINT IF EXISTS uq_whatsapp_mensagens_message_id;
ALTER TABLE whatsapp_mensagens ADD CONSTRAINT uq_whatsapp_mensagens_message_id UNIQUE (message_id);
