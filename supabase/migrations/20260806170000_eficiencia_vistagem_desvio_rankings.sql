-- Rankings de desvio (fora do D+1) para SLA Vistagem:
-- % por responsável, por tipo de publicação (tipo_agendamento), por grupo cliente.

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_desvio_base(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS SETOF public.sp_publicacoes
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

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_desvio_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_desvio integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT vistado_por AS usuario
    FROM public.eficiencia_sla_vistagem_desvio_base(p_ano, p_meses, p_risco, p_area)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    usuario,
    COUNT(*)::integer AS qtd_desvio,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_desvio DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_desvio_por_tipo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  tipo_publicacao text,
  qtd_desvio integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT COALESCE(NULLIF(trim(tipo_agendamento), ''), '(sem tipo)') AS tipo_publicacao
    FROM public.eficiencia_sla_vistagem_desvio_base(p_ano, p_meses, p_risco, p_area)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    tipo_publicacao,
    COUNT(*)::integer AS qtd_desvio,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_desvio DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_sla_vistagem_desvio_por_grupo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_risco boolean DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  grupo_cliente text,
  qtd_desvio integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT COALESCE(NULLIF(trim(grupo), ''), '(sem grupo)') AS grupo_cliente
    FROM public.eficiencia_sla_vistagem_desvio_base(p_ano, p_meses, p_risco, p_area)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    grupo_cliente,
    COUNT(*)::integer AS qtd_desvio,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_desvio DESC;
$$;

COMMENT ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_usuario(integer, integer[], boolean, text) IS
  '% / qtd de desvios D+1 (vistado_d1 <> Sim) por responsável.';
COMMENT ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_tipo(integer, integer[], boolean, text) IS
  'Desvios D+1 agrupados por tipo_agendamento (Tipo publicação).';
COMMENT ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_grupo(integer, integer[], boolean, text) IS
  'Desvios D+1 agrupados por grupo (Grupo Cliente).';

GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_desvio_base(integer, integer[], boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_usuario(integer, integer[], boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_tipo(integer, integer[], boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_grupo(integer, integer[], boolean, text) TO anon, authenticated;
