-- Apresentação Jurídico — Big Numbers Operação (totais YoY + TOP 5 por grupo).
-- Período: mesmos meses em p_ano e p_ano-1.
-- Pastas Ativas: estoque no fim do último mês selecionado
--   (cadastrado antes do fim, não encerrado até o fim, situacao_processo = Ativo).

CREATE OR REPLACE FUNCTION public.eficiencia_apresentacao_bignumbers(
  p_ano integer,
  p_meses integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meses integer[];
  v_mes_max integer;
  v_ano_ant integer := p_ano - 1;
  v_fim date;
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

  v_mes_max := v_meses[cardinality(v_meses)];
  v_fim := (make_date(p_ano, v_mes_max, 1) + INTERVAL '1 month')::date;
  v_fim_ant := (make_date(v_ano_ant, v_mes_max, 1) + INTERVAL '1 month')::date;

  WITH
  ts_atual AS (
    SELECT COALESCE(SUM(COALESCE(total_horas_decimal, total_horas, 0)), 0)::numeric AS v
    FROM timesheets
    WHERE data IS NOT NULL
      AND EXTRACT(YEAR FROM data)::integer = p_ano
      AND EXTRACT(MONTH FROM data)::integer = ANY (v_meses)
  ),
  ts_ant AS (
    SELECT COALESCE(SUM(COALESCE(total_horas_decimal, total_horas, 0)), 0)::numeric AS v
    FROM timesheets
    WHERE data IS NOT NULL
      AND EXTRACT(YEAR FROM data)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data)::integer = ANY (v_meses)
  ),
  pastas_atual AS (
    SELECT COUNT(*)::integer AS v
    FROM processos_completo pc
    WHERE COALESCE(pc.data_cadastro, DATE '1900-01-01') < v_fim
      AND (pc.data_encerramento IS NULL OR pc.data_encerramento >= v_fim)
      AND COALESCE(pc.situacao_processo, '') = 'Ativo'
  ),
  pastas_ant AS (
    SELECT COUNT(*)::integer AS v
    FROM processos_completo pc
    WHERE COALESCE(pc.data_cadastro, DATE '1900-01-01') < v_fim_ant
      AND (pc.data_encerramento IS NULL OR pc.data_encerramento >= v_fim_ant)
      AND COALESCE(pc.situacao_processo, '') = 'Ativo'
  ),
  pub_atual AS (
    SELECT COUNT(*)::integer AS v
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND EXTRACT(YEAR FROM data_recebimento_kurier)::integer = p_ano
      AND EXTRACT(MONTH FROM data_recebimento_kurier)::integer = ANY (v_meses)
  ),
  pub_ant AS (
    SELECT COUNT(*)::integer AS v
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND EXTRACT(YEAR FROM data_recebimento_kurier)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data_recebimento_kurier)::integer = ANY (v_meses)
  ),
  prot_atual AS (
    SELECT COUNT(*)::integer AS v
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROTOCOLO'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
  ),
  prot_ant AS (
    SELECT COUNT(*)::integer AS v
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROTOCOLO'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
  ),
  prov_atual AS (
    SELECT COUNT(*)::integer AS v
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
  ),
  prov_ant AS (
    SELECT COUNT(*)::integer AS v
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
  ),
  rec_atual AS (
    SELECT COALESCE(SUM(recebido), 0)::numeric AS v
    FROM receita_totais_mensais(p_ano) r
    WHERE r.mes = ANY (v_meses)
  ),
  rec_ant AS (
    SELECT COALESCE(SUM(recebido), 0)::numeric AS v
    FROM receita_totais_mensais(v_ano_ant) r
    WHERE r.mes = ANY (v_meses)
  )
  SELECT jsonb_build_object(
    'timesheet', jsonb_build_object('atual', (SELECT v FROM ts_atual), 'anterior', (SELECT v FROM ts_ant)),
    'pastas_ativas', jsonb_build_object('atual', (SELECT v FROM pastas_atual), 'anterior', (SELECT v FROM pastas_ant)),
    'publicacoes', jsonb_build_object('atual', (SELECT v FROM pub_atual), 'anterior', (SELECT v FROM pub_ant)),
    'protocolos', jsonb_build_object('atual', (SELECT v FROM prot_atual), 'anterior', (SELECT v FROM prot_ant)),
    'providencias', jsonb_build_object('atual', (SELECT v FROM prov_atual), 'anterior', (SELECT v FROM prov_ant)),
    'receita_bruta', jsonb_build_object('atual', (SELECT v FROM rec_atual), 'anterior', (SELECT v FROM rec_ant))
  )
  INTO v_kpi;

  WITH
  excl AS (
    SELECT g
    FROM (VALUES
      ('Grupo Área%'),
      ('Grupo Area%'),
      ('Grupo Operações%'),
      ('Grupo Operacoes%')
    ) AS x(g)
  ),
  top_ts_atual AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
           ROUND(SUM(COALESCE(total_horas_decimal, total_horas, 0))::numeric, 4) AS valor
    FROM timesheets
    WHERE data IS NOT NULL
      AND EXTRACT(YEAR FROM data)::integer = p_ano
      AND EXTRACT(MONTH FROM data)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo_cliente, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_ts_ant AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
           ROUND(SUM(COALESCE(total_horas_decimal, total_horas, 0))::numeric, 4) AS valor
    FROM timesheets
    WHERE data IS NOT NULL
      AND EXTRACT(YEAR FROM data)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo_cliente, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_pub_atual AS (
    SELECT COALESCE(NULLIF(trim(grupo), ''), '(sem grupo)') AS grupo,
           COUNT(*)::integer AS valor
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND EXTRACT(YEAR FROM data_recebimento_kurier)::integer = p_ano
      AND EXTRACT(MONTH FROM data_recebimento_kurier)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_pub_ant AS (
    SELECT COALESCE(NULLIF(trim(grupo), ''), '(sem grupo)') AS grupo,
           COUNT(*)::integer AS valor
    FROM sp_publicacoes
    WHERE data_recebimento_kurier IS NOT NULL
      AND EXTRACT(YEAR FROM data_recebimento_kurier)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data_recebimento_kurier)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_prot_atual AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
           COUNT(*)::integer AS valor
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROTOCOLO'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo_cliente, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_prot_ant AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
           COUNT(*)::integer AS valor
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROTOCOLO'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo_cliente, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_prov_atual AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
           COUNT(*)::integer AS valor
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = p_ano
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo_cliente, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ),
  top_prov_ant AS (
    SELECT COALESCE(NULLIF(trim(grupo_cliente), ''), '(sem grupo)') AS grupo,
           COUNT(*)::integer AS valor
    FROM sp_tarefas_historico
    WHERE etiqueta_tarefa = 'PROVIDÊNCIA'
      AND data_conclusao IS NOT NULL
      AND EXTRACT(YEAR FROM data_conclusao)::integer = v_ano_ant
      AND EXTRACT(MONTH FROM data_conclusao)::integer = ANY (v_meses)
      AND NOT EXISTS (
        SELECT 1 FROM excl e WHERE COALESCE(grupo_cliente, '') ILIKE e.g
      )
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'timesheet', jsonb_build_object(
      'atual', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_ts_atual), '[]'::jsonb),
      'anterior', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_ts_ant), '[]'::jsonb)
    ),
    'publicacoes', jsonb_build_object(
      'atual', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_pub_atual), '[]'::jsonb),
      'anterior', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_pub_ant), '[]'::jsonb)
    ),
    'protocolos', jsonb_build_object(
      'atual', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_prot_atual), '[]'::jsonb),
      'anterior', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_prot_ant), '[]'::jsonb)
    ),
    'providencias', jsonb_build_object(
      'atual', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_prov_atual), '[]'::jsonb),
      'anterior', COALESCE((SELECT jsonb_agg(jsonb_build_object('grupo', grupo, 'valor', valor) ORDER BY valor DESC) FROM top_prov_ant), '[]'::jsonb)
    )
  )
  INTO v_top;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'ano_anterior', v_ano_ant,
    'meses', to_jsonb(v_meses),
    'fim_exclusivo', v_fim,
    'kpis', v_kpi,
    'top5', v_top
  );
END;
$$;

COMMENT ON FUNCTION public.eficiencia_apresentacao_bignumbers(integer, integer[]) IS
  'Apresentação — Big Numbers Operação: totais YoY e TOP 5 clientes (timesheet, pub, protocolo, providência).';

GRANT EXECUTE ON FUNCTION public.eficiencia_apresentacao_bignumbers(integer, integer[]) TO anon, authenticated;
