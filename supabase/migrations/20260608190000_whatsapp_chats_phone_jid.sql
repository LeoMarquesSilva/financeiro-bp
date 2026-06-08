-- Telefone real de conversas @lid (número oculto pelo WhatsApp).
ALTER TABLE whatsapp_chats
  ADD COLUMN IF NOT EXISTS phone_jid TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone_jid
  ON whatsapp_chats(phone_jid)
  WHERE phone_jid IS NOT NULL;

COMMENT ON COLUMN whatsapp_chats.phone_jid IS
  'JID de telefone (@s.whatsapp.net) resolvido a partir de remoteJidAlt ou participantes de grupo, para contatos @lid.';

-- Backfill a partir do remoteJidAlt das mensagens mais recentes.
UPDATE whatsapp_chats wc
SET
  phone_jid = sub.phone_jid,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (m.remote_jid)
    m.remote_jid,
    regexp_replace(
      split_part(split_part(m.raw->'key'->>'remoteJidAlt', '@', 1), ':', 1),
      '\D',
      '',
      'g'
    ) || '@s.whatsapp.net' AS phone_jid
  FROM whatsapp_mensagens m
  WHERE m.remote_jid LIKE '%@lid'
    AND m.raw->'key'->>'remoteJidAlt' IS NOT NULL
    AND m.raw->'key'->>'remoteJidAlt' NOT LIKE '%@lid%'
  ORDER BY m.remote_jid, m.timestamp DESC
) sub
WHERE wc.remote_jid = sub.remote_jid
  AND wc.remote_jid LIKE '%@lid'
  AND length(regexp_replace(split_part(sub.phone_jid, '@', 1), '\D', '', 'g')) >= 12
  AND (wc.phone_jid IS NULL OR wc.phone_jid = '');

-- Propaga push_name da conversa @lid para o chat de telefone quando o nome do telefone estiver vazio.
UPDATE whatsapp_chats phone
SET
  push_name = lid.push_name,
  updated_at = NOW()
FROM whatsapp_chats lid
WHERE lid.remote_jid LIKE '%@lid'
  AND lid.phone_jid IS NOT NULL
  AND phone.remote_jid = lid.phone_jid
  AND lid.push_name IS NOT NULL
  AND BTRIM(lid.push_name) <> ''
  AND (phone.push_name IS NULL OR BTRIM(phone.push_name) = '');
