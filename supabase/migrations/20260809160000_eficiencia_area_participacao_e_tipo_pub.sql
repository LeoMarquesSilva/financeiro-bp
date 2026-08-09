-- 1) Participação de cada área no volume de protocolos do escritório (mês/período).
-- 2) Limpa ["TIPO"] no ranking Tipo Publicação (vistagem desvio).

CREATE OR REPLACE FUNCTION public.eficiencia_area_participacao(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (
  area text,
  qtd integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT COALESCE(NULLIF(TRIM(area), ''), '(sem área)') AS area
    FROM sp_protocolos
    WHERE data_criada IS NOT NULL
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (
        p_meses IS NULL
        OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses)
      )
      AND area IS NOT NULL
      AND TRIM(area) <> ''
      AND area IN (
        'Cível',
        'Contratos',
        'Operações Legais',
        'Recuperação de Crédito',
        'Reestruturação',
        'Trabalhista'
      )
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    b.area,
    COUNT(*)::integer AS qtd,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base b
  GROUP BY 1
  ORDER BY qtd DESC, area;
$$;

COMMENT ON FUNCTION public.eficiencia_area_participacao(integer, integer[]) IS
  '% de protocolos (data_criada) que cada área representa no escritório no período.';

GRANT EXECUTE ON FUNCTION public.eficiencia_area_participacao(integer, integer[])
  TO anon, authenticated;

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
    SELECT
      COALESCE(
        NULLIF(
          TRIM(BOTH FROM regexp_replace(COALESCE(tipo_agendamento, ''), '[\[\]"\\]', '', 'g')),
          ''
        ),
        '(sem tipo)'
      ) AS tipo_publicacao
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

COMMENT ON FUNCTION public.eficiencia_sla_vistagem_desvio_por_tipo(integer, integer[], boolean, text) IS
  'Desvios D+1 por tipo_agendamento, sem envelope JSON ["…"].';
