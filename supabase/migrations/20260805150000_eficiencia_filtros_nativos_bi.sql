-- Replica os filtros nativos aplicados nos visuais do BI original (confirmados via prints
-- do painel de filtros do Power BI), que não estavam nas RPCs iniciais:
--
-- SLA Protocolo (tabela "Nova" / sp_tarefas_historico):
--   Status = 'Concluída'; Etiqueta da Tarefa = 'PROTOCOLO';
--   Área (na conclusão) não é Tributário nem Operações Legais;
--   Tarefa não é 'MATERIAL MARKETING - REELS/POST/ARTIGO' nem 'PROTOCOLO DUE DILIGENCE PROSPECT';
--   Tarefa Pai não é 'MATERIAL MARKETING - REELS/POST/ARTIGO'.
--
-- Eficiência Protocolo (sp_protocolos):
--   Área_no_Protocolo_Final não é Operações Legais nem Tributário.

DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_ranking_fatal(integer, integer);
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_ranking_inconsistencia(integer, integer);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  qtd_d1 integer,
  qtd_fatal integer,
  qtd_total integer,
  pct_eficiencia numeric,
  meta numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM conclusao_completa)::integer AS mes,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'D-1') AS qtd_d1,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'FATAL') AS qtd_fatal,
    COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 IN ('D-1', 'FATAL')) AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 = 'D-1')::numeric
          / NULLIF(COUNT(DISTINCT ci) FILTER (WHERE fatal_apos18 IN ('D-1', 'FATAL')), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia,
    MAX(meta_d1) AS meta
  FROM sp_tarefas_historico
  WHERE EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
    AND (p_area IS NULL OR area_conclusao = p_area)
    AND status = 'Concluída'
    AND etiqueta_tarefa = 'PROTOCOLO'
    AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
    AND (tarefa IS NULL OR tarefa NOT IN ('MATERIAL MARKETING - REELS/POST/ARTIGO', 'PROTOCOLO DUE DILIGENCE PROSPECT'))
    AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_fatal integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao AS usuario
    FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL'
      AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = p_mes)
      AND usuario_conclusao IS NOT NULL
      AND status = 'Concluída'
      AND etiqueta_tarefa = 'PROTOCOLO'
      AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
      AND (tarefa IS NULL OR tarefa NOT IN ('MATERIAL MARKETING - REELS/POST/ARTIGO', 'PROTOCOLO DUE DILIGENCE PROSPECT'))
      AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_fatal,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_fatal DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_mensal(p_ano integer, p_area text DEFAULT NULL)
RETURNS TABLE (
  mes integer,
  total integer,
  sem_inconsistencia integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_criada)::integer AS mes,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA') AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND (p_area IS NULL OR area = p_area)
    AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(
  p_ano integer,
  p_mes integer DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_inconsistencia integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT criado_por AS usuario
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = p_mes)
      AND criado_por IS NOT NULL
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) IS
  'SLA de Protocolo mensal (sp_tarefas_historico / "Nova"): D-1 vs FATAL, com meta vigente no período. Réplica dos filtros nativos do BI: Concluída, etiqueta PROTOCOLO, exclui área Tributário/Operações Legais e algumas tarefas de marketing/due diligence.';
COMMENT ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) IS
  'Eficiência de Protocolo mensal (sp_protocolos): % sem inconsistência jurídica. Exclui área Operações Legais/Tributário (filtro nativo do BI).';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(integer, integer) TO anon, authenticated;
