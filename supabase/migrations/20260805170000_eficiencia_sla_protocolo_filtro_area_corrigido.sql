-- Correção do filtro de área do SLA Protocolo: o filtro de página do BI exclui também
-- "Distressd Deals" e EXCLUI linhas sem área (a versão anterior incluía area_conclusao NULL
-- por engano, com "area_conclusao IS NULL OR ..."). Área agora deve ser NOT NULL e
-- NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário').

DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_ranking_fatal(integer, integer);

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
    AND area_conclusao IS NOT NULL
    AND area_conclusao NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
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
      AND area_conclusao IS NOT NULL
      AND area_conclusao NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
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

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(integer, integer) TO anon, authenticated;

-- Mesma correção para Eficiência Protocolo: exclui também Distressd Deals e linhas sem área.
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_mensal(integer, text);
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_ranking_inconsistencia(integer, integer);

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
    AND area IS NOT NULL
    AND area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
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
      AND area IS NOT NULL
      AND area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
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

GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_mensal(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(integer, integer) TO anon, authenticated;
