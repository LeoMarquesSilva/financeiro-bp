-- Fechamento: KPI = somente ENVIO FECHAMENTO COMPLETO E DL APURADA no prazo.
-- Demais etapas acompanham no prazo via racional (não entram no % do card).

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
  WITH kpi AS (
    SELECT
      EXTRACT(
        MONTH FROM (date_trunc('month', t.data_limite) - interval '1 month')
      )::integer AS mes,
      t.data_conclusao,
      t.data_limite
    FROM public.sp_tarefas t
    WHERE t.tarefa = 'ENVIO FECHAMENTO COMPLETO E DL APURADA'
      AND t.data_limite IS NOT NULL
      AND EXTRACT(
        YEAR FROM (date_trunc('month', t.data_limite) - interval '1 month')
      )::integer = p_ano
  ),
  avaliacao AS (
    SELECT
      mes,
      CASE
        WHEN data_conclusao IS NOT NULL AND data_conclusao <= data_limite THEN 'dentro'
        ELSE 'fora'
      END AS status_kpi
    FROM kpi
  )
  SELECT
    mes,
    COUNT(*)::integer AS total_fechamentos,
    COUNT(*) FILTER (WHERE status_kpi = 'dentro')::integer AS qtd_dentro_prazo,
    COUNT(*) FILTER (WHERE status_kpi = 'fora')::integer AS qtd_fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_kpi = 'dentro')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_fechamento
  FROM avaliacao
  GROUP BY mes
  ORDER BY mes;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_fechamento_mensal(integer) IS
  'BI Ops Legais / Fechamento: % por competência só na tarefa '
  'ENVIO FECHAMENTO COMPLETO E DL APURADA (conclusão <= data limite).';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_fechamento_mensal(integer) TO authenticated;
