-- Views para o módulo escritório: dados agregados a partir de processos_completo, timesheets e financeiro_parcelas.

-- 1) Resumo de timesheets por grupo_cliente e ano (para horas no card)
CREATE OR REPLACE VIEW timesheets_resumo_por_grupo_ano AS
SELECT
  COALESCE(t.grupo_cliente, '') AS grupo_cliente,
  EXTRACT(YEAR FROM t.data)::int AS ano,
  COALESCE(SUM(t.total_horas_decimal), 0)::numeric(12,2) AS total_horas
FROM timesheets t
WHERE t.data IS NOT NULL
GROUP BY t.grupo_cliente, EXTRACT(YEAR FROM t.data);

-- 2) Resumo financeiro por pessoa_id (valor aberto, pago, em atraso)
CREATE OR REPLACE VIEW relatorio_financeiro_resumo_por_cliente AS
SELECT
  fp.pessoa_id,
  COUNT(*) FILTER (WHERE fp.situacao = 'ABERTO')::int AS parcelas_abertas,
  COUNT(*) FILTER (WHERE fp.situacao = 'PAGO')::int AS parcelas_pagas,
  COUNT(*) FILTER (WHERE fp.situacao = 'ABERTO' AND fp.data_vencimento < current_date)::int AS parcelas_em_atraso,
  COALESCE(SUM(fp.valor) FILTER (WHERE fp.situacao = 'ABERTO'), 0)::numeric(12,2) AS valor_aberto,
  COALESCE(SUM(fp.valor) FILTER (WHERE fp.situacao = 'PAGO'), 0)::numeric(12,2) AS valor_pago,
  COALESCE(SUM(fp.valor) FILTER (WHERE fp.situacao = 'ABERTO' AND fp.data_vencimento < current_date), 0)::numeric(12,2) AS valor_em_atraso
FROM financeiro_parcelas fp
WHERE fp.pessoa_id IS NOT NULL
GROUP BY fp.pessoa_id;

-- 3) Contagem de processos (CI) por grupo e situação (para o card de contagem)
CREATE OR REPLACE VIEW contagem_ci_por_grupo AS
SELECT
  md5(COALESCE(pc.grupo_cliente, '') || '-contagem')::text AS id,
  COALESCE(pc.grupo_cliente, '') AS grupo_cliente,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) = 'arquivado')::int AS arquivado,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%arquivado definitivamente%' OR lower(trim(pc.situacao_processo)) = 'arquivado_definitivamente')::int AS arquivado_definitivamente,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%arquivado provisoriamente%' OR lower(trim(pc.situacao_processo)) = 'arquivado_provisoriamente')::int AS arquivado_provisoriamente,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) = 'ativo')::int AS ativo,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%encerrado%' AND lower(trim(pc.situacao_processo)) NOT LIKE '%ex-cliente%' AND lower(trim(pc.situacao_processo)) NOT LIKE '%ex cliente%')::int AS encerrado,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%ex-cliente%' OR lower(trim(pc.situacao_processo)) LIKE '%ex cliente%' OR lower(trim(pc.situacao_processo)) = 'ex_cliente')::int AS ex_cliente,
  COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) = 'suspenso')::int AS suspenso,
  (COUNT(*) - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) = 'arquivado')
    - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%arquivado definitivamente%' OR lower(trim(pc.situacao_processo)) = 'arquivado_definitivamente')
    - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%arquivado provisoriamente%' OR lower(trim(pc.situacao_processo)) = 'arquivado_provisoriamente')
    - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) = 'ativo')
    - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%encerrado%' AND lower(trim(pc.situacao_processo)) NOT LIKE '%ex-cliente%' AND lower(trim(pc.situacao_processo)) NOT LIKE '%ex cliente%')
    - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) LIKE '%ex-cliente%' OR lower(trim(pc.situacao_processo)) LIKE '%ex cliente%' OR lower(trim(pc.situacao_processo)) = 'ex_cliente')
    - COUNT(*) FILTER (WHERE lower(trim(pc.situacao_processo)) = 'suspenso'))::int AS outros,
  COUNT(*)::int AS total_geral,
  max(pc.updated_at) AS created_at,
  max(pc.updated_at) AS updated_at
FROM processos_completo pc
GROUP BY pc.grupo_cliente;

-- 4) Pessoas com qtd_processos, horas_total e horas_por_ano (JOINs em agregações = sem timeout)
CREATE OR REPLACE VIEW pessoas_escritorio AS
WITH
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
  p.grupo_cliente,
  p.nome,
  p.cpf_cnpj,
  p.categoria,
  p.created_at,
  p.updated_at,
  COALESCE(pc.qtd_processos, 0) AS qtd_processos,
  COALESCE(th.horas_total, 0)::numeric(12,2) AS horas_total,
  th2.horas_por_ano
FROM pessoas p
LEFT JOIN pc_count pc ON pc.pessoa_id = p.id
LEFT JOIN th_total th ON th.pessoa_id = p.id
LEFT JOIN th_por_ano th2 ON th2.pessoa_id = p.id;

-- Permissões para as views (herdam do RLS das tabelas base; garantir leitura)
GRANT SELECT ON timesheets_resumo_por_grupo_ano TO anon, authenticated;
GRANT SELECT ON relatorio_financeiro_resumo_por_cliente TO anon, authenticated;
GRANT SELECT ON contagem_ci_por_grupo TO anon, authenticated;
GRANT SELECT ON pessoas_escritorio TO anon, authenticated;
