-- Schema do módulo de inadimplência: clients_inadimplencia, logs, pagamentos, providências e follow-ups.
-- Depende de set_updated_at() do schema_vios_supabase.

-- Enums
DO $$ BEGIN
  CREATE TYPE inadimplencia_classe AS ENUM ('A', 'B', 'C');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE inadimplencia_tipo_acao AS ENUM ('ligacao', 'email', 'reuniao', 'proposta', 'acordo', 'outro');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE providencia_follow_up_tipo AS ENUM ('devolutiva', 'cobranca', 'acordo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ========== 1. CLIENTS_INADIMPLENCIA ==========
CREATE TABLE IF NOT EXISTS clients_inadimplencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  gestor TEXT,
  area TEXT,
  status_classe inadimplencia_classe NOT NULL DEFAULT 'A',
  dias_em_aberto INTEGER NOT NULL DEFAULT 0,
  valor_em_aberto NUMERIC(12, 2) NOT NULL DEFAULT 0,
  valor_mensal NUMERIC(12, 2),
  qtd_processos INTEGER,
  horas_total NUMERIC(12, 2),
  horas_por_ano JSONB,
  prioridade TEXT,
  data_vencimento DATE,
  observacoes_gerais TEXT,
  ultima_providencia TEXT,
  data_providencia DATE,
  follow_up TEXT,
  data_follow_up DATE,
  resolvido_at TIMESTAMPTZ,
  pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_resolvido ON clients_inadimplencia(resolvido_at) WHERE resolvido_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_gestor ON clients_inadimplencia(gestor);
CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_area ON clients_inadimplencia(area);
CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_status_classe ON clients_inadimplencia(status_classe);
CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_prioridade ON clients_inadimplencia(prioridade);
CREATE INDEX IF NOT EXISTS idx_clients_inadimplencia_pessoa_id ON clients_inadimplencia(pessoa_id);

DROP TRIGGER IF EXISTS clients_inadimplencia_updated_at ON clients_inadimplencia;
CREATE TRIGGER clients_inadimplencia_updated_at
  BEFORE UPDATE ON clients_inadimplencia FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE clients_inadimplencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON clients_inadimplencia;
CREATE POLICY "Allow all for authenticated" ON clients_inadimplencia FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON clients_inadimplencia;
CREATE POLICY "Allow all for anon" ON clients_inadimplencia FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 2. INADIMPLENCIA_LOGS ==========
CREATE TABLE IF NOT EXISTS inadimplencia_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients_inadimplencia(id) ON DELETE CASCADE,
  tipo inadimplencia_tipo_acao NOT NULL DEFAULT 'outro',
  descricao TEXT,
  usuario TEXT,
  data_acao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inadimplencia_logs_client_id ON inadimplencia_logs(client_id);

ALTER TABLE inadimplencia_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON inadimplencia_logs;
CREATE POLICY "Allow all for authenticated" ON inadimplencia_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON inadimplencia_logs;
CREATE POLICY "Allow all for anon" ON inadimplencia_logs FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 3. INADIMPLENCIA_PAGAMENTOS ==========
CREATE TABLE IF NOT EXISTS inadimplencia_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients_inadimplencia(id) ON DELETE CASCADE,
  valor_pago NUMERIC(12, 2) NOT NULL,
  data_pagamento DATE NOT NULL,
  forma_pagamento TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inadimplencia_pagamentos_client_id ON inadimplencia_pagamentos(client_id);

ALTER TABLE inadimplencia_pagamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON inadimplencia_pagamentos;
CREATE POLICY "Allow all for authenticated" ON inadimplencia_pagamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON inadimplencia_pagamentos;
CREATE POLICY "Allow all for anon" ON inadimplencia_pagamentos FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 4. PROVIDENCIAS ==========
CREATE TABLE IF NOT EXISTS providencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_inadimplencia_id UUID NOT NULL REFERENCES clients_inadimplencia(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_providencias_cliente ON providencias(cliente_inadimplencia_id);

ALTER TABLE providencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON providencias;
CREATE POLICY "Allow all for authenticated" ON providencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON providencias;
CREATE POLICY "Allow all for anon" ON providencias FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 5. PROVIDENCIA_FOLLOW_UPS ==========
CREATE TABLE IF NOT EXISTS providencia_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  providencia_id UUID NOT NULL REFERENCES providencias(id) ON DELETE CASCADE,
  tipo providencia_follow_up_tipo NOT NULL,
  texto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_providencia_follow_ups_providencia ON providencia_follow_ups(providencia_id);

ALTER TABLE providencia_follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON providencia_follow_ups;
CREATE POLICY "Allow all for authenticated" ON providencia_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON providencia_follow_ups;
CREATE POLICY "Allow all for anon" ON providencia_follow_ups FOR ALL TO anon USING (true) WITH CHECK (true);
