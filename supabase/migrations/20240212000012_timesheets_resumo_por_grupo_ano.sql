-- View agregada: soma de total_horas por grupo_cliente e ano (evita buscar 150k+ linhas no front).
CREATE OR REPLACE VIEW timesheets_resumo_por_grupo_ano AS
SELECT
  COALESCE(TRIM(grupo_cliente), '') AS grupo_cliente,
  EXTRACT(YEAR FROM data)::integer AS ano,
  SUM(total_horas)::numeric(12, 4) AS total_horas
FROM timesheets
GROUP BY COALESCE(TRIM(grupo_cliente), ''), EXTRACT(YEAR FROM data);

COMMENT ON VIEW timesheets_resumo_por_grupo_ano IS 'Soma de horas por grupo e ano (para o front não precisar buscar toda a tabela timesheets).';

-- Permite leitura via API (anon/authenticated)
GRANT SELECT ON timesheets_resumo_por_grupo_ano TO anon;
GRANT SELECT ON timesheets_resumo_por_grupo_ano TO authenticated;
