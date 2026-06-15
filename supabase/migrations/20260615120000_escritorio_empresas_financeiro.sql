-- Inclui valor financeiro por empresa na view escritorio_empresas_por_grupo
CREATE OR REPLACE VIEW escritorio_empresas_por_grupo AS
WITH grupo_from_processo AS (
  SELECT DISTINCT ON (processos_completo.pessoa_id)
    processos_completo.pessoa_id,
    TRIM(BOTH FROM processos_completo.grupo_cliente) AS grupo_from_pc
  FROM processos_completo
  WHERE processos_completo.pessoa_id IS NOT NULL
    AND processos_completo.grupo_cliente IS NOT NULL
    AND TRIM(BOTH FROM processos_completo.grupo_cliente) <> ''
  ORDER BY processos_completo.pessoa_id, processos_completo.updated_at DESC
),
pc_count AS (
  SELECT processos_completo.pessoa_id,
    count(*)::integer AS qtd_processos
  FROM processos_completo
  WHERE processos_completo.pessoa_id IS NOT NULL
  GROUP BY processos_completo.pessoa_id
),
th_total AS (
  SELECT timesheets.pessoa_id,
    COALESCE(sum(timesheets.total_horas_decimal), 0::numeric)::numeric(12, 2) AS horas_total
  FROM timesheets
  WHERE timesheets.pessoa_id IS NOT NULL
  GROUP BY timesheets.pessoa_id
),
th_por_ano AS (
  SELECT x.pessoa_id,
    jsonb_object_agg(x.ano::text, x.total) AS horas_por_ano
  FROM (
    SELECT timesheets.pessoa_id,
      EXTRACT(year FROM timesheets.data)::integer AS ano,
      sum(timesheets.total_horas_decimal)::numeric(12, 2) AS total
    FROM timesheets
    WHERE timesheets.pessoa_id IS NOT NULL
      AND timesheets.data IS NOT NULL
    GROUP BY timesheets.pessoa_id, EXTRACT(year FROM timesheets.data)
  ) x
  GROUP BY x.pessoa_id
)
SELECT p.id,
  p.ci,
  COALESCE(NULLIF(TRIM(BOTH FROM p.grupo_cliente), ''), gfp.grupo_from_pc) AS grupo_cliente,
  p.nome,
  p.cpf_cnpj,
  p.categoria,
  p.created_at,
  p.updated_at,
  COALESCE(pc.qtd_processos, 0) AS qtd_processos,
  COALESCE(th.horas_total, 0::numeric)::numeric(12, 2) AS horas_total,
  th2.horas_por_ano,
  COALESCE(f.valor_aberto, 0::numeric)::numeric(12, 2) AS valor_aberto,
  COALESCE(f.valor_pago, 0::numeric)::numeric(12, 2) AS valor_pago,
  COALESCE(f.valor_em_atraso, 0::numeric)::numeric(12, 2) AS valor_em_atraso
FROM pessoas p
  LEFT JOIN grupo_from_processo gfp ON gfp.pessoa_id = p.id
  LEFT JOIN pc_count pc ON pc.pessoa_id = p.id
  LEFT JOIN th_total th ON th.pessoa_id = p.id
  LEFT JOIN th_por_ano th2 ON th2.pessoa_id = p.id
  LEFT JOIN relatorio_financeiro_resumo_por_cliente f ON f.pessoa_id = p.id;
