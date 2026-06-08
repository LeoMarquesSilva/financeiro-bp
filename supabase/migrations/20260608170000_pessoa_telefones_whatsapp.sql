-- Telefones WhatsApp nomeados por pessoa (múltiplos contatos de cobrança).
CREATE TABLE IF NOT EXISTS pessoa_telefones_whatsapp (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id  UUID NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL DEFAULT '',
  telefone   TEXT NOT NULL,
  ordem      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pessoa_telefones_whatsapp_unique
  ON pessoa_telefones_whatsapp (pessoa_id, telefone);

CREATE INDEX IF NOT EXISTS idx_pessoa_telefones_whatsapp_pessoa
  ON pessoa_telefones_whatsapp (pessoa_id, ordem);

ALTER TABLE pessoa_telefones_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on pessoa_telefones_whatsapp"
  ON pessoa_telefones_whatsapp FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon on pessoa_telefones_whatsapp"
  ON pessoa_telefones_whatsapp FOR ALL TO anon USING (true) WITH CHECK (true);

-- Migra telefone legado (pessoas.telefone) para a nova tabela.
INSERT INTO pessoa_telefones_whatsapp (pessoa_id, nome, telefone, ordem)
SELECT
  p.id,
  COALESCE(NULLIF(BTRIM(p.nome), ''), 'Principal'),
  regexp_replace(COALESCE(p.telefone, ''), '\D', '', 'g'),
  0
FROM pessoas p
WHERE NULLIF(regexp_replace(COALESCE(p.telefone, ''), '\D', '', 'g'), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pessoa_telefones_whatsapp t WHERE t.pessoa_id = p.id
  );
