-- Coluna "Grupo do Cliente" (fonte: VIOS / n8n).
ALTER TABLE clientes_escritorio
  ADD COLUMN IF NOT EXISTS grupo_cliente TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_escritorio_grupo_cliente
  ON clientes_escritorio(grupo_cliente);

COMMENT ON COLUMN clientes_escritorio.grupo_cliente IS 'Grupo do Cliente (VIOS / n8n).';
