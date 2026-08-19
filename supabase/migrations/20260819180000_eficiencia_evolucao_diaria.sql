-- Série diária para drill-down nos gráficos de evolução (jurídico).

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_diario(
  p_ano integer,
  p_mes integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  dia integer,
  total integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DAY FROM data_criada)::integer AS dia,
    COUNT(*)::integer AS total,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND EXTRACT(MONTH FROM data_criada)::integer = p_mes
    AND (p_area IS NULL OR area = p_area)
    AND area IS NOT NULL
    AND area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
  GROUP BY 1
  HAVING COUNT(*) > 0
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_diario(
  p_ano integer,
  p_mes integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  dia integer,
  total integer,
  pct_dentro_prazo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DAY FROM data_conclusao)::integer AS dia,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'
    )::integer AS total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (
                WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_dentro_prazo
  FROM sp_tarefas
  WHERE EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
    AND EXTRACT(MONTH FROM data_conclusao)::integer = p_mes
    AND (
      p_area IS NULL
      OR p_area = 'Operações Legais'
      OR area_conclusao = p_area
    )
    AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
    AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
  GROUP BY 1
  HAVING COUNT(DISTINCT ci) FILTER (
    WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'
  ) > 0
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_diario(
  p_ano integer,
  p_mes integer,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  dia integer,
  total integer,
  pct_d1 numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DAY FROM disponibilizado_vistagem)::integer AS dia,
    COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL)::integer AS total,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL), 0) * 100,
        0
      ),
      2
    ) AS pct_d1
  FROM sp_publicacoes
  WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
    AND EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = p_mes
    AND NULLIF(trim(vistado_por), '') IS NOT NULL
    AND NOT (p_risco = FALSE AND COALESCE(p_area, '') = 'Trabalhista')
    AND (
      p_area IS NULL
      OR p_area = 'Operações Legais'
      OR area = p_area
    )
    AND (
      p_risco IS NULL
      OR (
        p_risco = TRUE
        AND demanda_risco IS DISTINCT FROM 'Não'
        AND (area IS NULL OR area <> 'Operações Legais')
      )
      OR (
        p_risco = FALSE
        AND UPPER(TRIM(COALESCE(demanda_risco, ''))) IN ('NÃO', 'NAO')
        AND (
          area IS NULL
          OR area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário', 'Trabalhista')
        )
      )
    )
  GROUP BY 1
  HAVING COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) > 0
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_protocolo_diario(integer, integer, text) IS
  'Eficiência de Protocolo por dia (data_criada) dentro de um mês.';
COMMENT ON FUNCTION public.eficiencia_agendamento_diario(integer, integer, text) IS
  'Ciência Agendamentos D+1 por dia (data_conclusao) dentro de um mês.';
COMMENT ON FUNCTION public.eficiencia_sla_vistagem_diario(integer, integer, boolean, text) IS
  'SLA Vistagem D+1 por dia. Exige vistado_por; mesmos filtros do mensal.';

GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_diario(integer, integer, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_diario(integer, integer, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_diario(integer, integer, boolean, text)
  TO anon, authenticated;
