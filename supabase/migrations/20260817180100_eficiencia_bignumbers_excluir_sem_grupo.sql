-- Big Numbers TOP 5: não ranquear balde "(sem grupo)" (timesheet/tarefas/publicações sem grupo_cliente).

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

  v_mes_min := v_meses[1];
  v_mes_max := v_meses[cardinality(v_meses)];
  v_ini := make_date(p_ano, v_mes_min, 1);
  v_fim := (make_date(p_ano, v_mes_max, 1) + INTERVAL '1 month')::date;
  v_ini_ant := make_date(v_ano_ant, v_mes_min, 1);
  v_fim_ant := (make_date(v_ano_ant, v_mes_max, 1) + INTERVAL '1 month')::date;

  RETURN (
    WITH
    ts AS (
      SELECT
        COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
        SUM(COALESCE(total_horas_decimal, total_horas, 0))
          FILTER (WHERE data >= v_ini AND data < v_fim) AS atual,
        SUM(COALESCE(total_horas_decimal, total_horas, 0))
          FILTER (WHERE data >= v_ini_ant AND data < v_fim_ant) AS anterior
      FROM timesheets
      WHERE (data >= v_ini_ant AND data < v_fim_ant)
         OR (data >= v_ini AND data < v_fim)
      GROUP BY 1
    ),
    ts_tot AS (
      SELECT
        COALESCE(SUM(atual), 0)::numeric AS atual,
        COALESCE(SUM(anterior), 0)::numeric AS anterior
      FROM ts
    ),
    ts_top_atual AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', ROUND(atual::numeric, 4)) ORDER BY atual DESC) AS j
      FROM (
        SELECT grupo, atual FROM ts
        WHERE atual > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY atual DESC
        LIMIT 5
      ) s
    ),
    ts_top_ant AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', ROUND(anterior::numeric, 4)) ORDER BY anterior DESC) AS j
      FROM (
        SELECT grupo, anterior FROM ts
        WHERE anterior > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY anterior DESC
        LIMIT 5
      ) s
    ),
    pub AS (
      SELECT
        COALESCE(NULLIF(trim(grupo), ''), '(sem grupo)') AS grupo,
        COUNT(*) FILTER (WHERE data_recebimento_kurier >= v_ini AND data_recebimento_kurier < v_fim) AS atual,
        COUNT(*) FILTER (WHERE data_recebimento_kurier >= v_ini_ant AND data_recebimento_kurier < v_fim_ant) AS anterior
      FROM sp_publicacoes
      WHERE (data_recebimento_kurier >= v_ini_ant AND data_recebimento_kurier < v_fim_ant)
         OR (data_recebimento_kurier >= v_ini AND data_recebimento_kurier < v_fim)
      GROUP BY 1
    ),
    pub_tot AS (
      SELECT COALESCE(SUM(atual), 0)::integer AS atual, COALESCE(SUM(anterior), 0)::integer AS anterior
      FROM pub
    ),
    pub_top_atual AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', atual) ORDER BY atual DESC) AS j
      FROM (
        SELECT grupo, atual FROM pub
        WHERE atual > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY atual DESC LIMIT 5
      ) s
    ),
    pub_top_ant AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', anterior) ORDER BY anterior DESC) AS j
      FROM (
        SELECT grupo, anterior FROM pub
        WHERE anterior > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY anterior DESC LIMIT 5
      ) s
    ),
    tar AS (
      SELECT
        etiqueta_tarefa AS etiqueta,
        COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
        COUNT(*) FILTER (WHERE data_conclusao >= v_ini AND data_conclusao < v_fim) AS atual,
        COUNT(*) FILTER (WHERE data_conclusao >= v_ini_ant AND data_conclusao < v_fim_ant) AS anterior
      FROM sp_tarefas_historico
      WHERE etiqueta_tarefa IN ('PROTOCOLO', 'PROVIDÊNCIA')
        AND (
          (data_conclusao >= v_ini_ant AND data_conclusao < v_fim_ant)
          OR (data_conclusao >= v_ini AND data_conclusao < v_fim)
        )
      GROUP BY 1, 2
    ),
    prot_tot AS (
      SELECT COALESCE(SUM(atual), 0)::integer AS atual, COALESCE(SUM(anterior), 0)::integer AS anterior
      FROM tar WHERE etiqueta = 'PROTOCOLO'
    ),
    prov_tot AS (
      SELECT COALESCE(SUM(atual), 0)::integer AS atual, COALESCE(SUM(anterior), 0)::integer AS anterior
      FROM tar WHERE etiqueta = 'PROVIDÊNCIA'
    ),
    prot_top_atual AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', atual) ORDER BY atual DESC) AS j
      FROM (
        SELECT grupo, atual FROM tar
        WHERE etiqueta = 'PROTOCOLO' AND atual > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY atual DESC LIMIT 5
      ) s
    ),
    prot_top_ant AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', anterior) ORDER BY anterior DESC) AS j
      FROM (
        SELECT grupo, anterior FROM tar
        WHERE etiqueta = 'PROTOCOLO' AND anterior > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY anterior DESC LIMIT 5
      ) s
    ),
    prov_top_atual AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', atual) ORDER BY atual DESC) AS j
      FROM (
        SELECT grupo, atual FROM tar
        WHERE etiqueta = 'PROVIDÊNCIA' AND atual > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY atual DESC LIMIT 5
      ) s
    ),
    prov_top_ant AS (
      SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', anterior) ORDER BY anterior DESC) AS j
      FROM (
        SELECT grupo, anterior FROM tar
        WHERE etiqueta = 'PROVIDÊNCIA' AND anterior > 0
          AND grupo <> '(sem grupo)'
          AND grupo NOT ILIKE 'Grupo Área%'
          AND grupo NOT ILIKE 'Grupo Area%'
          AND grupo NOT ILIKE 'Grupo Operações%'
          AND grupo NOT ILIKE 'Grupo Operacoes%'
        ORDER BY anterior DESC LIMIT 5
      ) s
    ),
    pastas AS (
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(data_cadastro, DATE '1900-01-01') < v_fim
            AND (data_encerramento IS NULL OR data_encerramento >= v_fim)
        )::integer AS atual,
        COUNT(*) FILTER (
          WHERE COALESCE(data_cadastro, DATE '1900-01-01') < v_fim_ant
            AND (data_encerramento IS NULL OR data_encerramento >= v_fim_ant)
        )::integer AS anterior
      FROM processos_completo
      WHERE situacao_processo = 'Ativo'
    ),
    rec AS (
      SELECT
        (SELECT COALESCE(SUM(recebido), 0)::numeric
         FROM receita_totais_mensais(p_ano) r WHERE r.mes BETWEEN v_mes_min AND v_mes_max) AS atual,
        (SELECT COALESCE(SUM(recebido), 0)::numeric
         FROM receita_totais_mensais(v_ano_ant) r WHERE r.mes BETWEEN v_mes_min AND v_mes_max) AS anterior
    )
    SELECT jsonb_build_object(
      'ano', p_ano,
      'ano_anterior', v_ano_ant,
      'meses', to_jsonb(v_meses),
      'inicio', v_ini,
      'fim_exclusivo', v_fim,
      'kpis', jsonb_build_object(
        'timesheet', (SELECT jsonb_build_object('atual', atual, 'anterior', anterior) FROM ts_tot),
        'pastas_ativas', (SELECT jsonb_build_object('atual', atual, 'anterior', anterior) FROM pastas),
        'publicacoes', (SELECT jsonb_build_object('atual', atual, 'anterior', anterior) FROM pub_tot),
        'protocolos', (SELECT jsonb_build_object('atual', atual, 'anterior', anterior) FROM prot_tot),
        'providencias', (SELECT jsonb_build_object('atual', atual, 'anterior', anterior) FROM prov_tot),
        'receita_bruta', (SELECT jsonb_build_object('atual', atual, 'anterior', anterior) FROM rec)
      ),
      'top5', jsonb_build_object(
        'timesheet', jsonb_build_object(
          'atual', COALESCE((SELECT j FROM ts_top_atual), '[]'::jsonb),
          'anterior', COALESCE((SELECT j FROM ts_top_ant), '[]'::jsonb)
        ),
        'publicacoes', jsonb_build_object(
          'atual', COALESCE((SELECT j FROM pub_top_atual), '[]'::jsonb),
          'anterior', COALESCE((SELECT j FROM pub_top_ant), '[]'::jsonb)
        ),
        'protocolos', jsonb_build_object(
          'atual', COALESCE((SELECT j FROM prot_top_atual), '[]'::jsonb),
          'anterior', COALESCE((SELECT j FROM prot_top_ant), '[]'::jsonb)
        ),
        'providencias', jsonb_build_object(
          'atual', COALESCE((SELECT j FROM prov_top_atual), '[]'::jsonb),
          'anterior', COALESCE((SELECT j FROM prov_top_ant), '[]'::jsonb)
        )
      )
    )
  );
END;
$$;
