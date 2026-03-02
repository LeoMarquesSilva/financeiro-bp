-- View que mostra quais empresas estão em cada grupo.
-- grupo_cliente vem de pessoas; se vazio, usa o grupo do processos_completo vinculado.
-- O front só precisa consultar esta view e agrupar por grupo_cliente (um card por grupo).

CREATE OR REPLACE VIEW escritorio_empresas_por_grupo AS
WITH
  grupo_from_processo AS (
    SELECT DISTINCT ON (pessoa_id) pessoa_id, trim(grupo_cliente) AS grupo_from_pc
    FROM processos_completo
    WHERE pessoa_id IS NOT NULL AND grupo_cliente IS NOT NULL AND trim(grupo_cliente) <> ''
    ORDER BY pessoa_id, updated_at DESC
  ),
  pc_count AS (
    SELECT pessoa_id, count(*)::int AS qtd_processos
    FROM processos_completo
    WHERE pessoa_id IS NOT NULL
    GROUP BY pessoa_id
  ),
  th_total AS (
    SELECT pessoa_id, COALESCE(SUM(total_horas_decimal), 0)::numeric(12,2) AS horas_total
    FROM timesheets
    WHERE pessoa_id IS NOT NULL
    GROUP BY pessoa_id
  ),
  th_por_ano AS (
    SELECT pessoa_id, jsonb_object_agg(ano::text, total) AS horas_por_ano
    FROM (
      SELECT pessoa_id, EXTRACT(YEAR FROM data)::int AS ano, SUM(total_horas_decimal)::numeric(12,2) AS total
      FROM timesheets
      WHERE pessoa_id IS NOT NULL AND data IS NOT NULL
      GROUP BY pessoa_id, EXTRACT(YEAR FROM data)
    ) x
    GROUP BY pessoa_id
  )
SELECT
  p.id,
  p.ci,
  COALESCE(NULLIF(trim(p.grupo_cliente), ''), gfp.grupo_from_pc) AS grupo_cliente,
  p.nome,
  p.cpf_cnpj,
  p.categoria,
  p.created_at,
  p.updated_at,
  COALESCE(pc.qtd_processos, 0) AS qtd_processos,
  COALESCE(th.horas_total, 0)::numeric(12,2) AS horas_total,
  th2.horas_por_ano
FROM pessoas p
LEFT JOIN grupo_from_processo gfp ON gfp.pessoa_id = p.id
LEFT JOIN pc_count pc ON pc.pessoa_id = p.id
LEFT JOIN th_total th ON th.pessoa_id = p.id
LEFT JOIN th_por_ano th2 ON th2.pessoa_id = p.id;
