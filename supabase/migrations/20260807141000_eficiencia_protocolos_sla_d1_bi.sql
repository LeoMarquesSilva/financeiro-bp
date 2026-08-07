-- BASE-PROTOCOLOS (BI Ops Legais): coluna EFICIÊNCIA calculada no Power Query
-- a partir de DATA DO FATAL / Criado / PROTOCOLADO EM.
-- % D1 = COUNTROWS(EFICIÊNCIA = 'D1') / COUNTROWS(BASE-PROTOCOLOS)  (STATUS <> Cancelado)

ALTER TABLE public.sp_protocolos
  ADD COLUMN IF NOT EXISTS data_do_fatal TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eficiencia_sla TEXT;

COMMENT ON COLUMN public.sp_protocolos.data_do_fatal IS
  'SharePoint DATA DO FATAL — prazo fatal do protocolo (BI Ops Legais).';
COMMENT ON COLUMN public.sp_protocolos.eficiencia_sla IS
  'Coluna EFICIÊNCIA do BI (Power Query): D1 | ENVIADO NO FATAL | PROTOCOLADO NO FATAL | Dados Incompletos. Calculada no sync.';

CREATE INDEX IF NOT EXISTS sp_protocolos_eficiencia_sla_idx
  ON public.sp_protocolos (eficiencia_sla);

-- Recomputa eficiencia_sla em SQL (mesma ordem do Power Query; fuso America/Sao_Paulo).
CREATE OR REPLACE FUNCTION public.eficiencia_recompute_protocolo_sla()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.sp_protocolos p
  SET
    eficiencia_sla = CASE
      WHEN p.data_do_fatal IS NULL OR p.protocolado_em IS NULL OR p.criado IS NULL THEN
        'Dados Incompletos'
      WHEN (
        (p.criado AT TIME ZONE 'America/Sao_Paulo')::date
          = ((p.data_do_fatal AT TIME ZONE 'America/Sao_Paulo')::date - 1)
        AND EXTRACT(HOUR FROM (p.criado AT TIME ZONE 'America/Sao_Paulo')) >= 18
      ) THEN 'ENVIADO NO FATAL'
      WHEN p.criado >= p.data_do_fatal THEN 'ENVIADO NO FATAL'
      WHEN p.data_do_fatal
        <= ((p.protocolado_em::timestamp) AT TIME ZONE 'America/Sao_Paulo')
        THEN 'PROTOCOLADO NO FATAL'
      WHEN p.criado < p.data_do_fatal
        AND ((p.protocolado_em::timestamp) AT TIME ZONE 'America/Sao_Paulo') < p.data_do_fatal
        THEN 'D1'
      ELSE 'D1'
    END,
    updated_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

DROP FUNCTION IF EXISTS public.eficiencia_ops_legais_protocolo_mensal(integer);

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
    EXTRACT(MONTH FROM data_criada)::integer AS mes,
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
    COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::integer AS sem_inconsistencia,
    ROUND(
      COALESCE(
        COUNT(*) FILTER (WHERE status_inconsistencia = 'EFICIÊNCIA')::numeric
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
  WHERE EXTRACT(YEAR FROM data_criada)::integer = p_ano
    AND area = 'Operações Legais'
    AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELADO')
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) IS
  'RG Ops Legais: % D1 = EFICIÊNCIA(sla)=D1 / total (BI Power Query). Exclui STATUS Cancelado.';

GRANT EXECUTE ON FUNCTION public.eficiencia_recompute_protocolo_sla() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_ops_legais_protocolo_mensal(integer) TO anon, authenticated;
