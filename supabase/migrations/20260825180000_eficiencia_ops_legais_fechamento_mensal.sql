-- Fechamento financeiro mensal Ops Legais.
-- Competência = mês anterior ao mês da data limite.
-- KPI na tarefa final; demais tarefas do ciclo precisam estar concluídas.

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_fechamento_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total_fechamentos integer,
  qtd_dentro_prazo integer,
  qtd_fora_prazo integer,
  pct_fechamento numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fechamento_nomes AS (
    SELECT unnest(ARRAY[
      'ATUALIZAÇÃO DA PLANILHA DE RATEIOS',
      'VALIDAÇÃO DA PARTICIPAÇÃO DOS SÓCIOS PATRIMONIAIS NOS CONTRATOS NOVOS',
      'VALIDAÇÃO DA MOVIMENTAÇÃO FINANCEIRA',
      'ENVIO DO EXTRATO ADGM - RICARDO',
      'LANÇAMENTO DO EXTRATO ADGM',
      'ENVIO DA MOVIMENTAÇÃO FINANCEIRA',
      'ENVIO TIMESHEET',
      'ENVIO HEADCOUNT',
      'ENVIO FECHAMENTO COMPLETO E DL APURADA'
    ]::text[]) AS tarefa_nome
  ),
  base AS (
    SELECT
      t.tarefa,
      t.data_conclusao,
      t.data_limite,
      date_trunc('month', t.data_limite)::date AS ciclo_mes,
      (date_trunc('month', t.data_limite) - interval '1 month')::date AS competencia_ref
    FROM public.sp_tarefas t
    INNER JOIN fechamento_nomes f ON f.tarefa_nome = t.tarefa
    WHERE t.data_limite IS NOT NULL
  ),
  ciclos AS (
    SELECT DISTINCT
      ciclo_mes,
      competencia_ref,
      EXTRACT(MONTH FROM competencia_ref)::integer AS mes,
      EXTRACT(YEAR FROM competencia_ref)::integer AS ano_competencia
    FROM base
    WHERE EXTRACT(YEAR FROM competencia_ref)::integer = p_ano
  ),
  avaliacao AS (
    SELECT
      c.mes,
      c.ciclo_mes,
      BOOL_AND(b.data_conclusao IS NOT NULL) AS todas_concluidas,
      BOOL_AND(
        CASE
          WHEN b.tarefa = 'ENVIO FECHAMENTO COMPLETO E DL APURADA' THEN
            b.data_conclusao IS NOT NULL AND b.data_conclusao <= b.data_limite
          ELSE TRUE
        END
      ) AS kpi_no_prazo,
      BOOL_AND(
        CASE
          WHEN b.tarefa <> 'ENVIO FECHAMENTO COMPLETO E DL APURADA' THEN
            b.data_conclusao IS NOT NULL
          ELSE TRUE
        END
      ) AS deps_concluidas
    FROM ciclos c
    INNER JOIN base b ON b.ciclo_mes = c.ciclo_mes
    GROUP BY c.mes, c.ciclo_mes
  )
  SELECT
    mes,
    COUNT(*)::integer AS total_fechamentos,
    COUNT(*) FILTER (
      WHERE kpi_no_prazo AND deps_concluidas AND todas_concluidas
    )::integer AS qtd_dentro_prazo,
    COUNT(*) FILTER (
      WHERE NOT (kpi_no_prazo AND deps_concluidas AND todas_concluidas)
    )::integer AS qtd_fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (
          WHERE kpi_no_prazo AND deps_concluidas AND todas_concluidas
        )::numeric / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_fechamento
  FROM avaliacao
  GROUP BY mes
  ORDER BY mes;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_fechamento_mensal(integer) IS
  'BI Ops Legais / Fechamento: % de competências com entrega final no prazo '
  'e etapas concluídas (tarefa ENVIO FECHAMENTO COMPLETO E DL APURADA).';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_fechamento_mensal(integer) TO authenticated;
