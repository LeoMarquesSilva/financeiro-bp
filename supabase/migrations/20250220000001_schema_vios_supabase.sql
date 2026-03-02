-- Schema completo: pessoas (central), timesheets, processos_completo, financeiro_parcelas.
-- Supabase zerado: criar tudo do zero. Vinculação: pessoa_id = match cliente (relatório) = pessoas.nome.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.normalize_cliente_for_match(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(
    regexp_replace(
      regexp_replace(COALESCE(unaccent(t), ''), '\s+', ' ', 'g'),
      '\.\s*$', ''
    )
  ));
$$;

-- ========== 1. PESSOAS (RelatorioPessoas) ==========
CREATE TABLE IF NOT EXISTS pessoas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci TEXT,
  etiquetas TEXT,
  cpf_cnpj TEXT,
  nome TEXT NOT NULL,
  nome_fantasia_apelido TEXT,
  tipo TEXT,
  data_cadastro DATE,
  cidade TEXT,
  uf TEXT,
  logradouro TEXT,
  nro TEXT,
  complemento TEXT,
  bairro TEXT,
  cep TEXT,
  abreviacao TEXT,
  responsaveis TEXT,
  telefone TEXT,
  email TEXT,
  grupo_cliente TEXT,
  categoria TEXT,
  contato_1 TEXT,
  facebook TEXT,
  instagram TEXT,
  linkedin TEXT,
  site TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome);
CREATE INDEX IF NOT EXISTS idx_pessoas_ci ON pessoas(ci) WHERE ci IS NOT NULL AND ci != '';
CREATE INDEX IF NOT EXISTS idx_pessoas_cpf_cnpj ON pessoas(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '';
CREATE INDEX IF NOT EXISTS idx_pessoas_grupo_cliente ON pessoas(grupo_cliente);
CREATE INDEX IF NOT EXISTS idx_pessoas_categoria ON pessoas(categoria);
CREATE INDEX IF NOT EXISTS idx_pessoas_updated_at ON pessoas(updated_at DESC);

DROP TRIGGER IF EXISTS pessoas_updated_at ON pessoas;
CREATE TRIGGER pessoas_updated_at
  BEFORE UPDATE ON pessoas FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE pessoas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON pessoas;
CREATE POLICY "Allow all for authenticated" ON pessoas FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON pessoas;
CREATE POLICY "Allow all for anon" ON pessoas FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 2. TIMESHEETS (Timesheet) ==========
CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci TEXT,
  data DATE NOT NULL,
  cobrar TEXT,
  grupo_cliente TEXT,
  cliente TEXT NOT NULL,
  parte_contraria TEXT,
  area TEXT,
  nro_processo TEXT,
  origem TEXT,
  ci_atendimento_processo TEXT,
  pasta_interna_processo TEXT,
  pasta_contrato TEXT,
  colaborador TEXT,
  tipo_apontamento TEXT,
  tipo_tarefa TEXT,
  descricao TEXT,
  hora_inicial TEXT,
  hora_final TEXT,
  total_horas NUMERIC(12, 2),
  total_horas_decimal NUMERIC(12, 2),
  valor_hora NUMERIC(12, 2),
  valor_total NUMERIC(12, 2),
  contrato TEXT,
  pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheets_data ON timesheets(data);
CREATE INDEX IF NOT EXISTS idx_timesheets_cliente ON timesheets(cliente);
CREATE INDEX IF NOT EXISTS idx_timesheets_grupo_cliente ON timesheets(grupo_cliente);
CREATE INDEX IF NOT EXISTS idx_timesheets_pessoa_id ON timesheets(pessoa_id);

DROP TRIGGER IF EXISTS timesheets_updated_at ON timesheets;
CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON timesheets FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON timesheets;
CREATE POLICY "Allow all for authenticated" ON timesheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON timesheets;
CREATE POLICY "Allow all for anon" ON timesheets FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 3. PROCESSOS_COMPLETO (ProcessoCompleto) ==========
CREATE TABLE IF NOT EXISTS processos_completo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci TEXT,
  grupo_cliente TEXT,
  departamento TEXT,
  area TEXT,
  advogado_responsavel TEXT,
  cliente TEXT NOT NULL,
  acao TEXT,
  acao_data_cadastro TEXT,
  data_cadastro DATE,
  fase_processual TEXT,
  nro_cnj TEXT,
  processo_encerrado TEXT,
  situacao_processo TEXT,
  motivo_encerramento TEXT,
  etiquetas TEXT,
  data_encerramento DATE,
  pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processos_completo_ci ON processos_completo(ci);
CREATE INDEX IF NOT EXISTS idx_processos_completo_cliente ON processos_completo(cliente);
CREATE INDEX IF NOT EXISTS idx_processos_completo_grupo_cliente ON processos_completo(grupo_cliente);
CREATE INDEX IF NOT EXISTS idx_processos_completo_pessoa_id ON processos_completo(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_processos_completo_situacao ON processos_completo(situacao_processo);

DROP TRIGGER IF EXISTS processos_completo_updated_at ON processos_completo;
CREATE TRIGGER processos_completo_updated_at
  BEFORE UPDATE ON processos_completo FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE processos_completo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON processos_completo;
CREATE POLICY "Allow all for authenticated" ON processos_completo FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON processos_completo;
CREATE POLICY "Allow all for anon" ON processos_completo FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== 4. FINANCEIRO_PARCELAS (FinanceiroRelatorioParcelas) ==========
CREATE TABLE IF NOT EXISTS financeiro_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci_titulo INTEGER NOT NULL,
  ci_parcela INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  data_vencimento_orig DATE,
  competencia TEXT,
  tipo TEXT,
  forma TEXT,
  nro_titulo TEXT NOT NULL,
  parcela TEXT,
  parcelas TEXT,
  nf TEXT,
  cliente TEXT NOT NULL,
  terceiro_titulo TEXT,
  terceiros_itens TEXT,
  descricao TEXT,
  valor NUMERIC(12, 2) NOT NULL,
  valor_atualizado NUMERIC(12, 2),
  valor_fluxo NUMERIC(12, 2),
  valor_pago NUMERIC(12, 2),
  valor_titulo NUMERIC(12, 2),
  situacao TEXT NOT NULL DEFAULT 'ABERTO',
  data_baixa DATE,
  plano_contas TEXT,
  pessoa_id UUID REFERENCES pessoas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ci_titulo, ci_parcela)
);

CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_data_vencimento ON financeiro_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_cliente ON financeiro_parcelas(cliente);
CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_pessoa_id ON financeiro_parcelas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_situacao ON financeiro_parcelas(situacao);

DROP TRIGGER IF EXISTS financeiro_parcelas_updated_at ON financeiro_parcelas;
CREATE TRIGGER financeiro_parcelas_updated_at
  BEFORE UPDATE ON financeiro_parcelas FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE financeiro_parcelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON financeiro_parcelas;
CREATE POLICY "Allow all for authenticated" ON financeiro_parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for anon" ON financeiro_parcelas;
CREATE POLICY "Allow all for anon" ON financeiro_parcelas FOR ALL TO anon USING (true) WITH CHECK (true);

-- ========== RPCs de vinculação (Cliente = pessoas.nome) ==========
CREATE OR REPLACE FUNCTION public.timesheets_vinculacao_pessoa()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH updated AS (
    UPDATE timesheets t
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE public.normalize_cliente_for_match(t.cliente) = public.normalize_cliente_for_match(p.nome)
      AND (t.pessoa_id IS NULL OR t.pessoa_id IS DISTINCT FROM p.id)
    RETURNING t.id
  )
  SELECT count(*)::bigint FROM updated;
$$;

CREATE OR REPLACE FUNCTION public.processos_completo_vinculacao_pessoa()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH updated AS (
    UPDATE processos_completo pc
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE public.normalize_cliente_for_match(pc.cliente) = public.normalize_cliente_for_match(p.nome)
      AND (pc.pessoa_id IS NULL OR pc.pessoa_id IS DISTINCT FROM p.id)
    RETURNING pc.id
  )
  SELECT count(*)::bigint FROM updated;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_parcelas_vinculacao_pessoa()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH updated AS (
    UPDATE financeiro_parcelas fp
    SET pessoa_id = p.id
    FROM pessoas p
    WHERE public.normalize_cliente_for_match(fp.cliente) = public.normalize_cliente_for_match(p.nome)
      AND (fp.pessoa_id IS NULL OR fp.pessoa_id IS DISTINCT FROM p.id)
    RETURNING fp.id
  )
  SELECT count(*)::bigint FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.timesheets_vinculacao_pessoa() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processos_completo_vinculacao_pessoa() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.financeiro_parcelas_vinculacao_pessoa() TO anon, authenticated;
