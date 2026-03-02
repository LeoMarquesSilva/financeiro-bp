-- Chave única para upsert de timesheets: atualizar linha existente em vez de duplicar.
-- Relatório é atualizado diariamente; mesma linha = update, nova linha = insert.
-- NULLS NOT DISTINCT: duas linhas com mesmo (data, cliente, null, null, null, null) são consideradas iguais.

-- 1) Esvazia a tabela (rápido). Depois rode a automação de sync para repopular.
TRUNCATE TABLE timesheets;

-- 2) Cria a constraint única.
ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_upsert_key
  UNIQUE NULLS NOT DISTINCT (data, cliente, colaborador, hora_inicial, descricao, total_horas_decimal);
