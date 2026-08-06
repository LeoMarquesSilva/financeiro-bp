-- Rankings passam a aceitar lista de meses (p_meses), alinhado ao MesFilterButtons do Overview.
-- NULL = ano inteiro; array = meses inclusos (Resultado / multi-seleção).

-- ============================================================
-- SLA Protocolo — ranking FATAL
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_ranking_fatal(integer, integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
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
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area_conclusao = p_area)
      AND usuario_conclusao IS NOT NULL
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
    usuario,
    COUNT(*)::integer AS qtd_fatal,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_fatal DESC;
$$;

-- ============================================================
-- SLA Protocolo — justificativa FATAL
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_sla_protocolo_justificativa_fatal(integer, integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_justificativa_fatal(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
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
    justificativa,
    COUNT(*)::integer AS qtd,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd DESC;
$$;

-- ============================================================
-- Eficiência Protocolo — ranking inconsistência
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_protocolo_ranking_inconsistencia(integer, integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
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
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area)
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

-- ============================================================
-- SLA Vistagem — ranking por usuário
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_sla_vistagem_por_usuario(integer, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  total integer,
  vistado_d1 integer,
  pct_d1 numeric,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT vistado_por, vistado_d1
    FROM sp_publicacoes
    WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = ANY (p_meses))
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
  ),
  por_usuario AS (
    SELECT
      vistado_por AS usuario,
      COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
      COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1
    FROM base
    GROUP BY 1
  ),
  total_geral AS (
    SELECT COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric AS v FROM base
  )
  SELECT
    usuario,
    total,
    vistado_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF(total, 0) * 100, 0), 2) AS pct_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF((SELECT v FROM total_geral), 0) * 100, 0), 2) AS pct_do_total
  FROM por_usuario
  ORDER BY total DESC;
$$;

-- ============================================================
-- Agendamento — ranking por usuário
-- ============================================================
DROP FUNCTION IF EXISTS public.eficiencia_agendamento_por_usuario(integer, integer, text);

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  dentro_prazo integer,
  fora_prazo integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao, fatal_sem18_d1
    FROM sp_tarefas
    WHERE (fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo')
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_conclusao)::integer = ANY (p_meses))
      AND (
        p_area IS NULL
        OR p_area = 'Operações Legais'
        OR area_conclusao = p_area
      )
      AND usuario_conclusao IS NOT NULL
      AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
      AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
  ),
  total AS (SELECT COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric AS v FROM base)
  SELECT
    usuario_conclusao AS usuario,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer AS dentro_prazo,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric
          / NULLIF((SELECT v FROM total), 0) * 100,
        0
      ), 2
    ) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY dentro_prazo DESC;
$$;

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(integer, integer[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_protocolo_justificativa_fatal(integer, integer[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(integer, integer[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_por_usuario(integer, integer[], boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_agendamento_por_usuario(integer, integer[], text) TO anon, authenticated;
