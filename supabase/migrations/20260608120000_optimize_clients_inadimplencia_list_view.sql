-- Otimiza a view clients_inadimplencia_list: substitui subqueries correlacionadas
-- (uma por linha × 4 consultas) por CTEs com agregação em lote.
-- Índice parcial acelera join de parcelas abertas por pessoa.

CREATE INDEX IF NOT EXISTS idx_financeiro_parcelas_aberto_pessoa_venc
  ON financeiro_parcelas (pessoa_id, data_vencimento)
  WHERE situacao = 'ABERTO';

CREATE OR REPLACE VIEW public.clients_inadimplencia_list AS
WITH cliente_base AS (
  SELECT c.*, p.grupo_cliente
  FROM clients_inadimplencia c
  LEFT JOIN pessoas p ON p.id = c.pessoa_id
),
cliente_pessoas AS (
  SELECT cb.id AS client_id, p2.id AS pessoa_id
  FROM cliente_base cb
  JOIN pessoas p2 ON cb.grupo_cliente IS NOT NULL AND p2.grupo_cliente = cb.grupo_cliente
  UNION
  SELECT cb.id, cb.pessoa_id
  FROM cliente_base cb
  WHERE cb.pessoa_id IS NOT NULL AND cb.grupo_cliente IS NULL
),
parcelas_abertas AS (
  SELECT cp.client_id, fp.data_vencimento, fp.valor
  FROM cliente_pessoas cp
  JOIN financeiro_parcelas fp ON fp.pessoa_id = cp.pessoa_id AND fp.situacao = 'ABERTO'
),
parcelas_agg AS (
  SELECT
    client_id,
    COALESCE(SUM(valor) FILTER (WHERE data_vencimento < CURRENT_DATE), 0)::numeric(12,2) AS valor_em_aberto_computado,
    MIN(data_vencimento) FILTER (WHERE data_vencimento < CURRENT_DATE) AS oldest_overdue
  FROM parcelas_abertas
  GROUP BY client_id
),
valor_mensal_lookup AS (
  SELECT DISTINCT ON (pa.client_id)
    pa.client_id,
    pa.valor::numeric(12,2) AS valor_mensal_computado
  FROM parcelas_abertas pa
  WHERE pa.data_vencimento >= CURRENT_DATE
  ORDER BY pa.client_id, pa.data_vencimento
),
base AS (
  SELECT
    cb.id, cb.razao_social, cb.cnpj, cb.contato, cb.gestor, cb.area, cb.status_classe,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_em_aberto
      ELSE COALESCE(pa.valor_em_aberto_computado, cb.valor_em_aberto)
    END::numeric(12,2) AS valor_em_aberto,
    cb.qtd_processos, cb.horas_total, cb.horas_por_ano, cb.data_vencimento,
    cb.observacoes_gerais, cb.ultima_providencia, cb.data_providencia,
    cb.follow_up, cb.data_follow_up, cb.resolvido_at, cb.reaberto_at, cb.pessoa_id,
    cb.created_at, cb.updated_at, cb.created_by,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.dias_em_aberto
      ELSE COALESCE(
        CASE WHEN pa.oldest_overdue IS NOT NULL THEN GREATEST(0, CURRENT_DATE - pa.oldest_overdue) END,
        cb.dias_em_aberto
      )
    END AS dias_em_aberto,
    CASE
      WHEN cb.pessoa_id IS NULL THEN cb.valor_mensal
      ELSE COALESCE(vm.valor_mensal_computado, cb.valor_mensal)
    END::numeric(12,2) AS valor_mensal
  FROM cliente_base cb
  LEFT JOIN parcelas_agg pa ON pa.client_id = cb.id AND cb.pessoa_id IS NOT NULL
  LEFT JOIN valor_mensal_lookup vm ON vm.client_id = cb.id AND cb.pessoa_id IS NOT NULL
)
SELECT
  id, razao_social, cnpj, contato, gestor, area, status_classe,
  valor_em_aberto, qtd_processos, horas_total, horas_por_ano,
  data_vencimento, observacoes_gerais, ultima_providencia, data_providencia,
  follow_up, data_follow_up, resolvido_at, reaberto_at, pessoa_id,
  created_at, updated_at, created_by, dias_em_aberto, valor_mensal,
  CASE
    WHEN dias_em_aberto > 5 THEN 'urgente'::text
    WHEN dias_em_aberto >= 3 THEN 'atencao'::text
    ELSE 'controlado'::text
  END AS prioridade
FROM base;
