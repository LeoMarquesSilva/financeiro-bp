-- Adiciona coluna data_providencia em providencias para permitir escolher a data ao criar.
ALTER TABLE providencias
  ADD COLUMN IF NOT EXISTS data_providencia DATE;

-- Para registros existentes, usa a data de criação (date do created_at)
UPDATE providencias
SET data_providencia = created_at::date
WHERE data_providencia IS NULL;
