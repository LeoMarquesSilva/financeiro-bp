-- Vincula cliente inadimplente ao cliente da base do escritório (clientes_escritorio).
ALTER TABLE clients_inadimplencia
  ADD COLUMN IF NOT EXISTS cliente_escritorio_id UUID REFERENCES clientes_escritorio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_cliente_escritorio_id
  ON clients_inadimplencia(cliente_escritorio_id);

COMMENT ON COLUMN clients_inadimplencia.cliente_escritorio_id IS 'Referência ao cliente na base do escritório (clientes_escritorio).';
