-- Processos_completo: chave única por CI (identificador do processo no VIOS).
-- Remove a constraint antiga (nro_cnj) e cria por ci.

ALTER TABLE processos_completo DROP CONSTRAINT IF EXISTS processos_completo_upsert_key;

ALTER TABLE processos_completo
  ADD CONSTRAINT processos_completo_upsert_key
  UNIQUE NULLS NOT DISTINCT (ci);
