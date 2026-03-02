-- Resumo por grupo (uma linha por grupo) para filtros, ordenação e paginação no front.
-- Leve: evita carregar todas as empresas; o front busca empresas só da página atual.
-- grupo_cliente vazio/null = '' (front exibe "Sem grupo").

CREATE OR REPLACE VIEW escritorio_grupos_resumo AS
WITH
  emp_count AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '') AS grupo_cliente, count(*)::int AS total_empresas
    FROM escritorio_empresas_por_grupo
    GROUP BY 1
  ),
  th_sum AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '') AS grupo_cliente, COALESCE(SUM(total_horas), 0)::numeric(12,2) AS horas_total
    FROM timesheets_resumo_por_grupo_ano
    GROUP BY 1
  ),
  fin_sum AS (
    SELECT COALESCE(NULLIF(trim(eepg.grupo_cliente), ''), '') AS grupo_cliente,
      COALESCE(SUM(f.valor_aberto), 0)::numeric(12,2) AS valor_aberto,
      COALESCE(SUM(f.valor_pago), 0)::numeric(12,2) AS valor_pago,
      COALESCE(SUM(f.valor_em_atraso), 0)::numeric(12,2) AS valor_em_atraso
    FROM escritorio_empresas_por_grupo eepg
    JOIN relatorio_financeiro_resumo_por_cliente f ON f.pessoa_id = eepg.id
    GROUP BY 1
  )
SELECT
  e.grupo_cliente,
  e.total_empresas,
  COALESCE(c.total_geral, 0)::int AS total_geral,
  COALESCE(th.horas_total, 0)::numeric(12,2) AS horas_total,
  COALESCE(f.valor_aberto, 0)::numeric(12,2) AS valor_aberto,
  COALESCE(f.valor_pago, 0)::numeric(12,2) AS valor_pago,
  COALESCE(f.valor_em_atraso, 0)::numeric(12,2) AS valor_em_atraso
FROM emp_count e
LEFT JOIN contagem_ci_por_grupo c ON c.grupo_cliente = e.grupo_cliente
LEFT JOIN th_sum th ON th.grupo_cliente = e.grupo_cliente
LEFT JOIN fin_sum f ON f.grupo_cliente = e.grupo_cliente;
