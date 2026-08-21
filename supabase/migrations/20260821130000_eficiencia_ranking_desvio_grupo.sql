-- Rankings de desvio agrupados por Grupo Cliente (Agendamento + Eficiência Protocolo).

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_por_grupo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  grupo_cliente text,
  qtd_fatal integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo_cliente,
      fatal_sem18_d1
    FROM sp_tarefas
    WHERE (fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo')
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_conclusao)::integer = ANY (p_meses))
      AND (
        p_area IS NULL
        OR p_area = 'Operações Legais'
        OR area_conclusao = p_area
      )
      AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
      AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
  ),
  desvio AS (
    SELECT grupo_cliente
    FROM base
    WHERE fatal_sem18_d1 ILIKE 'fora do prazo'
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM desvio)
  SELECT
    grupo_cliente,
    COUNT(*)::integer AS qtd_fatal,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM desvio
  GROUP BY 1
  ORDER BY qtd_fatal DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_grupo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  grupo_cliente text,
  qtd_inconsistencia integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(trim(public.receita_grupo_cliente_canonico(cliente)), ''),
        '(sem grupo)'
      ) AS grupo_cliente
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area)
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    grupo_cliente,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_agendamento_por_grupo(integer, integer[], text) IS
  'Desvios D+1 (fora do prazo) de Ciência dos Agendamentos por grupo_cliente.';
COMMENT ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_grupo(integer, integer[], text) IS
  'Inconsistências jurídicas em protocolos por grupo_cliente (lookup receita_grupo_cliente_canonico).';

GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_por_grupo(integer, integer[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_grupo(integer, integer[], text) TO anon, authenticated;
