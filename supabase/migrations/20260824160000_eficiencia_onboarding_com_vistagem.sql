-- Recorte de onboarding também em SLA Vistagem (risco e normal).
-- SLA Protocolo e Ciência Agendamentos já usam eficiencia_onboarding_exclui.

COMMENT ON TABLE public.eficiencia_onboarding_exclusoes IS
  'Grupos desconsiderados de SLA Protocolo, Ciência Agendamentos e SLA Vistagem (risco e normal) no período de onboarding/transição de carteira. Não vale para Eficiência Protocolo.';

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
$$;
