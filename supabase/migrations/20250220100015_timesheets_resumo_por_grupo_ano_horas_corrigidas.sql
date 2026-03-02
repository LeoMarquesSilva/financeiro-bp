-- Coluna do relatório: "Total de Horas em decimal" → valor já em HORAS DECIMAIS (ex.: 0.25 = 15min, 2.1 = 2h06).
-- Fluxo: somar total_horas_decimal por grupo/ano; total_horas = soma (já em horas) → front exibe em HH:MM:SS.
-- Sem conversão: não dividir por 24.

CREATE OR REPLACE VIEW timesheets_resumo_por_grupo_ano AS
SELECT
  COALESCE(t.grupo_cliente, '') AS grupo_cliente,
  EXTRACT(YEAR FROM t.data)::int AS ano,
  ROUND(COALESCE(SUM(t.total_horas_decimal), 0)::numeric, 2)::numeric(12,2) AS total_horas
FROM timesheets t
WHERE t.data IS NOT NULL
GROUP BY t.grupo_cliente, EXTRACT(YEAR FROM t.data);
