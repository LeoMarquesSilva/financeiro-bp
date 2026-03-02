-- Corrige total_horas_decimal que foram gravados em SEGUNDOS (ex.: 37260 ou 1412519 em vez de horas decimais).
-- Converte: valor inteiro em [60, 86400] (1 min a 24h em seg) OU valor > 86400 (ex.: 1412519 = 392h em seg).
-- Após rodar o sync com o parse corrigido, os novos dados já vêm em horas decimais.

UPDATE timesheets
SET total_horas_decimal = ROUND((total_horas_decimal / 3600)::numeric, 2),
    total_horas = ROUND((total_horas_decimal / 3600)::numeric, 2)
WHERE total_horas_decimal >= 60
  AND (
    total_horas_decimal > 86400
    OR (total_horas_decimal = FLOOR(total_horas_decimal) AND total_horas_decimal <= 86400)
  );
