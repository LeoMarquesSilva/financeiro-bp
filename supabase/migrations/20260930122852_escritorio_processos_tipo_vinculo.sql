-- Escritório / levantamento: classificação Principal × Recurso × Incidente e
-- quebra por departamento no bloco "Processos por situação".
--
-- Fonte da classificação (nessa ordem):
--   1. processos_completo.vinculo  — coluna "Vínculo" do relatório VIOS (sync).
--   2. etiqueta VIOS "Incidente"   — processos_completo.etiquetas.
--   3. processos_completo.acao     — tipo de ação cadastrado no VIOS
--      (Agravo…, Recurso…, Apelação…, Embargos de declaração… = Recurso;
--       Incidente…, Pedido de efeito suspensivo… = Incidente).
-- Sem vínculo e sem ação: 'Não classificado'.

ALTER TABLE public.processos_completo
  ADD COLUMN IF NOT EXISTS vinculo text;

COMMENT ON COLUMN public.processos_completo.vinculo IS
  'Coluna "Vínculo" do relatório de processos VIOS (Principal / Recurso / Incidente).';

CREATE OR REPLACE FUNCTION public.escritorio_processo_tipo_vinculo_base(
  p_vinculo text,
  p_acao text,
  p_etiquetas text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN NULLIF(trim(COALESCE(p_vinculo, '')), '') IS NOT NULL THEN 'Vínculo VIOS'
    WHEN COALESCE(p_etiquetas, '') ~* '(^|\|)\s*incidente\s*(\||$)' THEN 'Etiqueta VIOS'
    WHEN NULLIF(trim(COALESCE(p_acao, '')), '') IS NOT NULL THEN 'Tipo de ação'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.escritorio_processo_tipo_vinculo(
  p_vinculo text,
  p_acao text,
  p_etiquetas text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN NULLIF(trim(COALESCE(p_vinculo, '')), '') IS NOT NULL THEN
      CASE
        WHEN p_vinculo ~* 'recurso' THEN 'Recurso'
        WHEN p_vinculo ~* 'incidente' THEN 'Incidente'
        WHEN p_vinculo ~* 'principal' THEN 'Principal'
        ELSE initcap(trim(p_vinculo))
      END
    WHEN COALESCE(p_etiquetas, '') ~* '(^|\|)\s*incidente\s*(\||$)' THEN 'Incidente'
    WHEN NULLIF(trim(COALESCE(p_acao, '')), '') IS NULL THEN 'Não classificado'
    WHEN p_acao ~* '^\s*(agravo|recurso|apela[cç][aã]o|embargos de declara[cç][aã]o)' THEN 'Recurso'
    WHEN p_acao ~* '^\s*(incidente|pedido de efeito suspensivo)' THEN 'Incidente'
    ELSE 'Principal'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.escritorio_processo_tipo_vinculo(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escritorio_processo_tipo_vinculo_base(text, text, text) TO authenticated;

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

  SELECT COUNT(*)::integer INTO v_tar_total
  FROM sp_tarefas tar
  WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
    AND public.escritorio_levantamento_area_match(
      v_area,
      COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''))
    );

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
    'data_inicio', p_data_inicio,
    'data_fim', p_data_fim,
    'grupos', to_jsonb(COALESCE(p_grupos, ARRAY[]::text[])),
    'area', v_area
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.escritorio_levantamento_racional_v2(
  p_bloco text,
  p_data_inicio date,
  p_data_fim date,
  p_grupos text[] DEFAULT NULL::text[],
  p_area text DEFAULT NULL::text,
  p_tipo_agendamento text DEFAULT NULL::text,
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bloco text := lower(trim(COALESCE(p_bloco, '')));
  v_grupos text[] := NULL;
  v_area text := NULLIF(trim(COALESCE(p_area, '')), '');
  v_tipo text := NULLIF(trim(COALESCE(p_tipo_agendamento, '')), '');
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 5000), 20000));
  v_total integer := 0;
  v_linhas jsonb := '[]'::jsonb;
  v_colunas jsonb;
