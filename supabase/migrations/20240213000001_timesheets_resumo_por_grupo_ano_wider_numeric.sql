-- Evita overflow na view quando soma de total_horas é grande (ex.: dados antigos errados).
-- numeric(12,4) estoura em 10^8; numeric(18,4) suporta até ~10^14.
-- É preciso DROP antes: PostgreSQL não permite alterar tipo de coluna com CREATE OR REPLACE.
DROP VIEW IF EXISTS timesheets_resumo_por_grupo_ano;

CREATE VIEW timesheets_resumo_por_grupo_ano AS
SELECT
  COALESCE(TRIM(grupo_cliente), '') AS grupo_cliente,
  EXTRACT(YEAR FROM data)::integer AS ano,
  SUM(total_horas)::numeric(18, 4) AS total_horas
FROM timesheets
GROUP BY COALESCE(TRIM(grupo_cliente), ''), EXTRACT(YEAR FROM data);

COMMENT ON VIEW timesheets_resumo_por_grupo_ano IS 'Soma de horas por grupo e ano (para o front não precisar buscar toda a tabela timesheets).';

GRANT SELECT ON timesheets_resumo_por_grupo_ano TO anon;
GRANT SELECT ON timesheets_resumo_por_grupo_ano TO authenticated;
