-- Ops Legais RG / SLA PUBLICAÇÕES:
--   % Eficiência = EFICIÊNCIA DE PUBLICAÇÃO / total
--   Análise: INCONSISTÊNCIAS - TIPO em branco ou ANÁLISE
--   Agendamento: INCONSISTÊNCIAS - TIPO em branco ou AGENDAMENTO
-- Eixo: Data_Recebimento_Sem_Hora (= DATA RECEBIMENTO KURIER)

ALTER TABLE public.sp_publicacoes
  ADD COLUMN IF NOT EXISTS data_recebimento_kurier date,
  ADD COLUMN IF NOT EXISTS inconsistencias_tipo text,
  ADD COLUMN IF NOT EXISTS inconsistencia_subtipo text;

COMMENT ON COLUMN public.sp_publicacoes.data_recebimento_kurier IS
  'SharePoint DATA RECEBIMENTO KURIER — eixo Data_Recebimento_Sem_Hora do BI.';
COMMENT ON COLUMN public.sp_publicacoes.inconsistencias_tipo IS
  'SharePoint INCONSISTÊNCIAS - TIPO (ANÁLISE / AGENDAMENTO / vazio).';
COMMENT ON COLUMN public.sp_publicacoes.inconsistencia_subtipo IS
  'SharePoint INCONSISTÊNCIA - SUBTIPO — base da coluna EFICIÊNCIA do BI.';
COMMENT ON COLUMN public.sp_publicacoes.eficiencia IS
  'BI: EFICIÊNCIA DE PUBLICAÇÃO (sem inconsistência) ou DESVIO (tipo/subtipo preenchido).';

CREATE INDEX IF NOT EXISTS sp_publicacoes_data_recebimento_kurier_idx
  ON public.sp_publicacoes (data_recebimento_kurier);
CREATE INDEX IF NOT EXISTS sp_publicacoes_inconsistencias_tipo_idx
  ON public.sp_publicacoes (inconsistencias_tipo);

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
            NULLIF(TRIM(COALESCE(inconsistencias_tipo, '')), '') IS NULL
            OR upper(TRIM(inconsistencias_tipo)) IN ('ANÁLISE', 'ANALISE')
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
  'BI Ops Legais / SLA PUBLICAÇÕES: % Eficiência (Análise ou Agendamento) por Data Recebimento Kurier.';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_publicacoes_efic_mensal(integer, text)
  TO anon, authenticated;
