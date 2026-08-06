-- Operações Legais no slicer de área não filtra Ciência Agendamentos nem SLAs de Vistagem
-- (permanecem consolidados, como no BI). Vistagem risco/comum continua excluindo Ops. Legais da base.

DROP FUNCTION IF EXISTS public.eficiencia_agendamento_mensal(integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  dentro_prazo integer,
  fora_prazo integer,
  pct_dentro_prazo numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_conclusao)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo') AS dentro_prazo,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo') AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'),
              0
            ) * 100,
        0
      ), 2
    ) AS pct_dentro_prazo
  FROM sp_tarefas
  WHERE EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
    AND (
      p_area IS NULL
      OR p_area = 'Operações Legais'
      OR area_conclusao = p_area
    )
    AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
    AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
  GROUP BY 1
  ORDER BY 1;
$$;

DROP FUNCTION IF EXISTS public.eficiencia_sla_vistagem_mensal(integer, boolean, text);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  total integer,
  vistado_d1 integer,
  pct_d1 numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM disponibilizado_vistagem)::integer AS mes,
    COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
    COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL), 0) * 100,
        0
      ), 2
    ) AS pct_d1
  FROM sp_publicacoes
  WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
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
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_agendamento_mensal(integer, text) IS
  'Agendamento/Ciência D+1 mensal. Slicer Operações Legais não filtra (consolidado); exclui Tributário.';

COMMENT ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) IS
  'SLA Vistagem D+1. Slicer Operações Legais não filtra; Ops. Legais fora da população de risco/normal.';

GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_mensal(integer, boolean, text) TO anon, authenticated;
