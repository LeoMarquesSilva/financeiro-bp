-- Recorte de onboarding em Eficiência Protocolo.
-- Match de grupo também por razão social (pessoas) e prefixo.

COMMENT ON TABLE public.eficiencia_onboarding_exclusoes IS
  'Grupos desconsiderados de SLA Protocolo, Eficiência Protocolo, Ciência Agendamentos e SLA Vistagem (risco e normal) no período de onboarding/transição de carteira.';

CREATE OR REPLACE FUNCTION public.eficiencia_onboarding_exclui(p_grupo text, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_data IS NULL OR public.eficiencia_onboarding_grupo_chave(p_grupo) = '' THEN false
    ELSE COALESCE(
      (
        SELECT true
        FROM public.eficiencia_onboarding_exclusoes e
        WHERE p_data BETWEEN e.vigencia_inicio AND e.vigencia_fim
          AND (
            public.eficiencia_onboarding_grupo_chave(e.grupo_cliente)
              = public.eficiencia_onboarding_grupo_chave(p_grupo)
            OR public.eficiencia_onboarding_grupo_chave(p_grupo)
              LIKE public.eficiencia_onboarding_grupo_chave(e.grupo_cliente) || ' %'
            OR public.eficiencia_onboarding_grupo_chave(e.grupo_cliente)
              LIKE public.eficiencia_onboarding_grupo_chave(p_grupo) || ' %'
          )
        LIMIT 1
      ),
      (
        SELECT true
        FROM public.eficiencia_onboarding_exclusoes e
        JOIN public.pessoas p ON p.grupo_cliente = e.grupo_cliente
        WHERE p_data BETWEEN e.vigencia_inicio AND e.vigencia_fim
          AND public.eficiencia_onboarding_grupo_chave(p.nome)
            = public.eficiencia_onboarding_grupo_chave(p_grupo)
        LIMIT 1
      ),
      false
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_mensal(
  p_ano integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (
  mes integer,
  total integer,
  sem_inconsistencia integer,
  pct_eficiencia numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM data_criada)::integer AS mes,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA') AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ), 2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND (p_area IS NULL OR area = p_area)
    AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
    AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_diario(
  p_ano integer,
  p_mes integer,
  p_area text DEFAULT NULL
)
RETURNS TABLE (dia integer, total integer, pct_eficiencia numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DAY FROM data_criada)::integer AS dia,
    COUNT(*)::integer AS total,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
          / NULLIF(COUNT(*), 0) * 100,
        0
      ),
      2
    ) AS pct_eficiencia
  FROM sp_protocolos
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND EXTRACT(MONTH FROM data_criada)::integer = p_mes
    AND (p_area IS NULL OR area = p_area)
    AND area IS NOT NULL
    AND area NOT IN ('Distressd Deals', 'Operações Legais', 'Tributário')
    AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  GROUP BY 1
  HAVING COUNT(*) > 0
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (usuario text, qtd_inconsistencia integer, pct_do_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT criado_por AS usuario FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area) AND criado_por IS NOT NULL
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
      AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  ), total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT usuario, COUNT(*)::integer, ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2)
  FROM base GROUP BY 1 ORDER BY 2 DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_protocolo_ranking_inconsistencia_grupo(
  p_ano integer,
  p_meses integer[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS TABLE (grupo_cliente text, qtd_inconsistencia integer, pct_do_total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(
        NULLIF(trim(public.receita_grupo_cliente_canonico(cliente)), ''),
        '(sem grupo)'
      ) AS grupo_cliente
    FROM sp_protocolos
    WHERE status_inconsistencia = 'INCONSISTÊNCIA'
      AND EXTRACT(YEAR FROM data_criada)::integer = p_ano
      AND (p_meses IS NULL OR EXTRACT(MONTH FROM data_criada)::integer = ANY (p_meses))
      AND (p_area IS NULL OR area = p_area)
      AND (area IS NULL OR area NOT IN ('Operações Legais', 'Tributário'))
      AND NOT public.eficiencia_onboarding_exclui(cliente, data_criada::date)
  ),
  total AS (SELECT COUNT(*)::numeric AS v FROM base)
  SELECT
    grupo_cliente,
    COUNT(*)::integer AS qtd_inconsistencia,
    ROUND(COALESCE(COUNT(*)::numeric / NULLIF((SELECT v FROM total), 0) * 100, 0), 2) AS pct_do_total
  FROM base
  GROUP BY 1
  ORDER BY qtd_inconsistencia DESC;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_ops_legais_protocolo_mensal(p_ano integer)
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
    SELECT protocolado_em, eficiencia_sla, inconsistencia_controladoria, eficiencia_operacional
    FROM sp_protocolos
    WHERE (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELADO')
      AND protocolado_em IS NOT NULL
      AND EXTRACT(YEAR FROM protocolado_em)::integer = p_ano
      AND NOT public.eficiencia_onboarding_exclui(cliente, protocolado_em::date)
  ),
  sla AS (
    SELECT * FROM base
    WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM'
      AND eficiencia_sla IN ('D1', 'PROTOCOLADO NO FATAL')
  ),
  sla_mes AS (
    SELECT
      EXTRACT(MONTH FROM protocolado_em)::integer AS mes,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE eficiencia_sla = 'D1')::integer AS qtd_d1,
      COUNT(*) FILTER (WHERE eficiencia_sla = 'PROTOCOLADO NO FATAL')::integer AS qtd_protocolado_fatal,
      ROUND(COALESCE(COUNT(*) FILTER (WHERE eficiencia_sla = 'D1')::numeric / NULLIF(COUNT(*), 0) * 100, 0), 2) AS pct_d1
    FROM sla GROUP BY 1
  ),
  efi_mes AS (
    SELECT
      EXTRACT(MONTH FROM protocolado_em)::integer AS mes,
      COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(inconsistencia_controladoria, '')), '') IS NULL)::integer AS sem_inconsistencia,
      COUNT(*)::integer AS total_efi,
      COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) = 'SIM')::integer AS eficiencia_ok,
      COUNT(*) FILTER (WHERE UPPER(TRIM(COALESCE(eficiencia_operacional, ''))) IN ('NÃO', 'NAO'))::integer AS eficiencia_nok
    FROM base GROUP BY 1
  )
  SELECT
    COALESCE(s.mes, e.mes) AS mes,
    COALESCE(s.total, 0) AS total,
    COALESCE(s.qtd_d1, 0) AS qtd_d1,
    COALESCE(s.pct_d1, 0) AS pct_d1,
    COALESCE(s.qtd_protocolado_fatal, 0) AS qtd_protocolado_fatal,
    COALESCE(e.total_efi, 0) AS total_eficiencia,
    COALESCE(e.sem_inconsistencia, 0) AS sem_inconsistencia,
    ROUND(COALESCE(e.sem_inconsistencia::numeric / NULLIF(e.total_efi, 0) * 100, 0), 2) AS pct_sem_inconsistencia,
    COALESCE(e.eficiencia_ok, 0) AS eficiencia_ok,
    COALESCE(e.eficiencia_nok, 0) AS eficiencia_nok,
    ROUND(COALESCE(e.eficiencia_ok::numeric / NULLIF(e.eficiencia_ok + e.eficiencia_nok, 0) * 100, 0), 2) AS pct_eficiencia_operacional
  FROM sla_mes s
  FULL OUTER JOIN efi_mes e ON e.mes = s.mes
  ORDER BY 1;
$$;
