-- Chaves únicas para upsert diário: atualizar existente ou inserir novo (sem duplicar).
-- Ordem: esvazia tabelas que referenciam pessoas, depois pessoas; então adiciona constraints.
-- Depois rode as automações na ordem: 1 Pessoas, 2 TimeSheets, 3 ProcessoCompleto, 4 Financeiro.

-- Esvazia todas de uma vez; CASCADE permite truncar pessoas mesmo com FKs apontando para ela.
TRUNCATE TABLE financeiro_parcelas, timesheets, processos_completo, pessoas CASCADE;

-- Pessoas: uma linha por (nome, cpf_cnpj). NULLS NOT DISTINCT = só uma linha com (nome, null) se cpf vazio.
ALTER TABLE pessoas
  ADD CONSTRAINT pessoas_upsert_key
  UNIQUE NULLS NOT DISTINCT (nome, cpf_cnpj);

-- Processos: uma linha por nro_cnj (número do processo).
ALTER TABLE processos_completo
  ADD CONSTRAINT processos_completo_upsert_key
  UNIQUE NULLS NOT DISTINCT (nro_cnj);
