-- Comitê de inadimplência: providências com data de criação e follow-ups tipados
-- Visão: coordenadora registra providências na reunião; gestores adicionam follow-ups por providência

-- Enum para tipo de follow-up (devolutiva, cobrança, acordo)
CREATE TYPE providencia_follow_up_tipo AS ENUM (
  'devolutiva',   -- retorno/resposta do cliente
  'cobranca',     -- contato ativo de cobrança
  'acordo'        -- andamento de acordo/negociação
);

-- Tabela: providências por cliente inadimplente (criadas no comitê)
CREATE TABLE providencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_inadimplencia_id UUID NOT NULL REFERENCES clients_inadimplencia(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_providencias_cliente ON providencias(cliente_inadimplencia_id);
CREATE INDEX idx_providencias_created_at ON providencias(created_at DESC);

-- Tabela: follow-ups vinculados a uma providência (adicionados pelos gestores)
CREATE TABLE providencia_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  providencia_id UUID NOT NULL REFERENCES providencias(id) ON DELETE CASCADE,
  tipo providencia_follow_up_tipo NOT NULL,
  texto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_providencia_follow_ups_providencia ON providencia_follow_ups(providencia_id);
CREATE INDEX idx_providencia_follow_ups_created_at ON providencia_follow_ups(created_at DESC);

-- RLS
ALTER TABLE providencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE providencia_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all providencias for authenticated" ON providencias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all providencias for anon (dev)" ON providencias
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow all follow_ups for authenticated" ON providencia_follow_ups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all follow_ups for anon (dev)" ON providencia_follow_ups
  FOR ALL TO anon USING (true) WITH CHECK (true);
