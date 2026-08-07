-- SLA PROTOCOLO (ex-% D1) no BI Ops Legais / KPI_HTML_D1_FATAL + HTML_Historico_D1:
--   - EFICIÊNCIA OPERACIONAL = SIM
--   - EFICIÊNCIA IN ('D1', 'PROTOCOLADO NO FATAL')  -- ENVIADO NO FATAL fica de fora do racional
--   - STATUS <> Cancelado, eixo PROTOCOLADO EM
-- % = D1 / (D1 + PROTOCOLADO NO FATAL)
-- Ano 2026: 3 PROTOCOLADO NO FATAL (bate com Racional.csv).

DROP FUNCTION IF EXISTS public.eficiencia_ops_legais_protocolo_mensal(integer);

CREATE FUNCTION public.eficiencia_ops_legais_protocolo_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  total integer,
  qtd_d1 integer,
  pct_d1 numeric,
  qtd_protocolado_fatal integer,
  total_eficiencia integer,
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
  WITH base AS (
    SELECT
      protocolado_em,
      eficiencia_sla,
      inconsistencia_controladoria,
      eficiencia_operacional
    FROM sp_protocolos
    WHERE (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELADO')
      AND protocolado_em IS NOT NULL
      AND EXTRACT(YEAR FROM protocolado_em)::integer = p_ano
  ),
  -- População do SLA PROTOCOLO / racional HTML_Historico_D1
  sla AS (
    SELECT *
    FROM base
    WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
      AND eficiencia_sla IN ('D1', 'PROTOCOLADO NO FATAL')
  ),
  sla_mes AS (
    SELECT
      EXTRACT(MONTH FROM protocolado_em)::integer AS mes,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE eficiencia_sla = 'D1')::integer AS qtd_d1,
      COUNT(*) FILTER (WHERE eficiencia_sla = 'PROTOCOLADO NO FATAL')::integer AS qtd_protocolado_fatal,
      ROUND(
        COALESCE(
          COUNT(*) FILTER (WHERE eficiencia_sla = 'D1')::numeric
            / NULLIF(COUNT(*), 0) * 100,
          0
        ),
        2
      ) AS pct_d1
    FROM sla
    GROUP BY 1
  ),
  -- Eficiência Protocolo (controladoria) continua na base sem o recorte D1/FATAL
  efi_mes AS (
    SELECT
      EXTRACT(MONTH FROM protocolado_em)::integer AS mes,
      COUNT(*) FILTER (
        WHERE NULLIF(TRIM(COALESCE(inconsistencia_controladoria, '')), '') IS NULL
      )::integer AS sem_inconsistencia,
      COUNT(*)::integer AS total_efi,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
      )::integer AS eficiencia_ok,
      COUNT(*) FILTER (
        WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('NÃO', 'NAO')
      )::integer AS eficiencia_nok
    FROM base
    GROUP BY 1
  )
  SELECT
    COALESCE(s.mes, e.mes) AS mes,
    COALESCE(s.total, 0) AS total,
    COALESCE(s.qtd_d1, 0) AS qtd_d1,
    COALESCE(s.pct_d1, 0) AS pct_d1,
    COALESCE(s.qtd_protocolado_fatal, 0) AS qtd_protocolado_fatal,
    COALESCE(e.total_efi, 0) AS total_eficiencia,
    COALESCE(e.sem_inconsistencia, 0) AS sem_inconsistencia,
    ROUND(
      COALESCE(e.sem_inconsistencia::numeric / NULLIF(e.total_efi, 0) * 100, 0),
      2
    ) AS pct_sem_inconsistencia,
    COALESCE(e.eficiencia_ok, 0) AS eficiencia_ok,
    COALESCE(e.eficiencia_nok, 0) AS eficiencia_nok,
    ROUND(
      COALESCE(
        e.eficiencia_ok::numeric
          / NULLIF(e.eficiencia_ok + e.eficiencia_nok, 0) * 100,
        0
      ),
      2
    ) AS pct_eficiencia_operacional
  FROM sla_mes s
  FULL OUTER JOIN efi_mes e ON e.mes = s.mes
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) IS
  'BI SLA PROTOCOLOS: SLA PROTOCOLO = D1/(D1+PROTOCOLADO NO FATAL) com operacional=SIM; Eficiência Protocolo = controladoria na base completa.';

GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) TO anon, authenticated;
