-- Adiciona coluna de data ao follow-up (data prevista / data do follow-up)
ALTER TABLE providencia_follow_ups
  ADD COLUMN IF NOT EXISTS data_follow_up DATE;

COMMENT ON COLUMN providencia_follow_ups.data_follow_up IS 'Data prevista ou data do follow-up (opcional).';
