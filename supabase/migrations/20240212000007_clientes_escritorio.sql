-- Base de todos os clientes do escritório (fonte: VIOS – Processos Completo).
-- Sincronizada pelo script no vios-app; não confundir com clients_inadimplencia (só inadimplentes).

CREATE TABLE clientes_escritorio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_cliente TEXT,
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  qtd_processos INTEGER,
  horas_total NUMERIC(12, 2),
  horas_por_ano JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_clientes_escritorio_cnpj ON clientes_escritorio(cnpj) WHERE cnpj IS NOT NULL AND cnpj != '';
CREATE INDEX idx_clientes_escritorio_grupo_cliente ON clientes_escritorio(grupo_cliente);
CREATE INDEX idx_clientes_escritorio_razao_social ON clientes_escritorio(razao_social);
CREATE INDEX idx_clientes_escritorio_updated_at ON clientes_escritorio(updated_at DESC);

COMMENT ON TABLE clientes_escritorio IS 'Todos os clientes do escritório (VIOS Processos Completo); processos e horas.';

-- Trigger updated_at (reutiliza a função já criada nas migrations anteriores)
CREATE TRIGGER clientes_escritorio_updated_at
  BEFORE UPDATE ON clientes_escritorio
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- RLS
ALTER TABLE clientes_escritorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON clientes_escritorio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon (dev)" ON clientes_escritorio
  FOR ALL TO anon USING (true) WITH CHECK (true);
