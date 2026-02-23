-- Observações gerais do cliente inadimplente (acima de providência no UI)
ALTER TABLE clients_inadimplencia
  ADD COLUMN IF NOT EXISTS observacoes_gerais TEXT;

COMMENT ON COLUMN clients_inadimplencia.observacoes_gerais IS 'Observações gerais do registro; exibido acima de última providência.';
