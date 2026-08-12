-- Publicações no levantamento: coluna E-SOCIAL + limpa tipo_agendamento JSON (["PRAZO"]).

ALTER TABLE public.sp_publicacoes
  ADD COLUMN IF NOT EXISTS publicacao_esocial text;

COMMENT ON COLUMN public.sp_publicacoes.publicacao_esocial IS
  'SharePoint: PUBLICAÇÃO - ESOCIAL (Sim/Não).';

CREATE OR REPLACE FUNCTION public.sioe_clean_json_array_text(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := NULLIF(trim(COALESCE(p_value, '')), '');
  v_json jsonb;
BEGIN
  IF v IS NULL THEN
    RETURN NULL;
  END IF;
  IF left(v, 1) = '[' THEN
    BEGIN
      v_json := v::jsonb;
      IF jsonb_typeof(v_json) = 'array' THEN
        RETURN NULLIF(
          (
            SELECT string_agg(trim(both '"' from elem), ', ' ORDER BY ord)
            FROM jsonb_array_elements_text(v_json) WITH ORDINALITY AS t(elem, ord)
          ),
          ''
        );
      END IF;
    EXCEPTION WHEN others THEN
      -- fallback textual
      RETURN NULLIF(
        trim(both ' ,' from regexp_replace(regexp_replace(v, '^\s*\[|\]\s*$', '', 'g'), '"', '', 'g')),
        ''
      );
    END;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.escritorio_levantamento_racional_v2(
  p_bloco text,
  p_data_inicio date,
  p_data_fim date,
  p_grupos text[] DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_tipo_agendamento text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bloco text := lower(trim(COALESCE(p_bloco, '')));
  v_grupos text[] := NULL;
  v_area text := NULLIF(trim(COALESCE(p_area, '')), '');
  v_area_key text;
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
  v_area_key := CASE WHEN v_area IS NULL THEN NULL ELSE lower(v_area) END;

  IF v_bloco = 'publicacoes' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'sp_id', 'label', 'ID'),
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
    WHERE p.disponibilizado_vistagem IS NOT NULL
      AND (p.disponibilizado_vistagem AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
      AND (v_area_key IS NULL OR lower(trim(COALESCE(p.area, ''))) = v_area_key);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT p.sp_id, p.data_publicacao, p.disponibilizado_vistagem, p.numero_processo, p.pasta,
        p.cliente_principal, p.grupo, p.area,
        public.sioe_clean_json_array_text(p.tipo_agendamento) AS tipo_agendamento,
        p.publicacao_esocial,
        p.status_publicacao, p.vistado_por, p.vistado_d1
      FROM sp_publicacoes p
      WHERE p.disponibilizado_vistagem IS NOT NULL
        AND (p.disponibilizado_vistagem AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
        AND (v_area_key IS NULL OR lower(trim(COALESCE(p.area, ''))) = v_area_key)
      ORDER BY p.disponibilizado_vistagem DESC NULLS LAST LIMIT v_limit
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
      AND (v_area_key IS NULL OR lower(trim(COALESCE(t.area, ''))) = v_area_key);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT t.data, t.grupo_cliente, t.cliente, t.area, t.colaborador, t.tipo_apontamento, t.tipo_tarefa,
        t.nro_processo, t.ci, t.total_horas_decimal, left(COALESCE(t.descricao, ''), 500) AS descricao
      FROM timesheets t
      WHERE t.data IS NOT NULL AND t.data BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(t.grupo_cliente, ''))) = ANY (v_grupos))
        AND (v_area_key IS NULL OR lower(trim(COALESCE(t.area, ''))) = v_area_key)
      ORDER BY t.data DESC NULLS LAST LIMIT v_limit
    ) x;

  ELSIF v_bloco = 'processos' THEN
    v_colunas := jsonb_build_array(
      jsonb_build_object('key', 'ci', 'label', 'CI'),
      jsonb_build_object('key', 'nro_cnj', 'label', 'CNJ'),
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
      AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''), ''))) = v_area_key);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT pc.ci, pc.nro_cnj, pc.grupo_cliente, pc.cliente, pc.area, pc.departamento,
        pc.advogado_responsavel, pc.acao, pc.fase_processual, pc.situacao_processo, pc.data_cadastro, pc.data_encerramento
      FROM processos_completo pc
      WHERE (v_grupos IS NULL OR lower(trim(COALESCE(pc.grupo_cliente, ''))) = ANY (v_grupos))
        AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(pc.area), ''), NULLIF(trim(pc.departamento), ''), ''))) = v_area_key)
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
      AND (v_area_key IS NULL OR lower(trim(COALESCE(a.area_equipe, ''))) = v_area_key)
      AND (v_tipo IS NULL OR (v_tipo = 'Sem tipo' AND NULLIF(trim(COALESCE(a.tipo_agendamento, '')), '') IS NULL) OR trim(COALESCE(a.tipo_agendamento, '')) = v_tipo);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT a.sp_id, a.solicitado_em,
        public.sioe_clean_json_array_text(a.tipo_agendamento) AS tipo_agendamento,
        a.tipo_abertura_encerramento, a.agendado_por,
        a.area_equipe, a.status, a.adesao_indicador, a.inconsistencia_juridico
      FROM sp_agendamento a
      WHERE a.solicitado_em IS NOT NULL AND a.solicitado_em BETWEEN p_data_inicio AND p_data_fim
        AND (v_area_key IS NULL OR lower(trim(COALESCE(a.area_equipe, ''))) = v_area_key)
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
      AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''), ''))) = v_area_key);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT tar.ci, tar.nro_cnj, tar.grupo_cliente, tar.cliente, tar.tarefa, tar.status,
        tar.usuario_conclusao, tar.data_conclusao, tar.area_conclusao, tar.area_processo, tar.data_limite
      FROM sp_tarefas tar
      WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
        AND (v_area_key IS NULL OR lower(trim(COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''), ''))) = v_area_key)
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
$$;

GRANT EXECUTE ON FUNCTION public.sioe_clean_json_array_text(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escritorio_levantamento_racional_v2(text, date, date, text[], text, text, integer) TO anon, authenticated;
