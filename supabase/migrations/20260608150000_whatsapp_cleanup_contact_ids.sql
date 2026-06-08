-- Remove entradas da agenda Evolution salvas com id interno (ex.: cmppwp...)
-- em vez de JID de telefone. Não possuem mensagens nem permitem envio.
DELETE FROM whatsapp_chats
WHERE remote_jid NOT LIKE '%@%';

-- Linoplast: conversa real está no telefone fixo cadastrado; aplica nome salvo na agenda.
UPDATE whatsapp_chats
SET
  push_name = 'Juliana Financeiro Linoplast',
  updated_at = NOW()
WHERE remote_jid = '551934515416@s.whatsapp.net'
  AND (push_name IS NULL OR BTRIM(push_name) = '');
