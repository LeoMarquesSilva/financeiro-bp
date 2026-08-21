-- Escritório levantamento: grupos por período (rápido) + remove agendamento do resumo.

CREATE OR REPLACE FUNCTION public.escritorio_levantamento_filtros_opcoes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
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
            UNION ALL SELECT COALESCE(NULLIF(trim(area_conclusao), ''), NULLIF(trim(area_processo), ''))
              FROM sp_tarefas
              WHERE COALESCE(NULLIF(trim(area_conclusao), ''), NULLIF(trim(area_processo), '')) IS NOT NULL
          ) raw
          WHERE NULLIF(trim(a), '') IS NOT NULL
          ORDER BY lower(trim(a)), CASE WHEN a = upper(a) THEN 1 ELSE 0 END, length(a) DESC
        ) u
      ),
      '[]'::jsonb
    ),
    'timesheet_data_max',
    (SELECT max(data)::text FROM timesheets WHERE data IS NOT NULL),
    'timesheet_data_min',
    (SELECT min(data)::text FROM timesheets WHERE data IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.escritorio_levantamento_grupos_periodo(
  p_data_inicio date,
  p_data_fim date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(label ORDER BY label)
      FROM (
        SELECT DISTINCT ON (lower(trim(g)))
          trim(g) AS label
        FROM (
          SELECT p.grupo AS g
          FROM sp_publicacoes p
          WHERE p.disponibilizado_vistagem IS NOT NULL
            AND (p.disponibilizado_vistagem AT TIME ZONE 'America/Sao_Paulo')::date
              BETWEEN p_data_inicio AND p_data_fim
            AND NULLIF(trim(p.grupo), '') IS NOT NULL
          UNION ALL
          SELECT t.grupo_cliente AS g
          FROM timesheets t
          WHERE t.data IS NOT NULL
            AND t.data BETWEEN p_data_inicio AND p_data_fim
            AND NULLIF(trim(t.grupo_cliente), '') IS NOT NULL
          UNION ALL
          SELECT tar.grupo_cliente AS g
          FROM sp_tarefas tar
          WHERE tar.data_conclusao IS NOT NULL
            AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
            AND NULLIF(trim(tar.grupo_cliente), '') IS NOT NULL
          UNION ALL
          SELECT pc.grupo_cliente AS g
          FROM processos_completo pc
          WHERE NULLIF(trim(pc.grupo_cliente), '') IS NOT NULL
        ) raw
        WHERE NULLIF(trim(g), '') IS NOT NULL
        ORDER BY lower(trim(g)),
          CASE WHEN trim(g) = upper(trim(g)) THEN 1 ELSE 0 END,
          length(trim(g)) DESC
      ) u
    ),
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public.escritorio_levantamento_grupos_periodo(date, date) IS
  'Grupos cliente distintos no período (pub/timesheet/tarefas) + estoque de processos. Usado no filtro do levantamento Escritório.';

GRANT EXECUTE ON FUNCTION public.escritorio_levantamento_grupos_periodo(date, date)
  TO anon, authenticated;

-- Resumo sem sp_agendamento (exclusivo controladoria / Ops Legais).
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

  SELECT COUNT(*)::integer, COALESCE(SUM(COALESCE(t.total_horas_decimal, t.total_horas, 0)), 0)
  INTO v_ts_apontamentos, v_ts_horas
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

COMMENT ON FUNCTION public.escritorio_levantamento_filtros_opcoes() IS
  'Áreas e limites de timesheet para filtros do levantamento Escritório (grupos vêm de escritorio_levantamento_grupos_periodo).';

COMMENT ON FUNCTION public.escritorio_levantamento_resumo_v2(date, date, text[], text) IS
  'KPIs do levantamento Escritório: pub, timesheet, processos (estoque), tarefas VIOS — sem agendamento SharePoint.';
