-- Alinha Agendamento[DePara] ao DAX do BI:
--   IF (TRIM([Adesão ao Indicador]) = "" || [Adesão ao Indicador] = "SEM ADESÃO",
--       "OK", "Inconsistência")
-- No SIOE: OK → 'Eficiência' (rótulo de conformidade); Inconsistência → 'Inconsistência'.

COMMENT ON COLUMN public.sp_agendamento.de_para IS
  'BI Agendamento[DePara]: OK/Eficiência se adesao_indicador vazio ou SEM ADESÃO; senão Inconsistência.';

UPDATE public.sp_agendamento
SET de_para = CASE
  WHEN NULLIF(TRIM(COALESCE(adesao_indicador, '')), '') IS NULL THEN 'Eficiência'
  WHEN UPPER(TRIM(adesao_indicador)) = 'SEM ADESÃO' THEN 'Eficiência'
  ELSE 'Inconsistência'
END
WHERE de_para IS DISTINCT FROM (
  CASE
    WHEN NULLIF(TRIM(COALESCE(adesao_indicador, '')), '') IS NULL THEN 'Eficiência'
    WHEN UPPER(TRIM(adesao_indicador)) = 'SEM ADESÃO' THEN 'Eficiência'
    ELSE 'Inconsistência'
  END
);

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_cadastro_depara_ok(p_adesao text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(TRIM(COALESCE(p_adesao, '')), '') IS NULL
    OR UPPER(TRIM(p_adesao)) = 'SEM ADESÃO';
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_cadastro_mensal(p_ano integer)
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
  WITH base AS (
    SELECT
      EXTRACT(MONTH FROM solicitado_em)::integer AS mes,
      CASE
        WHEN public.eficiencia_ops_legais_cadastro_depara_ok(adesao_indicador) THEN 'ok'
        ELSE 'inconsistencia'
      END AS status_cad
    FROM sp_agendamento
    WHERE solicitado_em IS NOT NULL
      AND EXTRACT(YEAR FROM solicitado_em)::integer = p_ano
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND NULLIF(TRIM(tipo_abertura_encerramento), '') IS NOT NULL
      AND tipo_abertura_encerramento = ANY (public.eficiencia_ops_legais_cadastro_tipos_abertura())
      AND EXISTS (
        SELECT 1
        FROM unnest(public.eficiencia_ops_legais_cadastro_controladoria()) AS n(nome)
        WHERE agendado_por ILIKE n.nome || '%'
      )
  )
  SELECT
    mes,
    COUNT(*) FILTER (WHERE status_cad = 'ok')::integer AS dentro_prazo,
    COUNT(*) FILTER (WHERE status_cad = 'inconsistencia')::integer AS fora_prazo,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_cad = 'ok')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_dentro_prazo
  FROM base
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer) IS
  'BI Ops Legais / Eficiência Cadastro: DePara via Adesão ao Indicador · controladoria · tipos Abertura/Serviço.';

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_cadastro_por_usuario(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
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
    SELECT
      TRIM(agendado_por) AS usuario,
      CASE
        WHEN public.eficiencia_ops_legais_cadastro_depara_ok(adesao_indicador) THEN 'ok'
        ELSE 'inconsistencia'
      END AS status_cad
    FROM sp_agendamento
    WHERE solicitado_em IS NOT NULL
      AND EXTRACT(YEAR FROM solicitado_em)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM solicitado_em)::integer = ANY (p_meses))
      AND NULLIF(TRIM(agendado_por), '') IS NOT NULL
      AND NULLIF(TRIM(tipo_abertura_encerramento), '') IS NOT NULL
      AND tipo_abertura_encerramento = ANY (public.eficiencia_ops_legais_cadastro_tipos_abertura())
      AND EXISTS (
        SELECT 1
        FROM unnest(public.eficiencia_ops_legais_cadastro_controladoria()) AS n(nome)
        WHERE agendado_por ILIKE n.nome || '%'
      )
  ),
  agg AS (
    SELECT
      usuario,
      COUNT(*) FILTER (WHERE status_cad = 'ok')::integer AS dentro_prazo,
      COUNT(*) FILTER (WHERE status_cad = 'inconsistencia')::integer AS fora_prazo
    FROM base
    GROUP BY 1
  ),
  tot AS (
    SELECT COALESCE(SUM(fora_prazo), 0)::numeric AS total_inconsist FROM agg
  )
  SELECT
    a.usuario,
    a.dentro_prazo,
    a.fora_prazo,
    ROUND(
      COALESCE(a.fora_prazo::numeric / NULLIF(t.total_inconsist, 0) * 100, 0),
      2
    ) AS pct_do_total
  FROM agg a
  CROSS JOIN tot t
  ORDER BY a.fora_prazo DESC, a.usuario;
$$;

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_depara_ok(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_mensal(integer)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_cadastro_por_usuario(integer, integer[])
  TO anon, authenticated;
