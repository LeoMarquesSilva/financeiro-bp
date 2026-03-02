-- View para listagem: dias_em_aberto e valor_mensal calculados a partir de financeiro_parcelas.
-- Dias em atraso = hoje - vencimento da última parcela em atraso (a de vencimento mais recente entre as em atraso).
-- Valor mensal = valor da próxima parcela a vencer (a de vencimento mais próximo no futuro).
-- Prioridade: controlado <2, atenção 3-5, urgente >5.

CREATE OR REPLACE VIEW clients_inadimplencia_list AS
WITH base AS (
  SELECT
    c.*,
    COALESCE(
      (
        SELECT GREATEST(0, (current_date - fp.data_vencimento::date)::int)
        FROM financeiro_parcelas fp
        WHERE fp.pessoa_id = c.pessoa_id
          AND fp.situacao = 'ABERTO'
          AND fp.data_vencimento < current_date
        ORDER BY fp.data_vencimento DESC
        LIMIT 1
      ),
      c.dias_em_aberto
    )::int AS dias_computado,
    COALESCE(
      (
        SELECT fp.valor::numeric(12,2)
        FROM financeiro_parcelas fp
        WHERE fp.pessoa_id = c.pessoa_id
          AND fp.situacao = 'ABERTO'
          AND fp.data_vencimento >= current_date
        ORDER BY fp.data_vencimento ASC
        LIMIT 1
      ),
      c.valor_mensal
    ) AS valor_mensal_computado
  FROM clients_inadimplencia c
)
SELECT
  id,
  razao_social,
  cnpj,
  contato,
  gestor,
  area,
  status_classe,
  valor_em_aberto,
  qtd_processos,
  horas_total,
  horas_por_ano,
  data_vencimento,
  observacoes_gerais,
  ultima_providencia,
  data_providencia,
  follow_up,
  data_follow_up,
  resolvido_at,
  pessoa_id,
  created_at,
  updated_at,
  created_by,
  dias_computado AS dias_em_aberto,
  valor_mensal_computado AS valor_mensal,
  CASE
    WHEN dias_computado > 5 THEN 'urgente'::text
    WHEN dias_computado >= 3 THEN 'atencao'::text
    ELSE 'controlado'::text
  END AS prioridade
FROM base;

-- Permissões para a view
GRANT SELECT ON clients_inadimplencia_list TO anon, authenticated;
