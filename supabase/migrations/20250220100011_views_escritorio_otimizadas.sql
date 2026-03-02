-- Corrige timeout: pessoas_escritorio e contagem_ci_por_grupo sem subqueries correlacionadas por linha.

-- Contagem: usar max(updated_at) no GROUP BY em vez de subquery
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

-- Pessoas: JOIN com CTEs agregadas (1 scan por tabela) em vez de subquery por linha
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
