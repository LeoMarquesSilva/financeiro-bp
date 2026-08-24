-- Exclusões de grupo por onboarding / transição de carteira.
-- Recorte inicial: SLA Protocolo e Ciência Agendamentos.
-- Vistagem (risco e normal) entra em 20260824160000_eficiencia_onboarding_com_vistagem.sql.

CREATE TABLE public.eficiencia_onboarding_exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_cliente text NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date NOT NULL,
  motivo text NOT NULL DEFAULT 'Onboarding / transição de carteira',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT eficiencia_onboarding_exclusoes_periodo_chk
    CHECK (vigencia_fim >= vigencia_inicio)
);

CREATE INDEX eficiencia_onboarding_exclusoes_periodo_idx
  ON public.eficiencia_onboarding_exclusoes (vigencia_inicio, vigencia_fim);

COMMENT ON TABLE public.eficiencia_onboarding_exclusoes IS
  'Grupos desconsiderados de SLA Protocolo e Ciência Agendamentos no período de onboarding/transição de carteira. Não vale para Eficiência Protocolo nem vistagens.';

CREATE TRIGGER eficiencia_onboarding_exclusoes_updated_at
  BEFORE UPDATE ON public.eficiencia_onboarding_exclusoes
  FOR EACH ROW EXECUTE FUNCTION public.set_sp_updated_at();

ALTER TABLE public.eficiencia_onboarding_exclusoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon"
  ON public.eficiencia_onboarding_exclusoes FOR ALL TO anon
  USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated"
  ON public.eficiencia_onboarding_exclusoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_grupo_chave(p_grupo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(extensions.unaccent(
    regexp_replace(coalesce(p_grupo, ''), '^\s*Grupo\s+', '', 'i')
  )));
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_exclui(p_grupo text, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.eficiencia_onboarding_exclusoes e
    WHERE p_data IS NOT NULL
      AND p_data BETWEEN e.vigencia_inicio AND e.vigencia_fim
      AND public.eficiencia_onboarding_grupo_chave(p_grupo) <> ''
      AND public.eficiencia_onboarding_grupo_chave(e.grupo_cliente)
        = public.eficiencia_onboarding_grupo_chave(p_grupo)
  );
$$;

GRANT EXECUTE ON FUNCTION public.eficiencia_onboarding_grupo_chave(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_onboarding_exclui(text, date) TO anon, authenticated;

-- SLA Protocolo mensal
CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  qtd_d1 integer,
  qtd_fatal integer,
  qtd_excludente integer,
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
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'D-1'
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_d1,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'FATAL'
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_fatal,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'FATAL'
        AND excludente = 'Excludente'
    )::integer AS qtd_excludente,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 IN ('D-1', 'FATAL')
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (
          WHERE fatal_apos18 = 'D-1'
            AND (excludente IS DISTINCT FROM 'Excludente')
        )::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (
                WHERE fatal_apos18 IN ('D-1', 'FATAL')
                  AND (excludente IS DISTINCT FROM 'Excludente')
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_eficiencia,
    MAX(meta_d1) AS meta
  FROM sp_tarefas_historico
  WHERE EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
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
    AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, conclusao_completa::date)
  GROUP BY 1
  ORDER BY 1;
$$;

-- SLA Protocolo diário
CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_diario(
  p_ano integer,
  p_mes integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  dia integer,
  qtd_d1 integer,
  qtd_fatal integer,
  qtd_excludente integer,
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
    EXTRACT(DAY FROM conclusao_completa)::integer AS dia,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'D-1'
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_d1,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'FATAL'
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_fatal,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 = 'FATAL'
        AND excludente = 'Excludente'
    )::integer AS qtd_excludente,
    COUNT(DISTINCT ci) FILTER (
      WHERE fatal_apos18 IN ('D-1', 'FATAL')
        AND (excludente IS DISTINCT FROM 'Excludente')
    )::integer AS qtd_total,
    ROUND(
      COALESCE(
        COUNT(DISTINCT ci) FILTER (
          WHERE fatal_apos18 = 'D-1'
            AND (excludente IS DISTINCT FROM 'Excludente')
        )::numeric
          / NULLIF(
              COUNT(DISTINCT ci) FILTER (
                WHERE fatal_apos18 IN ('D-1', 'FATAL')
                  AND (excludente IS DISTINCT FROM 'Excludente')
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_eficiencia,
    MAX(meta_d1) AS meta
  FROM sp_tarefas_historico
  WHERE EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
    AND EXTRACT(MONTH FROM conclusao_completa)::integer = p_mes
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
    AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, conclusao_completa::date)
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (usuario text, qtd_fatal integer, pct_do_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao AS usuario FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL' AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area_conclusao = p_area)
      AND usuario_conclusao IS NOT NULL AND status = 'Concluída' AND etiqueta_tarefa = 'PROTOCOLO'
      AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
      AND (tarefa IS NULL OR tarefa NOT IN ('MATERIAL MARKETING - REELS/POST/ARTIGO','PROTOCOLO DUE DILIGENCE PROSPECT','PROTOCOLO DUE DILLIGENCE PROSPECT'))
      AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
      AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, conclusao_completa::date)
  ), total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT usuario, COUNT(*)::integer, ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2)
  FROM base GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_ranking_fatal_grupo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (grupo_cliente text, qtd_fatal integer, pct_do_total numeric)
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
      AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, conclusao_completa::date)
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

