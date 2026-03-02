-- Pessoas: chave única por CI (identificador do VIOS). Uma linha por CI.
-- Remove a constraint antiga (nome, cpf_cnpj) e cria por ci.

ALTER TABLE pessoas DROP CONSTRAINT IF EXISTS pessoas_upsert_key;

ALTER TABLE pessoas
  ADD CONSTRAINT pessoas_upsert_key
  UNIQUE NULLS NOT DISTINCT (ci);
