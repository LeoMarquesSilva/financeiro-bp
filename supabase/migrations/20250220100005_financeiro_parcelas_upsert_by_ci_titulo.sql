-- Financeiro_parcelas: chave única por ci_titulo (uma linha por título).
-- Remove a constraint antiga (ci_titulo, ci_parcela) e cria só por ci_titulo.

ALTER TABLE financeiro_parcelas DROP CONSTRAINT IF EXISTS financeiro_parcelas_ci_titulo_ci_parcela_key;

ALTER TABLE financeiro_parcelas
  ADD CONSTRAINT financeiro_parcelas_upsert_key
  UNIQUE NULLS NOT DISTINCT (ci_titulo);
