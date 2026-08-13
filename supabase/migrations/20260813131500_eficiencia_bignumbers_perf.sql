-- Big Numbers: índices + RPC por intervalo de datas (evita EXTRACT e timeout da API).

CREATE INDEX IF NOT EXISTS sp_tarefas_historico_etiqueta_conclusao_idx
  ON public.sp_tarefas_historico (etiqueta_tarefa, data_conclusao);

CREATE INDEX IF NOT EXISTS sp_tarefas_historico_data_conclusao_idx
  ON public.sp_tarefas_historico (data_conclusao);

CREATE OR REPLACE FUNCTION public.eficiencia_apresentacao_bignumbers(
  p_ano integer,
  p_meses integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  v_meses integer[];
  v_mes_min integer;
  v_mes_max integer;
  v_ano_ant integer := p_ano - 1;
  v_ini date;
  v_fim date;
  v_ini_ant date;
  v_fim_ant date;
  v_kpi jsonb;
  v_top jsonb;
BEGIN
  IF p_meses IS NULL OR cardinality(p_meses) = 0 THEN
    v_meses := ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  ELSE
    SELECT array_agg(DISTINCT m ORDER BY m)
    INTO v_meses
    FROM unnest(p_meses) AS m
    WHERE m BETWEEN 1 AND 12;
  END IF;

  IF v_meses IS NULL OR cardinality(v_meses) = 0 THEN
    RETURN jsonb_build_object('error', 'meses inválidos');
  END IF;

  -- Intervalo contínuo do menor ao maior mês selecionado (uso típico Jan–Jun / ano).
  v_mes_min := v_meses[1];
  v_mes_max := v_meses[cardinality(v_meses)];
  v_ini := make_date(p_ano, v_mes_min, 1);
  v_fim := (make_date(p_ano, v_mes_max, 1) + INTERVAL '1 month')::date;
  v_ini_ant := make_date(v_ano_ant, v_mes_min, 1);
  v_fim_ant := (make_date(v_ano_ant, v_mes_max, 1) + INTERVAL '1 month')::date;

  SELECT jsonb_build_object(
    'timesheet', jsonb_build_object(
      'atual', (SELECT COALESCE(SUM(COALESCE(total_horas_decimal, total_horas, 0)), 0)::numeric
                FROM timesheets WHERE data >= v_ini AND data < v_fim),
      'anterior', (SELECT COALESCE(SUM(COALESCE(total_horas_decimal, total_horas, 0)), 0)::numeric
                   FROM timesheets WHERE data >= v_ini_ant AND data < v_fim_ant)
    ),
    'pastas_ativas', jsonb_build_object(
      'atual', (SELECT COUNT(*)::integer FROM processos_completo pc
                WHERE COALESCE(pc.data_cadastro, DATE '1900-01-01') < v_fim
                  AND (pc.data_encerramento IS NULL OR pc.data_encerramento >= v_fim)
                  AND pc.situacao_processo = 'Ativo'),
      'anterior', (SELECT COUNT(*)::integer FROM processos_completo pc
                   WHERE COALESCE(pc.data_cadastro, DATE '1900-01-01') < v_fim_ant
                     AND (pc.data_encerramento IS NULL OR pc.data_encerramento >= v_fim_ant)
                     AND pc.situacao_processo = 'Ativo')
    ),
    'publicacoes', jsonb_build_object(
      'atual', (SELECT COUNT(*)::integer FROM sp_publicacoes
                WHERE data_recebimento_kurier >= v_ini AND data_recebimento_kurier < v_fim),
      'anterior', (SELECT COUNT(*)::integer FROM sp_publicacoes
                   WHERE data_recebimento_kurier >= v_ini_ant AND data_recebimento_kurier < v_fim_ant)
    ),
    'protocolos', jsonb_build_object(
      'atual', (SELECT COUNT(*)::integer FROM sp_tarefas_historico
                WHERE etiqueta_tarefa = 'PROTOCOLO'
                  AND data_conclusao >= v_ini AND data_conclusao < v_fim),
      'anterior', (SELECT COUNT(*)::integer FROM sp_tarefas_historico
                   WHERE etiqueta_tarefa = 'PROTOCOLO'
                     AND data_conclusao >= v_ini_ant AND data_conclusao < v_fim_ant)
    ),
    'providencias', jsonb_build_object(
      'atual', (SELECT COUNT(*)::integer FROM sp_tarefas_historico
                WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
                  AND data_conclusao >= v_ini AND data_conclusao < v_fim),
      'anterior', (SELECT COUNT(*)::integer FROM sp_tarefas_historico
                   WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
                     AND data_conclusao >= v_ini_ant AND data_conclusao < v_fim_ant)
    ),
    'receita_bruta', jsonb_build_object(
      'atual', (SELECT COALESCE(SUM(recebido), 0)::numeric
                FROM receita_totais_mensais(p_ano) r
                WHERE r.mes BETWEEN v_mes_min AND v_mes_max),
      'anterior', (SELECT COALESCE(SUM(recebido), 0)::numeric
                   FROM receita_totais_mensais(v_ano_ant) r
                   WHERE r.mes BETWEEN v_mes_min AND v_mes_max)
    )
  )
  INTO v_kpi;

  SELECT jsonb_build_object(
    'timesheet', jsonb_build_object(
      'atual', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
                 ROUND(SUM(COALESCE(total_horas_decimal, total_horas, 0))::numeric, 4) AS valor
          FROM timesheets
          WHERE data >= v_ini AND data < v_fim
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb),
      'anterior', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
                 ROUND(SUM(COALESCE(total_horas_decimal, total_horas, 0))::numeric, 4) AS valor
          FROM timesheets
          WHERE data >= v_ini_ant AND data < v_fim_ant
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb)
    ),
    'publicacoes', jsonb_build_object(
      'atual', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo), ''), '(sem grupo)') AS grupo,
                 COUNT(*)::integer AS valor
          FROM sp_publicacoes
          WHERE data_recebimento_kurier >= v_ini AND data_recebimento_kurier < v_fim
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb),
      'anterior', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo), ''), '(sem grupo)') AS grupo,
                 COUNT(*)::integer AS valor
          FROM sp_publicacoes
          WHERE data_recebimento_kurier >= v_ini_ant AND data_recebimento_kurier < v_fim_ant
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb)
    ),
    'protocolos', jsonb_build_object(
      'atual', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
                 COUNT(*)::integer AS valor
          FROM sp_tarefas_historico
          WHERE etiqueta_tarefa = 'PROTOCOLO'
            AND data_conclusao >= v_ini AND data_conclusao < v_fim
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb),
      'anterior', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
                 COUNT(*)::integer AS valor
          FROM sp_tarefas_historico
          WHERE etiqueta_tarefa = 'PROTOCOLO'
            AND data_conclusao >= v_ini_ant AND data_conclusao < v_fim_ant
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb)
    ),
    'providencias', jsonb_build_object(
      'atual', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
                 COUNT(*)::integer AS valor
          FROM sp_tarefas_historico
          WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
            AND data_conclusao >= v_ini AND data_conclusao < v_fim
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb),
      'anterior', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC)
        FROM (
          SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
                 COUNT(*)::integer AS valor
          FROM sp_tarefas_historico
          WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
            AND data_conclusao >= v_ini_ant AND data_conclusao < v_fim_ant
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Área%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Area%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operações%'
            AND COALESCE(grupo_cliente, '') NOT ILIKE 'Grupo Operacoes%'
          GROUP BY 1
          ORDER BY 2 DESC
          LIMIT 5
        ) s
      ), '[]'::jsonb)
    )
  )
  INTO v_top;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'ano_anterior', v_ano_ant,
    'meses', to_jsonb(v_meses),
    'inicio', v_ini,
    'fim_exclusivo', v_fim,
    'kpis', v_kpi,
    'top5', v_top
  );
END;
$$;
