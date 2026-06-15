-- Sem grupo: contar e exibir só empresas com processos, timesheet ou valor financeiro.
CREATE OR REPLACE VIEW escritorio_grupos_resumo AS
WITH emp_count AS (
  SELECT
    COALESCE(NULLIF(TRIM(BOTH FROM e.grupo_cliente), ''), '') AS grupo_cliente,
    count(*)::integer AS total_empresas
  FROM escritorio_empresas_por_grupo e
  WHERE
    COALESCE(NULLIF(TRIM(BOTH FROM e.grupo_cliente), ''), '') <> ''
    OR e.qtd_processos > 0
    OR e.horas_total > 0
    OR e.valor_aberto > 0
    OR e.valor_pago > 0
    OR e.valor_em_atraso > 0
  GROUP BY 1
),
th_sum AS (
  SELECT
    COALESCE(NULLIF(TRIM(BOTH FROM timesheets_resumo_por_grupo_ano.grupo_cliente), ''), '') AS grupo_cliente,
    COALESCE(sum(timesheets_resumo_por_grupo_ano.total_horas), 0::numeric)::numeric(12, 2) AS horas_total
  FROM timesheets_resumo_por_grupo_ano
  GROUP BY 1
),
fin_sum AS (
  SELECT
    COALESCE(NULLIF(TRIM(BOTH FROM eepg.grupo_cliente), ''), '') AS grupo_cliente,
    COALESCE(sum(f_1.valor_aberto), 0::numeric)::numeric(12, 2) AS valor_aberto,
    COALESCE(sum(f_1.valor_pago), 0::numeric)::numeric(12, 2) AS valor_pago,
    COALESCE(sum(f_1.valor_em_atraso), 0::numeric)::numeric(12, 2) AS valor_em_atraso
  FROM escritorio_empresas_por_grupo eepg
    JOIN relatorio_financeiro_resumo_por_cliente f_1 ON f_1.pessoa_id = eepg.id
  GROUP BY 1
)
SELECT
  e.grupo_cliente,
  e.total_empresas,
  COALESCE(c.total_geral, 0) AS total_geral,
  COALESCE(th.horas_total, 0::numeric)::numeric(12, 2) AS horas_total,
  COALESCE(f.valor_aberto, 0::numeric)::numeric(12, 2) AS valor_aberto,
  COALESCE(f.valor_pago, 0::numeric)::numeric(12, 2) AS valor_pago,
  COALESCE(f.valor_em_atraso, 0::numeric)::numeric(12, 2) AS valor_em_atraso
FROM emp_count e
  LEFT JOIN contagem_ci_por_grupo c ON c.grupo_cliente = e.grupo_cliente
  LEFT JOIN th_sum th ON th.grupo_cliente = e.grupo_cliente
  LEFT JOIN fin_sum f ON f.grupo_cliente = e.grupo_cliente;