BEGIN
  IF p_grupos IS NOT NULL AND cardinality(p_grupos) > 0 THEN
    SELECT array_agg(DISTINCT lower(trim(g))) INTO v_grupos
    FROM unnest(p_grupos) AS g WHERE NULLIF(trim(g), '') IS NOT NULL;
  END IF;

  IF v_bloco = 'publicacoes' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'sp_id', 'label', 'ID'),
      jsonb_build_object('key', 'criado', 'label', 'Criado'),
      jsonb_build_object('key', 'data_publicacao', 'label', 'Data publicação'),
      jsonb_build_object('key', 'disponibilizado_vistagem', 'label', 'Disponibilizado vistagem'),
      jsonb_build_object('key', 'numero_processo', 'label', 'Nº processo'),
      jsonb_build_object('key', 'pasta', 'label', 'Pasta'),
      jsonb_build_object('key', 'cliente_principal', 'label', 'Cliente'),
      jsonb_build_object('key', 'grupo', 'label', 'Grupo'),
      jsonb_build_object('key', 'area', 'label', 'Área'),
      jsonb_build_object('key', 'tipo_agendamento', 'label', 'Tipo agendamento'),
      jsonb_build_object('key', 'publicacao_esocial', 'label', 'E-SOCIAL'),
      jsonb_build_object('key', 'status_publicacao', 'label', 'Status'),
      jsonb_build_object('key', 'vistado_por', 'label', 'Vistado por'),
      jsonb_build_object('key', 'vistado_d1', 'label', 'Vistado D+1')
    );
    SELECT COUNT(*)::integer INTO v_total FROM sp_publicacoes p
    WHERE p.criado IS NOT NULL
      AND public.escritorio_levantamento_pub_data_ref(p.criado) BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(v_area, p.area);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT p.sp_id, p.criado, p.data_publicacao, p.disponibilizado_vistagem, p.numero_processo, p.pasta,
        p.cliente_principal, p.grupo, p.area, p.tipo_agendamento, p.publicacao_esocial,
        p.status_publicacao, p.vistado_por, p.vistado_d1
      FROM sp_publicacoes p
      WHERE p.criado IS NOT NULL
        AND public.escritorio_levantamento_pub_data_ref(p.criado) BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
        AND public.escritorio_levantamento_area_match(v_area, p.area)
      ORDER BY p.criado DESC NULLS LAST LIMIT v_limit
    ) x;

  ELSIF v_bloco = 'timesheet' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'data', 'label', 'Data'),
      jsonb_build_object('key', 'grupo_cliente', 'label', 'Grupo'),
      jsonb_build_object('key', 'cliente', 'label', 'Cliente'),
      jsonb_build_object('key', 'area', 'label', 'Área'),
      jsonb_build_object('key', 'colaborador', 'label', 'Colaborador'),
      jsonb_build_object('key', 'tipo_apontamento', 'label', 'Tipo apontamento'),
      jsonb_build_object('key', 'tipo_tarefa', 'label', 'Tipo tarefa'),
      jsonb_build_object('key', 'nro_processo', 'label', 'Nº processo'),
      jsonb_build_object('key', 'ci', 'label', 'CI'),
      jsonb_build_object('key', 'total_horas_decimal', 'label', 'Horas'),
      jsonb_build_object('key', 'descricao', 'label', 'Descrição')
    );
    SELECT COUNT(*)::integer INTO v_total FROM timesheets t
    WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(v_area, t.area);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT t.data, t.grupo_cliente, t.cliente, t.area, t.colaborador, t.tipo_apontamento, t.tipo_tarefa,
        t.nro_processo, t.ci, t.total_horas_decimal, left(COALESCE(t.descricao, ''), 500) AS descricao
      FROM timesheets t
      WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
        AND public.escritorio_levantamento_area_match(v_area, t.area)
      ORDER BY t.data DESC NULLS LAST LIMIT v_limit
    ) x;

  ELSIF v_bloco = 'processos' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'ci', 'label', 'CI'),
      jsonb_build_object('key', 'nro_cnj', 'label', 'CNJ'),
      jsonb_build_object('key', 'tipo_vinculo', 'label', 'Tipo (Principal/Recurso/Incidente)'),
      jsonb_build_object('key', 'tipo_vinculo_base', 'label', 'Base da classificação'),
      jsonb_build_object('key', 'grupo_cliente', 'label', 'Grupo'),
      jsonb_build_object('key', 'cliente', 'label', 'Cliente'),
      jsonb_build_object('key', 'area', 'label', 'Área'),
      jsonb_build_object('key', 'departamento', 'label', 'Departamento'),
      jsonb_build_object('key', 'advogado_responsavel', 'label', 'Advogado responsável'),
      jsonb_build_object('key', 'acao', 'label', 'Ação'),
      jsonb_build_object('key', 'fase_processual', 'label', 'Fase'),
      jsonb_build_object('key', 'situacao_processo', 'label', 'Situação'),
      jsonb_build_object('key', 'data_cadastro', 'label', 'Data cadastro'),
      jsonb_build_object('key', 'data_encerramento', 'label', 'Data encerramento')
    );
    SELECT COUNT(*)::integer INTO v_total FROM processos_completo pc
    WHERE (v_grupos IS NULL OR lower(trim(COALESCE(pc.grupo_cliente, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(
        v_area,
        COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''))
      );
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT pc.ci, pc.nro_cnj,
        public.escritorio_processo_tipo_vinculo(pc.vinculo, pc.acao, pc.etiquetas) AS tipo_vinculo,
        public.escritorio_processo_tipo_vinculo_base(pc.vinculo, pc.acao, pc.etiquetas) AS tipo_vinculo_base,
        pc.grupo_cliente, pc.cliente, pc.area, pc.departamento,
        pc.advogado_responsavel, pc.acao, pc.fase_processual, pc.situacao_processo, pc.data_cadastro, pc.data_encerramento
      FROM processos_completo pc
      WHERE (v_grupos IS NULL OR lower(trim(COALESCE(pc.grupo_cliente, ''))) = ANY (v_grupos))
        AND public.escritorio_levantamento_area_match(
          v_area,
          COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''))
        )
      ORDER BY pc.grupo_cliente NULLS LAST, pc.cliente NULLS LAST, pc.ci NULLS LAST LIMIT v_limit
    ) x;

  ELSIF v_bloco = 'agendamento' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'sp_id', 'label', 'ID'),
      jsonb_build_object('key', 'solicitado_em', 'label', 'Solicitado em'),
      jsonb_build_object('key', 'tipo_agendamento', 'label', 'Tipo agendamento'),
      jsonb_build_object('key', 'tipo_abertura_encerramento', 'label', 'Abertura/Encerramento'),
      jsonb_build_object('key', 'agendado_por', 'label', 'Agendado por'),
      jsonb_build_object('key', 'area_equipe', 'label', 'Área'),
      jsonb_build_object('key', 'status', 'label', 'Status'),
      jsonb_build_object('key', 'adesao_indicador', 'label', 'Adesão'),
      jsonb_build_object('key', 'inconsistencia_juridico', 'label', 'Inconsistência')
    );
    SELECT COUNT(DISTINCT a.sp_id)::integer INTO v_total FROM sp_agendamento a
    WHERE a.solicitado_em IS NOT NULL AND a.solicitado_em BETWEEN p_data_inicio AND p_data_fim
      AND public.escritorio_levantamento_area_match(v_area, a.area_equipe)
      AND (v_tipo IS NULL OR (v_tipo = 'Sem tipo' AND NULLIF(trim(COALESCE(a.tipo_agendamento, '')), '') IS NULL) OR trim(COALESCE(a.tipo_agendamento, '')) = v_tipo);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT a.sp_id, a.solicitado_em, a.tipo_agendamento, a.tipo_abertura_encerramento, a.agendado_por,
        a.area_equipe, a.status, a.adesao_indicador, a.inconsistencia_juridico
      FROM sp_agendamento a
      WHERE a.solicitado_em IS NOT NULL AND a.solicitado_em BETWEEN p_data_inicio AND p_data_fim
        AND public.escritorio_levantamento_area_match(v_area, a.area_equipe)
        AND (v_tipo IS NULL OR (v_tipo = 'Sem tipo' AND NULLIF(trim(COALESCE(a.tipo_agendamento, '')), '') IS NULL) OR trim(COALESCE(a.tipo_agendamento, '')) = v_tipo)
      ORDER BY a.solicitado_em DESC NULLS LAST LIMIT v_limit
    ) x;

  ELSIF v_bloco = 'tarefas' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'ci', 'label', 'CI'),
      jsonb_build_object('key', 'nro_cnj', 'label', 'CNJ'),
      jsonb_build_object('key', 'grupo_cliente', 'label', 'Grupo'),
      jsonb_build_object('key', 'cliente', 'label', 'Cliente'),
      jsonb_build_object('key', 'tarefa', 'label', 'Tarefa'),
      jsonb_build_object('key', 'status', 'label', 'Status'),
      jsonb_build_object('key', 'usuario_conclusao', 'label', 'Concluído por'),
      jsonb_build_object('key', 'data_conclusao', 'label', 'Data conclusão'),
      jsonb_build_object('key', 'area_conclusao', 'label', 'Área conclusão'),
      jsonb_build_object('key', 'area_processo', 'label', 'Área processo'),
      jsonb_build_object('key', 'data_limite', 'label', 'Data limite')
    );
    SELECT COUNT(*)::integer INTO v_total FROM sp_tarefas tar
    WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(
        v_area,
        COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''))
      );
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT tar.ci, tar.nro_cnj, tar.grupo_cliente, tar.cliente, tar.tarefa, tar.status,
        tar.usuario_conclusao, tar.data_conclusao, tar.area_conclusao, tar.area_processo, tar.data_limite
      FROM sp_tarefas tar
      WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
        AND public.escritorio_levantamento_area_match(
          v_area,
          COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''))
        )
      ORDER BY tar.data_conclusao DESC NULLS LAST LIMIT v_limit
    ) x;
  ELSE
    RAISE EXCEPTION 'Bloco inválido: %', p_bloco USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'bloco', v_bloco, 'colunas', v_colunas, 'linhas', COALESCE(v_linhas, '[]'::jsonb),
    'total', v_total, 'truncado', v_total > jsonb_array_length(COALESCE(v_linhas, '[]'::jsonb)), 'limit', v_limit
  );
END;
$function$;
