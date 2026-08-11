-- Levantamento v2: multi-grupo + área case-insensitive (funções novas, sem DROP).

CREATE OR REPLACE FUNCTION public.escritorio_levantamento_filtros_opcoes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'grupos',
    COALESCE(
      (
        SELECT jsonb_agg(g ORDER BY g)
        FROM (
          SELECT DISTINCT trim(grupo) AS g FROM sp_publicacoes WHERE NULLIF(trim(grupo), '') IS NOT NULL
          UNION
          SELECT DISTINCT trim(grupo_cliente) FROM timesheets WHERE NULLIF(trim(grupo_cliente), '') IS NOT NULL
          UNION
          SELECT DISTINCT trim(grupo_cliente) FROM processos_completo WHERE NULLIF(trim(grupo_cliente), '') IS NOT NULL
          UNION
          SELECT DISTINCT trim(grupo_cliente) FROM sp_tarefas WHERE NULLIF(trim(grupo_cliente), '') IS NOT NULL
        ) s WHERE g IS NOT NULL
      ),
      '[]'::jsonb
    ),
    'areas',
    COALESCE(
      (
        SELECT jsonb_agg(label ORDER BY label)
        FROM (
          SELECT DISTINCT ON (lower(trim(a)))
            CASE
              WHEN lower(trim(a)) IN ('distressd deals', 'distressed deals') THEN 'Distressed Deals'
              ELSE initcap(lower(trim(a)))
            END AS label
          FROM (
            SELECT area AS a FROM sp_publicacoes WHERE NULLIF(trim(area), '') IS NOT NULL
            UNION ALL SELECT area FROM timesheets WHERE NULLIF(trim(area), '') IS NOT NULL
            UNION ALL SELECT COALESCE(NULLIF(trim(area), ''), NULLIF(trim(departamento), ''))
              FROM processos_completo
              WHERE COALESCE(NULLIF(trim(area), ''), NULLIF(trim(departamento), '')) IS NOT NULL
            UNION ALL SELECT area_equipe FROM sp_agendamento WHERE NULLIF(trim(area_equipe), '') IS NOT NULL
            UNION ALL SELECT COALESCE(NULLIF(trim(area_conclusao), ''), NULLIF(trim(area_processo), ''))
              FROM sp_tarefas
              WHERE COALESCE(NULLIF(trim(area_conclusao), ''), NULLIF(trim(area_processo), '')) IS NOT NULL
          ) raw
          WHERE NULLIF(trim(a), '') IS NOT NULL
          ORDER BY lower(trim(a)), CASE WHEN a = upper(a) THEN 1 ELSE 0 END, length(a) DESC
        ) u
      ),
      '[]'::jsonb
    )
  );
$$;

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
  v_ag_total integer;
  v_tipos jsonb;
  v_proc_por_situacao jsonb;
BEGIN
  IF p_grupos IS NOT NULL AND cardinality(p_grupos) > 0 THEN
    SELECT array_agg(DISTINCT trim(g)) INTO v_grupos
    FROM unnest(p_grupos) AS g WHERE NULLIF(trim(g), '') IS NOT NULL;
  END IF;
  v_area_key := CASE WHEN v_area IS NULL THEN NULL ELSE lower(v_area) END;

  SELECT COUNT(*)::integer INTO v_pub_total
  FROM sp_publicacoes p
  WHERE p.disponibilizado_vistagem IS NOT NULL
    AND (p.disponibilizado_vistagem AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR trim(COALESCE(p.grupo, '')) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(p.area, ''))) = v_area_key);

  SELECT COUNT(*)::integer, COALESCE(SUM(COALESCE(t.total_horas_decimal, t.total_horas, 0)), 0)
  INTO v_ts_apontamentos, v_ts_horas
  FROM timesheets t
  WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR trim(COALESCE(t.grupo_cliente, '')) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(t.area, ''))) = v_area_key);

  SELECT COUNT(*)::integer INTO v_proc_total
  FROM processos_completo pc
  WHERE (v_grupos IS NULL OR trim(COALESCE(pc.grupo_cliente, '')) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''), ''))) = v_area_key);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('situacao', situacao, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb)
  INTO v_proc_por_situacao
  FROM (
    SELECT COALESCE(NULLIF(trim(pc.situacao_processo), ''), 'Sem situação') AS situacao, COUNT(*)::integer AS qtd
    FROM processos_completo pc
    WHERE (v_grupos IS NULL OR trim(COALESCE(pc.grupo_cliente, '')) = ANY (v_grupos))
      AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''), ''))) = v_area_key)
    GROUP BY 1
  ) s;

  SELECT COUNT(DISTINCT a.sp_id)::integer INTO v_ag_total
  FROM sp_agendamento a
  WHERE a.solicitado_em IS NOT NULL AND a.solicitado_em BETWEEN p_data_inicio AND p_data_fim
    AND (v_area_key IS NULL OR lower(trim(COALESCE(a.area_equipe, ''))) = v_area_key);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo_agendamento', tipo_agendamento, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb)
  INTO v_tipos
  FROM (
    SELECT COALESCE(NULLIF(trim(a.tipo_agendamento), ''), 'Sem tipo') AS tipo_agendamento, COUNT(DISTINCT a.sp_id)::integer AS qtd
    FROM sp_agendamento a
    WHERE a.solicitado_em IS NOT NULL AND a.solicitado_em BETWEEN p_data_inicio AND p_data_fim
      AND (v_area_key IS NULL OR lower(trim(COALESCE(a.area_equipe, ''))) = v_area_key)
    GROUP BY 1
  ) t;

  SELECT COUNT(*)::integer INTO v_tar_total
  FROM sp_tarefas tar
  WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR trim(COALESCE(tar.grupo_cliente, '')) = ANY (v_grupos))
    AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''), ''))) = v_area_key);

  RETURN jsonb_build_object(
    'publicacoes_total', v_pub_total,
    'timesheet_apontamentos', v_ts_apontamentos,
    'timesheet_horas', v_ts_horas,
    'processos_total', v_proc_total,
    'processos_por_situacao', v_proc_por_situacao,
    'agendamento_total', v_ag_total,
    'agendamento_por_tipo', v_tipos,
    'tarefas_total', v_tar_total,
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'grupos', to_jsonb(COALESCE(v_grupos, ARRAY[]::text[])),
    'area', v_area
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.escritorio_levantamento_filtros_opcoes() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escritorio_levantamento_resumo_v2(date, date, text[], text) TO anon, authenticated;
