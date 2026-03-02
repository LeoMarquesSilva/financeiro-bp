-- Timesheets: chave única por CI (identificador único do apontamento no VIOS).
-- Remove a constraint antiga (data, cliente, colaborador, ...) e cria por ci.

ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_upsert_key;

ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_upsert_key
  UNIQUE NULLS NOT DISTINCT (ci);
