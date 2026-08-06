-- Agrupa FATAL não-excludente por justificativa (visual BI "Justificativa de Fatal").

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_justificativa_fatal(
  p_ano integer,
  p_mes integer DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  justificativa text,
  qtd integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(justificativa_fatal), ''), 'Sem Justificativa') AS justificativa
    FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL'
      AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = p_mes)
      AND (p_area IS NULL OR area_conclusao = p_area)
      AND status = 'Concluída'
      AND etiqueta_tarefa = 'PROTOCOLO'
      AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
      AND (
        tarefa IS NULL
        OR tarefa NOT IN (
          'MATERIAL MARKETING - REELS/POST/ARTIGO',
          'PROTOCOLO DUE DILIGENCE PROSPECT',
          'PROTOCOLO DUE DILLIGENCE PROSPECT'
        )
      )
      AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    justificativa,
    COUNT(*)::integer AS qtd,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd DESC;
$$;

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_justificativa_fatal(integer, integer, text)
  TO anon, authenticated;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_justificativa_fatal(integer, integer, text) IS
  'Qtd de FATAL não-excludente por justificativa (SLA Protocolo). Mesmos filtros do ranking.';
