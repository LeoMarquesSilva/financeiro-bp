-- SLA Protocolo: FATAL só após 18:05 BRT (antes 18:00). Recalcula colunas do sync.

CREATE OR REPLACE FUNCTION public.eficiencia_map_fatal_historico(p_adesao text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN trim(coalesce(p_adesao, '')) IN ('Fatal', 'Fatal Quebra') THEN 'FATAL'
    WHEN trim(coalesce(p_adesao, '')) = 'Pendente' THEN 'Pendente'
    WHEN p_adesao IS NULL OR trim(p_adesao) = '' THEN NULL
    ELSE 'D-1'
  END;
$$;

CREATE OR REPLACE FUNCTION public.eficiencia_compute_adesao_apos18(
  p_status text,
  p_data_prazo date,
  p_conclusao_completa timestamptz
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_status text := trim(coalesce(p_status, ''));
  v_dia_prazo date;
  v_dia_conclusao date;
  v_segundos bigint;
  v_corte constant integer := 18 * 3600 + 5 * 60;
BEGIN
  IF v_status = 'Cancelada' THEN
    RETURN 'Cancelado';
  END IF;
  IF v_status = 'Iniciado' THEN
    RETURN 'Iniciado';
  END IF;
  IF v_status = 'Aberta' THEN
    RETURN 'Pendente';
  END IF;
  IF p_data_prazo IS NULL OR p_conclusao_completa IS NULL THEN
    RETURN NULL;
  END IF;

  v_dia_prazo := p_data_prazo;
  v_dia_conclusao := (p_conclusao_completa AT TIME ZONE 'America/Sao_Paulo')::date;

  IF v_dia_conclusao > v_dia_prazo THEN
    RETURN 'Fatal Quebra';
  END IF;
  IF v_dia_conclusao < v_dia_prazo THEN
    RETURN 'D-1';
  END IF;

  v_segundos :=
    EXTRACT(HOUR FROM p_conclusao_completa AT TIME ZONE 'America/Sao_Paulo')::bigint * 3600
    + EXTRACT(MINUTE FROM p_conclusao_completa AT TIME ZONE 'America/Sao_Paulo')::bigint * 60
    + FLOOR(EXTRACT(SECOND FROM p_conclusao_completa AT TIME ZONE 'America/Sao_Paulo'))::bigint;

  IF v_segundos <= v_corte THEN
    RETURN 'D-1';
  END IF;
  RETURN 'Fatal';
END;
$$;

UPDATE public.sp_tarefas_historico h
SET
  adesao_apos18 = sub.adesao,
  fatal_apos18 = public.eficiencia_map_fatal_historico(sub.adesao),
  updated_at = now()
FROM (
  SELECT
    ci,
    public.eficiencia_compute_adesao_apos18(status, data_para_conclusao, conclusao_completa) AS adesao
  FROM public.sp_tarefas_historico
) sub
WHERE h.ci = sub.ci;

COMMENT ON FUNCTION public.eficiencia_compute_adesao_apos18(text, date, timestamptz) IS
  'Adesão após 18 (SLA Protocolo): no dia do prazo, até 18:05:00 BRT = D-1; depois = Fatal. Espelha scripts/sharepoint/transforms.mjs.';

GRANT EXECUTE ON FUNCTION public.eficiencia_map_fatal_historico(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_compute_adesao_apos18(text, date, timestamptz) TO anon, authenticated;
