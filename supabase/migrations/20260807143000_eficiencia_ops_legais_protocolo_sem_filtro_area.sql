-- SLA PROTOCOLOS (BI Ops Legais): a página NÃO filtra por área.
-- % D1 / Eficiência Protocolo = BASE-PROTOCOLOS inteira (STATUS <> Cancelado),
-- eixo PROTOCOLADO EM. Jul/26: 841 D1 / 963 total (não os 59 só de Ops Legais).

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_protocolo_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total integer,
  qtd_d1 integer,
  pct_d1 numeric,
  sem_inconsistencia integer,
  pct_sem_inconsistencia numeric,
  eficiencia_ok integer,
  eficiencia_nok integer,
  pct_eficiencia_operacional numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM protocolado_em)::integer AS mes,
    COUNT(*)::integer AS total,
    COUNT(*) FILTER (WHERE eficiencia_sla = 'D1')::integer AS qtd_d1,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE eficiencia_sla = 'D1')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_d1,
    COUNT(*) FILTER (
      WHERE NULLIF(TRIM(COALESCE(inconsistencia_controladoria, '')), '') IS NULL
    )::integer AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (
          WHERE NULLIF(TRIM(COALESCE(inconsistencia_controladoria, '')), '') IS NULL
        )::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_sem_inconsistencia,
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
    )::integer AS eficiencia_ok,
    COUNT(*) FILTER (
      WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('NÃO', 'NAO')
    )::integer AS eficiencia_nok,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (
          WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
        )::numeric
          / NULLIF(
              COUNT(*) FILTER (
                WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('SIM', 'NÃO', 'NAO')
              ),
              0
            ) * 100,
        0
      ),
      2
    ) AS pct_eficiencia_operacional
  FROM sp_protocolos
  WHERE (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELADO')
    AND protocolado_em IS NOT NULL
    AND EXTRACT(YEAR FROM protocolado_em)::integer = p_ano
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) IS
  'BI SLA PROTOCOLOS: % D1 e Eficiência Protocolo (controladoria). Sem filtro de área — mesma base do PBIX.';

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_protocolo_ranking(
  p_ano integer,
  p_meses integer[] DEFAULT NULL
)
RETURNS TABLE (
  usuario text,
  qtd_inconsistencia integer,
  qtd_eficiencia_nok integer,
  pct_do_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(TRIM(protocolado_por), ''), NULLIF(TRIM(nome_limpo), ''), 'Sem responsável') AS usuario,
      inconsistencia_controladoria,
      eficiencia_operacional
    FROM sp_protocolos
    WHERE (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELADO')
      AND protocolado_em IS NOT NULL
      AND EXTRACT(YEAR FROM protocolado_em)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM protocolado_em)::integer = ANY (p_meses))
  ),
  agreg AS (
    SELECT
      usuario,
      COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(inconsistencia_controladoria, '')), '') IS NOT NULL
      )::integer AS qtd_inconsistencia,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('NÃO', 'NAO')
      )::integer AS qtd_eficiencia_nok
    FROM base
    GROUP BY 1
  ),
  total AS (
    SELECT NULLIF(SUM(qtd_inconsistencia + qtd_eficiencia_nok), 0)::numeric AS v FROM agreg
  )
  SELECT
    a.usuario,
    a.qtd_inconsistencia,
    a.qtd_eficiencia_nok,
    ROUND(
      COALESCE((a.qtd_inconsistencia + a.qtd_eficiencia_nok)::numeric / (SELECT v FROM total) * 100, 0),
      2
    ) AS pct_do_total
  FROM agreg a
  WHERE a.qtd_inconsistencia > 0 OR a.qtd_eficiencia_nok > 0
  ORDER BY (a.qtd_inconsistencia + a.qtd_eficiencia_nok) DESC, a.usuario;
$$;
