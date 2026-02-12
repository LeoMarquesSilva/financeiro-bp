-- Enum para classe de risco (aging)
CREATE TYPE inadimplencia_classe AS ENUM ('A', 'B', 'C');

-- Enum para tipo de ação no log
CREATE TYPE inadimplencia_tipo_acao AS ENUM (
  'ligacao',
  'email',
  'reuniao',
  'proposta',
  'acordo',
  'outro'
);

-- Tabela principal: clientes inadimplentes
CREATE TABLE clients_inadimplencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  gestor TEXT,
  area TEXT,
  status_classe inadimplencia_classe NOT NULL DEFAULT 'A',
  dias_em_aberto INTEGER NOT NULL DEFAULT 0,
  valor_em_aberto NUMERIC(15, 2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  ultima_providencia TEXT,
  data_providencia DATE,
  follow_up TEXT,
  data_follow_up DATE,
  resolvido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para filtros e paginação
CREATE INDEX idx_clients_inadimplencia_status_classe ON clients_inadimplencia(status_classe);
CREATE INDEX idx_clients_inadimplencia_gestor ON clients_inadimplencia(gestor);
CREATE INDEX idx_clients_inadimplencia_area ON clients_inadimplencia(area);
CREATE INDEX idx_clients_inadimplencia_dias_em_aberto ON clients_inadimplencia(dias_em_aberto);
CREATE INDEX idx_clients_inadimplencia_created_at ON clients_inadimplencia(created_at DESC);
CREATE INDEX idx_clients_inadimplencia_resolvido ON clients_inadimplencia(resolvido_at) WHERE resolvido_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_inadimplencia_updated_at
  BEFORE UPDATE ON clients_inadimplencia
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Tabela de logs (histórico de ações)
CREATE TABLE inadimplencia_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients_inadimplencia(id) ON DELETE CASCADE,
  tipo inadimplencia_tipo_acao NOT NULL DEFAULT 'outro',
  descricao TEXT,
  usuario TEXT,
  data_acao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inadimplencia_logs_client_id ON inadimplencia_logs(client_id);
CREATE INDEX idx_inadimplencia_logs_data_acao ON inadimplencia_logs(data_acao DESC);

-- Tabela de pagamentos registrados
CREATE TABLE inadimplencia_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients_inadimplencia(id) ON DELETE CASCADE,
  valor_pago NUMERIC(15, 2) NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inadimplencia_pagamentos_client_id ON inadimplencia_pagamentos(client_id);
CREATE INDEX idx_inadimplencia_pagamentos_data ON inadimplencia_pagamentos(data_pagamento DESC);

-- RLS: habilitar
ALTER TABLE clients_inadimplencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE inadimplencia_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inadimplencia_pagamentos ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para desenvolvimento (ajustar para auth depois)
-- Permite tudo para usuários autenticados; em produção restringir por created_by/role
CREATE POLICY "Allow all for authenticated" ON clients_inadimplencia
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon (dev)" ON clients_inadimplencia
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all logs for authenticated" ON inadimplencia_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all logs for anon (dev)" ON inadimplencia_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all pagamentos for authenticated" ON inadimplencia_pagamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all pagamentos for anon (dev)" ON inadimplencia_pagamentos
  FOR ALL TO anon USING (true) WITH CHECK (true);
