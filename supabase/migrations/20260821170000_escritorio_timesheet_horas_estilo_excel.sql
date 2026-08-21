-- Timesheet no levantamento: soma minutos arredondados por linha (igual Excel/BI).

CREATE OR REPLACE FUNCTION public.escritorio_timesheet_minutos_linha(p_horas numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_horas IS NULL OR p_horas <= 0 THEN 0
    ELSE (
      FLOOR(p_horas)::integer * 60
      + ROUND((p_horas - FLOOR(p_horas)) * 60)::integer
    )
  END;
$$;

COMMENT ON FUNCTION public.escritorio_timesheet_minutos_linha(numeric) IS
  'Minutos de um apontamento com arredondamento por linha (floor h + round fração), alinhado ao Excel.';

-- Recria resumo_v2 apenas alterando o cálculo de timesheet_horas.
CREATE OR REPLACE FUNCTION public.escritorio_levantamento_resumo_v2(
  p_data_inicio date,
  p_data_fim date,
  p_grupos text[] DEFAULT NULL,
  p_area text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupos text[] := NULL;
  v_area text := NULLIF(trim(COALESCE(p_area, '')), '');
  v_area_key text;
  v_pub_total integer;
  v_ts_apontamentos integer;
  v_ts_horas numeric;
  v_proc_total integer;
  v_tar_total integer;
  v_proc_por_situacao jsonb;
BEGIN
  IF p_grupos IS NOT NULL AND cardinality(p_grupos) > 0 THEN
    SELECT array_agg(DISTINCT lower(trim(g))) INTO v_grupos
    FROM unnest(p_grupos) AS g WHERE NULLIF(trim(g), '') IS NOT NULL;
  END IF;
  v_area_key := CASE WHEN v_area IS NULL THEN NULL ELSE lower(v_area) END;

  SELECT COUNT(*)::integer INTO v_pub_total
  FROM sp_publicacoes p
  WHERE p.disponibilizado_vistagem IS NOT NULL
    AND (p.disponibilizado_vistagem AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(p.area, ''))) = v_area_key);

  SELECT COUNT(*)::integer INTO v_ts_apontamentos
  FROM timesheets t
  WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(t.area, ''))) = v_area_key);

  SELECT COALESCE(SUM(
    public.escritorio_timesheet_minutos_linha(
      COALESCE(t.total_horas_decimal, t.total_horas, 0)::numeric
    )
  ), 0)::numeric / 60.0
  INTO v_ts_horas
  FROM timesheets t
  WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(t.area, ''))) = v_area_key);

  SELECT COUNT(*)::integer INTO v_proc_total
  FROM processos_completo pc
  WHERE (v_grupos IS NULL OR lower(trim(COALESCE(pc.grupo_cliente, ''))) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''), ''))) = v_area_key);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('situacao', situacao, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb)
  INTO v_proc_por_situacao
  FROM (
    SELECT COALESCE(NULLIF(trim(pc.situacao_processo), ''), 'Sem situação') AS situacao, COUNT(*)::integer AS qtd
    FROM processos_completo pc
    WHERE (v_grupos IS NULL OR lower(trim(COALESCE(pc.grupo_cliente, ''))) = ANY (v_grupos))
      AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''), ''))) = v_area_key)
    GROUP BY 1
  ) s;

  SELECT COUNT(*)::integer INTO v_tar_total
  FROM sp_tarefas tar
  WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''), ''))) = v_area_key);

  RETURN jsonb_build_object(
    'publicacoes_total', v_pub_total,
    'timesheet_apontamentos', v_ts_apontamentos,
    'timesheet_horas', v_ts_horas,
    'processos_total', v_proc_total,
    'processos_por_situacao', v_proc_por_situacao,
    'agendamento_total', 0,
    'agendamento_por_tipo', '[]'::jsonb,
    'tarefas_total', v_tar_total,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'grupos', to_jsonb(COALESCE(p_grupos, ARRAY[]::text[])),
    'area', v_area
  );
END;
$$;

COMMENT ON FUNCTION public.escritorio_levantamento_resumo_v2(date, date, text[], text) IS
  'KPIs levantamento Escritório. Timesheet: soma de minutos arredondados por apontamento (estilo Excel).';
