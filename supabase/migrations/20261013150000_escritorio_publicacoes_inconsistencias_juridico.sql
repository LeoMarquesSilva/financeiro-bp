-- Publicações: traz as inconsistências do Jurídico e abre todas as colunas no racional.
-- Corrige as datas de divulgação/publicação que vieram como número de série do Excel
-- (campo texto no SharePoint) e foram gravadas como ano (ex.: 45814-01-01).

ALTER TABLE public.sp_publicacoes
  ADD COLUMN IF NOT EXISTS inconsistencias_juridico text,
  ADD COLUMN IF NOT EXISTS inconsistencia_juridico_descricao text;

COMMENT ON COLUMN public.sp_publicacoes.inconsistencias_juridico IS 'SharePoint: INCONSISTÊNCIAS JURÍDICO';
COMMENT ON COLUMN public.sp_publicacoes.inconsistencia_juridico_descricao IS 'SharePoint: INCONSISTÊNCIA - JURÍDICO - DESCRIÇÃO';

UPDATE public.sp_publicacoes
SET data_divulgacao = date '1899-12-30' + extract(year FROM data_divulgacao)::integer
WHERE extract(year FROM data_divulgacao) > 2100;

UPDATE public.sp_publicacoes
SET data_publicacao = date '1899-12-30' + extract(year FROM data_publicacao)::integer
WHERE extract(year FROM data_publicacao) > 2100;

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
      jsonb_build_object('key', 'data_divulgacao', 'label', 'Data divulgação'),
      jsonb_build_object('key', 'data_publicacao', 'label', 'Data publicação'),
      jsonb_build_object('key', 'data_recebimento_kurier', 'label', 'Recebimento Kurier'),
      jsonb_build_object('key', 'disponibilizado_vistagem', 'label', 'Disponibilizado vistagem'),
      jsonb_build_object('key', 'numero_processo', 'label', 'Nº processo'),
      jsonb_build_object('key', 'pasta', 'label', 'Pasta'),
      jsonb_build_object('key', 'cliente_principal', 'label', 'Cliente'),
      jsonb_build_object('key', 'grupo', 'label', 'Grupo'),
      jsonb_build_object('key', 'escritorio_responsavel', 'label', 'Escritório responsável'),
      jsonb_build_object('key', 'area', 'label', 'Área'),
      jsonb_build_object('key', 'responsavel_principal', 'label', 'Responsável principal'),
      jsonb_build_object('key', 'natureza', 'label', 'Natureza'),
      jsonb_build_object('key', 'acao', 'label', 'Ação'),
      jsonb_build_object('key', 'status', 'label', 'Status do processo'),
      jsonb_build_object('key', 'demanda_risco', 'label', 'Demanda de risco'),
      jsonb_build_object('key', 'tipo_agendamento', 'label', 'Tipo agendamento'),
      jsonb_build_object('key', 'prioridade_agendamento', 'label', 'Prioridade agendamento'),
      jsonb_build_object('key', 'agendado_por', 'label', 'Agendado por'),
      jsonb_build_object('key', 'publicacao_esocial', 'label', 'E-SOCIAL'),
      jsonb_build_object('key', 'status_publicacao', 'label', 'Status publicação'),
      jsonb_build_object('key', 'vistado_por', 'label', 'Vistado por'),
      jsonb_build_object('key', 'vistado_em', 'label', 'Vistado em'),
      jsonb_build_object('key', 'vistado_d1', 'label', 'Vistado D+1'),
      jsonb_build_object('key', 'eficiencia', 'label', 'Eficiência'),
      jsonb_build_object('key', 'inconsistencias_tipo', 'label', 'Inconsistências - tipo'),
      jsonb_build_object('key', 'inconsistencia_subtipo', 'label', 'Inconsistência - subtipo'),
      jsonb_build_object('key', 'inconsistencias_juridico', 'label', 'Inconsistências jurídico'),
      jsonb_build_object('key', 'inconsistencia_juridico_descricao', 'label', 'Inconsistência jurídico - descrição'),
      jsonb_build_object('key', 'check_pub', 'label', 'Check')
    );
    SELECT COUNT(*)::integer INTO v_total FROM sp_publicacoes p
    WHERE p.criado IS NOT NULL
      AND public.escritorio_levantamento_pub_data_ref(p.criado) BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(p.grupo, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(v_area, p.area);
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT p.sp_id, p.criado, p.data_divulgacao, p.data_publicacao, p.data_recebimento_kurier,
        p.disponibilizado_vistagem, p.numero_processo, p.pasta, p.cliente_principal, p.grupo,
        p.escritorio_responsavel, p.area, p.responsavel_principal, p.natureza, p.acao, p.status,
        p.demanda_risco, p.tipo_agendamento, p.prioridade_agendamento, p.agendado_por,
        p.publicacao_esocial, p.status_publicacao, p.vistado_por, p.vistado_em, p.vistado_d1,
        p.eficiencia, p.inconsistencias_tipo, p.inconsistencia_subtipo, p.inconsistencias_juridico,
        p.inconsistencia_juridico_descricao, p.check_pub
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
      )
      AND pc.situacao_processo = 'Ativo';
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
        AND pc.situacao_processo = 'Ativo'
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
      jsonb_build_object('key', 'classe', 'label', 'Classe (Prazo/Providência)'),
      jsonb_build_object('key', 'ci', 'label', 'CI'),
      jsonb_build_object('key', 'nro_cnj', 'label', 'CNJ'),
      jsonb_build_object('key', 'grupo_cliente', 'label', 'Grupo'),
      jsonb_build_object('key', 'cliente', 'label', 'Cliente'),
      jsonb_build_object('key', 'tarefa', 'label', 'Tarefa'),
      jsonb_build_object('key', 'etiquetas_tarefa', 'label', 'Etiqueta'),
      jsonb_build_object('key', 'status', 'label', 'Status'),
      jsonb_build_object('key', 'usuario_conclusao', 'label', 'Concluído por'),
      jsonb_build_object('key', 'data_conclusao', 'label', 'Data conclusão'),
      jsonb_build_object('key', 'area_conclusao', 'label', 'Área conclusão'),
      jsonb_build_object('key', 'area_processo', 'label', 'Área processo'),
      jsonb_build_object('key', 'data_limite', 'label', 'Data limite')
    );
    SELECT COUNT(*)::integer INTO v_total
    FROM sp_tarefas tar
    WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
      AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
      AND public.escritorio_levantamento_area_match(
        v_area,
        COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''))
      )
      AND public.escritorio_tarefa_classe(tar.etiquetas_tarefa, tar.tarefa) IS NOT NULL;
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_linhas FROM (
      SELECT
        public.escritorio_tarefa_classe(tar.etiquetas_tarefa, tar.tarefa) AS classe,
        tar.ci, tar.nro_cnj, tar.grupo_cliente, tar.cliente, tar.tarefa, tar.etiquetas_tarefa, tar.status,
        tar.usuario_conclusao, tar.data_conclusao, tar.area_conclusao, tar.area_processo, tar.data_limite
      FROM sp_tarefas tar
      WHERE tar.data_conclusao IS NOT NULL AND tar.data_conclusao BETWEEN p_data_inicio AND p_data_fim
        AND (v_grupos IS NULL OR lower(trim(COALESCE(tar.grupo_cliente, ''))) = ANY (v_grupos))
        AND public.escritorio_levantamento_area_match(
          v_area,
          COALESCE(NULLIF(trim(tar.area_conclusao), ''), NULLIF(trim(tar.area_processo), ''))
        )
        AND public.escritorio_tarefa_classe(tar.etiquetas_tarefa, tar.tarefa) IS NOT NULL
      ORDER BY tar.data_conclusao DESC NULLS LAST, tar.ci DESC LIMIT v_limit
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
