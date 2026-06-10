-- Tipos de categoria configuráveis para conversas WhatsApp.

CREATE TABLE IF NOT EXISTS whatsapp_categorias (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color_scheme TEXT NOT NULL DEFAULT 'slate',
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE whatsapp_categorias IS
  'Tipos de categoria para classificação de conversas WhatsApp no painel de cobrança.';

INSERT INTO whatsapp_categorias (id, label, color_scheme, sort_order, is_system)
VALUES
  ('COBRANCA', 'Cobrança', 'emerald', 1, true),
  ('COLABORADOR_BP', 'Colaborador BP', 'blue', 2, true),
  ('SOCIO', 'Sócio', 'violet', 3, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE whatsapp_chats DROP CONSTRAINT IF EXISTS whatsapp_chats_categoria_check;

ALTER TABLE whatsapp_chats DROP CONSTRAINT IF EXISTS whatsapp_chats_categoria_fkey;
ALTER TABLE whatsapp_chats
  ADD CONSTRAINT whatsapp_chats_categoria_fkey
  FOREIGN KEY (categoria) REFERENCES whatsapp_categorias(id) ON DELETE SET NULL;

COMMENT ON COLUMN whatsapp_chats.categoria IS
  'Categoria da conversa (referência a whatsapp_categorias).';

ALTER TABLE whatsapp_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_categorias_select_authenticated"
  ON whatsapp_categorias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "whatsapp_categorias_insert_authenticated"
  ON whatsapp_categorias FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "whatsapp_categorias_update_authenticated"
  ON whatsapp_categorias FOR UPDATE
  TO authenticated
  USING (true);
