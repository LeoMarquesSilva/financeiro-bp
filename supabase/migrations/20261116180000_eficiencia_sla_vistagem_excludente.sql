-- SLA Vistagem: publicação marcada como Excludente continua no BKP e no racional,
-- mas sai da % do KPI (mesma regra do Excludente do SLA Protocolo).
--
-- A marcação é manual (validada pela controladoria). O sync do SharePoint e a
-- gravação do Orquestra não mandam essas colunas no upsert, então a flag não é
-- desfeita na próxima carga.

ALTER TABLE public.sp_publicacoes
  ADD COLUMN IF NOT EXISTS excludente text NOT NULL DEFAULT 'Não',
  ADD COLUMN IF NOT EXISTS excludente_motivo text;

ALTER TABLE public.sp_publicacoes
  DROP CONSTRAINT IF EXISTS sp_publicacoes_excludente_check;

ALTER TABLE public.sp_publicacoes
  ADD CONSTRAINT sp_publicacoes_excludente_check
  CHECK (excludente IN ('Excludente', 'Não'));

COMMENT ON COLUMN public.sp_publicacoes.excludente IS
  'Excludente = fora da % do SLA Vistagem (lista no racional). Marcação manual da controladoria; o sync não sobrescreve.';
COMMENT ON COLUMN public.sp_publicacoes.excludente_motivo IS
  'Por que a publicação foi tirada do SLA Vistagem.';

-- ---------------------------------------------------------------------------
-- Série mensal (cards e gráficos de SLA Vistagem risco/normal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_mensal(
  p_ano integer,
  p_risco boolean DEFAULT NULL::boolean,
  p_area text DEFAULT NULL::text
)
RETURNS TABLE(mes integer, total integer, vistado_d1 integer, pct_d1 numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH excl AS MATERIALIZED (
    SELECT chave, vigencia_inicio, vigencia_fim, origem
    FROM public.eficiencia_onboarding_exclusao_chaves
  )
  SELECT
    EXTRACT(MONTH FROM t.disponibilizado_vistagem)::integer AS mes,
    COUNT(*) FILTER (WHERE t.vistado_d1 IS NOT NULL) AS total,
    COUNT(*) FILTER (WHERE t.vistado_d1 = 'Sim') AS vistado_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE t.vistado_d1 = 'Sim')::numeric
          / NULLIF(COUNT(*) FILTER (WHERE t.vistado_d1 IS NOT NULL), 0) * 100,
        0
      ), 2
    ) AS pct_d1
  FROM sp_publicacoes t
  CROSS JOIN LATERAL (
    SELECT public.eficiencia_onboarding_grupo_chave(t.grupo) AS k
  ) s
  WHERE t.disponibilizado_vistagem >= make_date(p_ano, 1, 1)::timestamptz
    AND t.disponibilizado_vistagem < make_date(p_ano + 1, 1, 1)::timestamptz
    AND NULLIF(trim(t.vistado_por), '') IS NOT NULL
    AND t.excludente IS DISTINCT FROM 'Excludente'
    AND NOT (p_risco = FALSE AND COALESCE(p_area, '') = 'Trabalhista')
    AND (
      p_area IS NULL
      OR p_area = 'Operações Legais'
      OR t.area = p_area
    )
    AND (
      p_risco IS NULL
      OR (
        p_risco = TRUE
        AND t.demanda_risco IS DISTINCT FROM 'Não'
        AND (t.area IS NULL OR t.area <> 'Operações Legais')
      )
      OR (
        p_risco = FALSE
        AND UPPER(TRIM(COALESCE(t.demanda_risco, ''))) IN ('NÃO', 'NAO')
        AND (
          t.area IS NULL
          OR t.area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário', 'Trabalhista')
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM excl c
      WHERE t.disponibilizado_vistagem::date BETWEEN c.vigencia_inicio AND c.vigencia_fim
        AND s.k <> ''
        AND (
          (
            c.origem = 'grupo'
            AND (
              c.chave = s.k
              OR s.k LIKE c.chave || ' %'
              OR c.chave LIKE s.k || ' %'
            )
          )
          OR (c.origem = 'pessoa' AND c.chave = s.k)
        )
    )
  GROUP BY 1
  ORDER BY 1;
$function$;

-- ---------------------------------------------------------------------------
-- Série diária
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_diario(
  p_ano integer,
  p_mes integer,
  p_risco boolean DEFAULT NULL::boolean,
  p_area text DEFAULT NULL::text
)
RETURNS TABLE(dia integer, total integer, pct_d1 numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND excludente IS DISTINCT FROM 'Excludente'
    AND NOT public.eficiencia_onboarding_exclui(grupo, disponibilizado_vistagem::date)
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
$function$;

-- ---------------------------------------------------------------------------
-- Por usuário (vistador)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL::integer[],
  p_risco boolean DEFAULT NULL::boolean,
  p_area text DEFAULT NULL::text
)
RETURNS TABLE(usuario text, total integer, vistado_d1 integer, pct_d1 numeric, pct_do_total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT vistado_por, vistado_d1 FROM sp_publicacoes
    WHERE EXTRACT(YEAR FROM disponibilizado_vistagem)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM disponibilizado_vistagem)::integer = ANY (p_meses))
      AND NULLIF(trim(vistado_por), '') IS NOT NULL
      AND excludente IS DISTINCT FROM 'Excludente'
      AND NOT public.eficiencia_onboarding_exclui(grupo, disponibilizado_vistagem::date)
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
$function$;

-- ---------------------------------------------------------------------------
-- Base dos rankings de desvio (por grupo, tipo e usuário)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_desvio_base(
  p_ano integer,
  p_meses integer[] DEFAULT NULL::integer[],
  p_risco boolean DEFAULT NULL::boolean,
  p_area text DEFAULT NULL::text
)
RETURNS SETOF sp_publicacoes
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.*
  FROM sp_publicacoes p
  WHERE EXTRACT(YEAR FROM p.disponibilizado_vistagem)::integer = p_ano
    AND (p_meses IS NULL OR EXTRACT(MONTH FROM p.disponibilizado_vistagem)::integer = ANY (p_meses))
    AND NULLIF(trim(p.vistado_por), '') IS NOT NULL
    AND p.vistado_d1 IS DISTINCT FROM 'Sim'
    AND p.excludente IS DISTINCT FROM 'Excludente'
    AND NOT public.eficiencia_onboarding_exclui(p.grupo, p.disponibilizado_vistagem::date)
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
$function$;

-- ---------------------------------------------------------------------------
-- Excludentes validados
-- ---------------------------------------------------------------------------
-- 16/11/2026 — Rec. Crédito, lote de 03/11: a CI 54777 ainda era de Insolvência e
-- as publicações foram trocadas de área na vistagem antes do saneamento de 09/11.
-- No fluxo antigo (SharePoint) a troca de área não reinicia o relógio do SLA.
UPDATE public.sp_publicacoes
SET excludente = 'Excludente',
    excludente_motivo = 'Troca de área na vistagem (pasta ainda em Insolvência antes do saneamento de 09/11/2026); no fluxo antigo o relógio do SLA não reinicia na transferência. Validado pela controladoria em 16/11/2026.'
WHERE sp_id IN (171012, 171026)
  AND origem = 'sharepoint';
