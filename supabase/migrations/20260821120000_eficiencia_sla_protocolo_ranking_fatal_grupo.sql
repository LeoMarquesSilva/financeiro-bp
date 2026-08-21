-- Ranking FATAL (SLA Protocolo) agrupado por Grupo Cliente — espelha ranking por responsável.

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal_grupo(
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
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo_cliente
    FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL'
      AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = ANY (p_meses))
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
    grupo_cliente,
    COUNT(*)::integer AS qtd_fatal,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_fatal DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal_grupo(integer, integer[], text) IS
  'Ranking FATAL não-excludente por grupo_cliente (SLA Protocolo). Mesmos filtros de eficiencia_sla_protocolo_ranking_fatal.';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal_grupo(integer, integer[], text)
  TO anon, authenticated;
