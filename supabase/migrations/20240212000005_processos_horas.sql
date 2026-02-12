-- Dados de processos e horas (timesheet) por cliente – preenchidos via script a partir de DADOS.xlsx
ALTER TABLE clients_inadimplencia
  ADD COLUMN IF NOT EXISTS qtd_processos INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS horas_total NUMERIC(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS horas_por_ano JSONB DEFAULT NULL;

COMMENT ON COLUMN clients_inadimplencia.qtd_processos IS 'Quantidade de processos do cliente/grupo';
COMMENT ON COLUMN clients_inadimplencia.horas_total IS 'Total de horas (timesheet advogados) com o cliente';
COMMENT ON COLUMN clients_inadimplencia.horas_por_ano IS 'Horas por ano: objeto { "2024": 100.5, "2023": 80 } (timesheet por ano)';
