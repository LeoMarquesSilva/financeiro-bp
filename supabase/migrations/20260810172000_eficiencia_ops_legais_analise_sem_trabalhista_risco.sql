-- ANÁLISE DE PUBLICAÇÃO: exclui Trabalhista com Demanda de Risco = Sim.
-- AGENDAMENTO DE PUBLICAÇÃO: sem alteração (continua incluindo).

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_publicacoes_efic_mensal(
  p_ano integer,
  p_escopo text
)
RETURNS TABLE (
  mes integer,
  total integer,
  qtd_eficiencia integer,
  qtd_desvio integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      EXTRACT(MONTH FROM data_recebimento_kurier)::integer AS mes,
      CASE
        WHEN NULLIF(TRIM(COALESCE(inconsistencias_tipo, '')), '') IS NULL
         AND NULLIF(TRIM(COALESCE(inconsistencia_subtipo, '')), '') IS NULL
          THEN 'EFICIÊNCIA DE PUBLICAÇÃO'
        ELSE 'DESVIO'
      END AS eficiencia_calc
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND EXTRACT(YEAR FROM data_recebimento_kurier)::integer = p_ano
      AND (
        CASE lower(trim(COALESCE(p_escopo, '')))
          WHEN 'analise' THEN
            (
              NULLIF(TRIM(COALESCE(inconsistencias_tipo, '')), '') IS NULL
              OR upper(TRIM(inconsistencias_tipo)) IN ('ANÁLISE', 'ANALISE')
            )
            -- Só Análise: fora Trabalhista + Demanda de Risco = Sim
            AND NOT (
              COALESCE(area, '') = 'Trabalhista'
              AND COALESCE(demanda_risco, '') ILIKE 'Sim'
            )
          WHEN 'agendamento' THEN
            NULLIF(TRIM(COALESCE(inconsistencias_tipo, '')), '') IS NULL
            OR upper(TRIM(inconsistencias_tipo)) = 'AGENDAMENTO'
          ELSE FALSE
        END
      )
  )
  SELECT
    mes,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE eficiencia_calc = 'EFICIÊNCIA DE PUBLICAÇÃO')::integer AS qtd_eficiencia,
    COUNT(*) FILTER (WHERE eficiencia_calc = 'DESVIO')::integer AS qtd_desvio,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE eficiencia_calc = 'EFICIÊNCIA DE PUBLICAÇÃO')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_eficiencia
  FROM base
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_publicacoes_efic_mensal(integer, text) IS
  'BI Ops Legais / SLA PUBLICAÇÕES: Análise exclui Trabalhista+Demanda Risco Sim; Agendamento sem esse corte.';
