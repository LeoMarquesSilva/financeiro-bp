-- Tabela de configurações da aplicação (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT 'true'
);

COMMENT ON TABLE app_settings IS 'Configurações globais da aplicação (ex: exibir taxa recuperação comitê).';

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários autenticados
CREATE POLICY "app_settings_select_authenticated"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: usuários autenticados (restrição de admin é feita na UI via ProtectedRoute)
CREATE POLICY "app_settings_insert_authenticated"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "app_settings_update_authenticated"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true);

-- Seed: taxa de recuperação visível por padrão
INSERT INTO app_settings (key, value)
VALUES ('exibir_taxa_recuperacao_comite', 'true')
ON CONFLICT (key) DO NOTHING;
