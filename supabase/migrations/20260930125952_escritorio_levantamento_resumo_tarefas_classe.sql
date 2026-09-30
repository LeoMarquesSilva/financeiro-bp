CREATE OR REPLACE FUNCTION public.escritorio_levantamento_resumo_v2(
  p_data_inicio date,
  p_data_fim date,
  p_grupos text[] DEFAULT NULL::text[],
  p_area text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_grupos text[] := NULL;
  v_area text := NULLIF(trim(COALESCE(p_area, '')), '');
  v_pub_total integer;
  v_ts_apontamentos integer;
  v_ts_horas numeric;
  v_proc_total integer;
  v_tar_total integer;
  v_proc_por_situacao jsonb;
  v_proc_por_tipo jsonb;
  v_proc_por_departamento jsonb;
  v_tar_prazos integer;
  v_tar_providencias integer;
BEGIN
  IF p_grupos IS NOT NULL AND cardinality(p_grupos) > 0 THEN
    SELECT array_agg(DISTINCT lower(trim(g))) INTO v_grupos
    FROM unnest(p_grupos) AS g WHERE NULLIF(trim(g), '') IS NOT NULL;
  END IF;

  SELECT COUNT(*)::integer INTO v_pub_total
  FROM sp_publicacoes p
  WHERE p.criado IS NOT NULL
    AND public.escritorio_levantamento_pub_data_ref(p.criado) BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
    AND public.escritorio_levantamento_area_match(v_area, p.area);

  SELECT COUNT(*)::integer INTO v_ts_apontamentos
  FROM timesheets t
  WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
    AND public.escritorio_levantamento_area_match(v_area, t.area);

  SELECT COALESCE(SUM(
    public.escritorio_timesheet_minutos_linha(
      COALESCE(t.total_horas_decimal, t.total_horas, 0)::numeric
    )
  ), 0)::numeric / 60.0
  INTO v_ts_horas
  FROM timesheets t
  WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
    AND public.escritorio_levantamento_area_match(v_area, t.area);

  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(pc.situacao_processo), ''), 'Sem situação') AS situacao,
      COALESCE(NULLIF(trim(pc.departamento), ''), 'Sem departamento') AS departamento,
      public.escritorio_processo_tipo_vinculo(pc.vinculo, pc.acao, pc.etiquetas) AS tipo
    FROM processos_completo pc
    WHERE (v_grupos IS NULL OR lower(trim(COALESCE(pc.grupo_cliente, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(
        v_area,
        COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''))
      )
  ),
  por_situacao AS (
    SELECT situacao,
      COUNT(*)::integer AS qtd,
      COUNT(*) FILTER (WHERE tipo = 'Principal')::integer AS principal,
      COUNT(*) FILTER (WHERE tipo = 'Recurso')::integer AS recurso,
      COUNT(*) FILTER (WHERE tipo = 'Incidente')::integer AS incidente,
      COUNT(*) FILTER (WHERE tipo NOT IN ('Principal', 'Recurso', 'Incidente'))::integer AS nao_classificado
    FROM base GROUP BY situacao
  ),
  por_tipo AS (
    SELECT tipo, COUNT(*)::integer AS qtd,
      CASE tipo WHEN 'Principal' THEN 1 WHEN 'Recurso' THEN 2 WHEN 'Incidente' THEN 3 ELSE 4 END AS ordem
    FROM base GROUP BY tipo
  ),
  por_departamento AS (
    SELECT departamento,
      COUNT(*)::integer AS qtd,
      COUNT(*) FILTER (WHERE tipo = 'Principal')::integer AS principal,
      COUNT(*) FILTER (WHERE tipo = 'Recurso')::integer AS recurso,
      COUNT(*) FILTER (WHERE tipo = 'Incidente')::integer AS incidente,
      COUNT(*) FILTER (WHERE tipo NOT IN ('Principal', 'Recurso', 'Incidente'))::integer AS nao_classificado
    FROM base GROUP BY departamento
  )
  SELECT
    (SELECT COUNT(*)::integer FROM base),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'situacao', situacao, 'qtd', qtd,
      'principal', principal, 'recurso', recurso, 'incidente', incidente,
      'nao_classificado', nao_classificado
    ) ORDER BY qtd DESC), '[]'::jsonb) FROM por_situacao),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo', tipo, 'qtd', qtd) ORDER BY ordem, qtd DESC), '[]'::jsonb)
     FROM por_tipo),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'departamento', departamento, 'qtd', qtd,
      'principal', principal, 'recurso', recurso, 'incidente', incidente,
      'nao_classificado', nao_classificado
    ) ORDER BY qtd DESC), '[]'::jsonb) FROM por_departamento)
  INTO v_proc_total, v_proc_por_situacao, v_proc_por_tipo, v_proc_por_departamento;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE classe = 'Prazo')::integer,
    COUNT(*) FILTER (WHERE classe = 'Providência')::integer
  INTO v_tar_total, v_tar_prazos, v_tar_providencias
  FROM (
    SELECT public.escritorio_tarefa_classe(tar.etiquetas_tarefa, tar.tarefa) AS classe
    FROM sp_tarefas tar
    WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(
        v_area,
        COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''))
      )
  ) classificadas
  WHERE classe IS NOT NULL;

  RETURN jsonb_build_object(
    'publicacoes_total', v_pub_total,
    'timesheet_apontamentos', v_ts_apontamentos,
    'timesheet_horas', v_ts_horas,
    'processos_total', v_proc_total,
    'processos_por_situacao', v_proc_por_situacao,
    'processos_por_tipo', v_proc_por_tipo,
    'processos_por_departamento', v_proc_por_departamento,
    'agendamento_total', 0,
    'agendamento_por_tipo', '[]'::jsonb,
    'tarefas_total', v_tar_total,
    'tarefas_prazos', v_tar_prazos,
    'tarefas_providencias', v_tar_providencias,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'grupos', to_jsonb(COALESCE(p_grupos, ARRAY[]::text[])),
    'area', v_area
  );
END;
$function$;
