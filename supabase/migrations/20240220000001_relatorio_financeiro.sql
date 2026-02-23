-- Relatório de faturamento (fonte: CSV atualizado diariamente).
-- Colunas: CI Título, CI Parcela, Data Vencimento, Nro Título, Cliente, Descrição, Valor, Situação, Data Baixa.

CREATE TABLE relatorio_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci_titulo INTEGER NOT NULL,
  ci_parcela INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  nro_titulo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(14, 2) NOT NULL DEFAULT 0,
  situacao TEXT NOT NULL DEFAULT 'ABERTO',
  data_baixa DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_relatorio_financeiro_ci UNIQUE (ci_titulo, ci_parcela)
);

CREATE INDEX idx_relatorio_financeiro_data_vencimento ON relatorio_financeiro(data_vencimento);
CREATE INDEX idx_relatorio_financeiro_cliente ON relatorio_financeiro(cliente);
CREATE INDEX idx_relatorio_financeiro_situacao ON relatorio_financeiro(situacao);
CREATE INDEX idx_relatorio_financeiro_data_baixa ON relatorio_financeiro(data_baixa);
CREATE INDEX idx_relatorio_financeiro_nro_titulo ON relatorio_financeiro(nro_titulo);

COMMENT ON TABLE relatorio_financeiro IS 'Relatório de faturamento dos clientes (CSV atualizado diariamente).';
COMMENT ON COLUMN relatorio_financeiro.ci_titulo IS 'CI Título (identificador do título)';
COMMENT ON COLUMN relatorio_financeiro.ci_parcela IS 'CI Parcela';
COMMENT ON COLUMN relatorio_financeiro.data_vencimento IS 'Data de vencimento';
COMMENT ON COLUMN relatorio_financeiro.nro_titulo IS 'Número do título (ex.: 4371-1)';
COMMENT ON COLUMN relatorio_financeiro.cliente IS 'Nome do cliente';
COMMENT ON COLUMN relatorio_financeiro.descricao IS 'Descrição do lançamento (ex.: HONORÁRIOS ADVOCATÍCIOS)';
COMMENT ON COLUMN relatorio_financeiro.valor IS 'Valor em reais';
COMMENT ON COLUMN relatorio_financeiro.situacao IS 'ABERTO ou PAGO';
COMMENT ON COLUMN relatorio_financeiro.data_baixa IS 'Data da baixa (quando pago); NULL se 00/00/0000 no CSV';

CREATE TRIGGER relatorio_financeiro_updated_at
  BEFORE UPDATE ON relatorio_financeiro
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE relatorio_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON relatorio_financeiro
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon (dev)" ON relatorio_financeiro
  FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT SELECT ON relatorio_financeiro TO anon;
GRANT SELECT ON relatorio_financeiro TO authenticated;
GRANT INSERT, UPDATE, DELETE ON relatorio_financeiro TO anon;
GRANT INSERT, UPDATE, DELETE ON relatorio_financeiro TO authenticated;