CREATE OR REPLACE FUNCTION public.eficiencia_sla_protocolo_justificativa_fatal(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (justificativa text, qtd integer, pct_do_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT COALESCE(NULLIF(trim(justificativa_fatal), ''), 'Sem Justificativa') AS justificativa
    FROM sp_tarefas_historico
    WHERE fatal_apos18 = 'FATAL' AND excludente = 'Não'
      AND EXTRACT(YEAR FROM conclusao_completa)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM conclusao_completa)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area_conclusao = p_area)
      AND status = 'Concluída' AND etiqueta_tarefa = 'PROTOCOLO'
      AND (area_conclusao IS NULL OR area_conclusao NOT IN ('Tributário', 'Operações Legais'))
      AND (tarefa IS NULL OR tarefa NOT IN ('MATERIAL MARKETING - REELS/POST/ARTIGO','PROTOCOLO DUE DILIGENCE PROSPECT','PROTOCOLO DUE DILLIGENCE PROSPECT'))
      AND (tarefa_pai IS NULL OR tarefa_pai <> 'MATERIAL MARKETING - REELS/POST/ARTIGO')
      AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, conclusao_completa::date)
  ), total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT justificativa, COUNT(*)::integer, ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2)
  FROM base GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
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
    AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, data_conclusao::date)
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_diario(
  p_ano integer,
  p_mes integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (dia integer, total integer, pct_dentro_prazo numeric)
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
    AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, data_conclusao::date)
  GROUP BY 1
  HAVING COUNT(DISTINCT ci) FILTER (
    WHERE fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo'
  ) > 0
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (usuario text, dentro_prazo integer, fora_prazo integer, pct_do_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT usuario_conclusao, fatal_sem18_d1 FROM sp_tarefas
    WHERE (fatal_sem18_d1 ILIKE 'dentro do prazo' OR fatal_sem18_d1 ILIKE 'fora do prazo')
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_conclusao)::integer = ANY (p_meses))
      AND (p_area IS NULL OR p_area = 'Operações Legais' OR area_conclusao = p_area)
      AND usuario_conclusao IS NOT NULL
      AND (area_conclusao IS NULL OR area_conclusao <> 'Tributário')
      AND tarefa = '1. CIÊNCIA DOS AGENDAMENTOS'
      AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, data_conclusao::date)
  ),
  total AS (SELECT COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric AS v FROM base)
  SELECT usuario_conclusao,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::integer,
    COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'fora do prazo')::integer,
    ROUND(COALESCE(COUNT(*) FILTER (WHERE fatal_sem18_d1 ILIKE 'dentro do prazo')::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2)
  FROM base GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_agendamento_por_grupo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (grupo_cliente text, qtd_fatal integer, pct_do_total numeric)
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
      AND NOT public.eficiencia_onboarding_exclui(grupo_cliente, data_conclusao::date)
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

-- Vistagem (risco e normal) não entra no recorte de onboarding.
CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (mes integer, total integer, vistado_d1 integer, pct_d1 numeric)
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

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_diario(
  p_ano integer,
  p_mes integer,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (dia integer, total integer, pct_d1 numeric)
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
    SELECT vistado_por, vistado_d1 FROM sp_publicacoes
    WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = ANY (p_meses))
      AND NULLIF(trim(vistado_por), '') IS NOT NULL
      AND NOT (p_risco = FALSE AND COALESCE(p_area, '') = 'Trabalhista')
      AND (p_area IS NULL OR p_area = 'Operações Legais' OR area = p_area)
      AND (
        p_risco IS NULL
        OR (p_risco = TRUE AND demanda_risco IS DISTINCT FROM 'Não' AND (area IS NULL OR area <> 'Operações Legais'))
        OR (p_risco = FALSE AND UPPER(TRIM(COALESCE(demanda_risco, ''))) IN ('NÃO', 'NAO')
            AND (area IS NULL OR area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário', 'Trabalhista')))
      )
  ),
  por_usuario AS (
    SELECT vistado_por AS usuario,
      COUNT(*) FILTER (WHERE vistado_d1 IS NOT NULL) AS total,
      COUNT(*) FILTER (WHERE vistado_d1 = 'Sim') AS vistado_d1
    FROM base GROUP BY 1
  ),
  total_geral AS (SELECT COUNT(*) FILTER (WHERE vistado_d1 = 'Sim')::numeric AS v FROM base)
  SELECT usuario, total, vistado_d1,
    ROUND(COALESCE(vistado_d1::numeric / NULLIF(total, 0) * 100, 0), 2),
    ROUND(COALESCE(vistado_d1::numeric / NULLIF((SELECT v FROM total_geral), 0) * 100, 0), 2)
  FROM por_usuario ORDER BY total DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_desvio_base(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS SETOF sp_publicacoes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM sp_publicacoes p
  WHERE EXTRACT(YEAR FROM p.disponibilizado_vistagem)::integer = p_ano
    AND (p_meses IS NULL OR EXTRACT(MONTH FROM p.disponibilizado_vistagem)::integer = ANY (p_meses))
    AND NULLIF(trim(p.vistado_por), '') IS NOT NULL
    AND p.vistado_d1 IS DISTINCT FROM 'Sim'
    AND NOT (p_risco = FALSE AND COALESCE(p_area, '') = 'Trabalhista')
    AND (
      p_area IS NULL
      OR p_area = 'Operações Legais'
      OR p.area = p_area
    )
    AND (
      p_risco IS NULL
      OR (
        p_risco = TRUE
        AND p.demanda_risco IS DISTINCT FROM 'Não'
        AND (p.area IS NULL OR p.area <> 'Operações Legais')
      )
      OR (
        p_risco = FALSE
        AND UPPER(TRIM(COALESCE(p.demanda_risco, ''))) IN ('NÃO', 'NAO')
        AND (
          p.area IS NULL
          OR p.area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário', 'Trabalhista')
        )
      )
    );
$$;
