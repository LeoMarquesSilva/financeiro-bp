-- Expõe grupo do processo no VIOS (pode diferir do grupo devedor vinculado).

DROP VIEW IF EXISTS public.inadimplencia_judicializada_list;

CREATE VIEW public.inadimplencia_judicializada_list AS
SELECT
  j.id,
  j.grupo_cliente,
  j.grupo_chave,
  j.processo_id,
  j.valor_em_aberto_auto,
  j.valor_em_aberto_ajuste,
  COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto) AS valor_em_aberto_nominal,
  COALESCE(atual.valor_atualizado, COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto)) AS valor_em_aberto,
  COALESCE(atual.valor_correcao_inpc, 0)::NUMERIC(15, 2) AS valor_correcao_inpc,
  COALESCE(atual.valor_juros_mora, 0)::NUMERIC(15, 2) AS valor_juros_mora,
  COALESCE(atual.meses_atualizacao, 0) AS meses_atualizacao,
  j.data_judicializacao,
  j.observacoes,
  j.encerrado_at,
  j.created_by,
  j.created_at,
  j.updated_at,
  COALESCE(j.nro_cnj, p.nro_cnj) AS nro_cnj,
  p.acao,
  p.area,
  p.departamento,
  p.situacao_processo,
  p.fase_processual,
  p.advogado_responsavel,
  p.cliente AS processo_cliente,
  p.grupo_cliente AS processo_grupo_vios,
  p.ci AS processo_ci,
  p.pessoa_id AS processo_pessoa_id,
  j.parte_passiva,
  j.valor_causa,
  j.status_planilha,
  j.andamentos_resumo,
  j.providencias_planilha,
  j.citacao,
  j.tribunal,
  j.tipo_acao_planilha,
  j.importado_em,
  j.importado_de,
  j.andamentos_sync_em,
  j.andamentos_fonte
FROM public.inadimplencia_judicializada j
JOIN public.processos_completo p ON p.id = j.processo_id
LEFT JOIN LATERAL public.atualizar_valor_inpc_tjsp(
  COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto),
  j.data_judicializacao
) atual ON j.data_judicializacao IS NOT NULL
  AND COALESCE(j.valor_em_aberto_ajuste, j.valor_em_aberto_auto) > 0;

COMMENT ON VIEW public.inadimplencia_judicializada_list IS
  'Lista judicializada + processo VIOS; processo_grupo_vios é o grupo cadastrado no processo (pode ≠ grupo devedor).';
