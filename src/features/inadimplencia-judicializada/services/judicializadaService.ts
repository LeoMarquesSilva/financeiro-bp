import { supabase } from '@/lib/supabaseClient'
import {
  fetchInadimplenciaGruposIndex,
  grupoChaveNoComiteInadimplencia,
} from '@/features/escritorio/services/inadimplenciaGruposIndex'
import {
  GRUPO_SEM_NOME,
  normalizarNomeGrupo,
} from '@/features/escritorio/services/escritorioService'
import type {
  CreateJudicializadaInput,
  InadimplenciaJudicializadaAndamentoRow,
  InadimplenciaJudicializadaRow,
  JudicializadaKpis,
  ProcessoViosRow,
  UpdateJudicializadaInput,
} from '../types/judicializada.types'
import type {
  ImportPlanilhaResult,
  ImportPreviewRow,
  PlanilhaAjuizadoRow,
} from '../utils/judicializadaImport'
import { normalizarCnj } from '../utils/cnjUtils'
import { atualizarValorInpcTjsp } from '../utils/correcaoMonetariaInpcTjsp'

const LIST_SELECT =
  'id, grupo_cliente, grupo_chave, processo_id, valor_em_aberto_auto, valor_em_aberto_ajuste, valor_em_aberto_nominal, valor_em_aberto, valor_correcao_inpc, valor_juros_mora, meses_atualizacao, data_judicializacao, observacoes, encerrado_at, created_by, created_at, updated_at, nro_cnj, acao, area, departamento, situacao_processo, fase_processual, advogado_responsavel, processo_cliente, processo_grupo_vios, processo_ci, processo_pessoa_id, parte_passiva, valor_causa, status_planilha, andamentos_resumo, providencias_planilha, citacao, tribunal, tipo_acao_planilha, importado_em, importado_de, andamentos_sync_em, andamentos_fonte'

function enrichValorAtualizado(
  raw: Record<string, unknown>,
): Pick<
  InadimplenciaJudicializadaRow,
  | 'valor_em_aberto_nominal'
  | 'valor_em_aberto'
  | 'valor_correcao_inpc'
  | 'valor_juros_mora'
  | 'meses_atualizacao'
> {
  const nominal =
    raw.valor_em_aberto_nominal != null
      ? Number(raw.valor_em_aberto_nominal)
      : Number(raw.valor_em_aberto_ajuste ?? raw.valor_em_aberto_auto) || 0

  if (raw.valor_em_aberto_nominal != null && raw.meses_atualizacao != null) {
    return {
      valor_em_aberto_nominal: nominal,
      valor_em_aberto: Number(raw.valor_em_aberto) || 0,
      valor_correcao_inpc: Number(raw.valor_correcao_inpc) || 0,
      valor_juros_mora: Number(raw.valor_juros_mora) || 0,
      meses_atualizacao: Number(raw.meses_atualizacao) || 0,
    }
  }

  const atualizado = atualizarValorInpcTjsp(
    nominal,
    raw.data_judicializacao != null ? String(raw.data_judicializacao) : null,
  )
  return {
    valor_em_aberto_nominal: nominal,
    valor_em_aberto: atualizado.valorAtualizado,
    valor_correcao_inpc: atualizado.valorCorrecaoInpc,
    valor_juros_mora: atualizado.valorJurosMora,
    meses_atualizacao: atualizado.mesesAtualizacao,
  }
}

const PROCESSO_SELECT =
  'id, ci, grupo_cliente, departamento, area, advogado_responsavel, cliente, acao, nro_cnj, situacao_processo, fase_processual, pessoa_id'

function parseRow(raw: Record<string, unknown>): InadimplenciaJudicializadaRow {
  return {
    id: String(raw.id),
    grupo_cliente: String(raw.grupo_cliente ?? ''),
    grupo_chave: String(raw.grupo_chave ?? ''),
    processo_id: String(raw.processo_id),
    valor_em_aberto_auto: Number(raw.valor_em_aberto_auto) || 0,
    valor_em_aberto_ajuste:
      raw.valor_em_aberto_ajuste != null ? Number(raw.valor_em_aberto_ajuste) : null,
    ...enrichValorAtualizado(raw),
    data_judicializacao: raw.data_judicializacao != null ? String(raw.data_judicializacao) : null,
    observacoes: raw.observacoes != null ? String(raw.observacoes) : null,
    encerrado_at: raw.encerrado_at != null ? String(raw.encerrado_at) : null,
    created_by: raw.created_by != null ? String(raw.created_by) : null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
    nro_cnj: raw.nro_cnj != null ? String(raw.nro_cnj) : null,
    acao: raw.acao != null ? String(raw.acao) : null,
    area: raw.area != null ? String(raw.area) : null,
    departamento: raw.departamento != null ? String(raw.departamento) : null,
    situacao_processo:
      raw.situacao_processo != null ? String(raw.situacao_processo) : null,
    fase_processual: raw.fase_processual != null ? String(raw.fase_processual) : null,
    advogado_responsavel:
      raw.advogado_responsavel != null ? String(raw.advogado_responsavel) : null,
    processo_cliente:
      raw.processo_cliente != null ? String(raw.processo_cliente) : null,
    processo_grupo_vios:
      raw.processo_grupo_vios != null ? String(raw.processo_grupo_vios) : null,
    processo_ci: raw.processo_ci != null ? String(raw.processo_ci) : null,
    processo_pessoa_id:
      raw.processo_pessoa_id != null ? String(raw.processo_pessoa_id) : null,
    parte_passiva: raw.parte_passiva != null ? String(raw.parte_passiva) : null,
    valor_causa: raw.valor_causa != null ? Number(raw.valor_causa) : null,
    status_planilha: raw.status_planilha != null ? String(raw.status_planilha) : null,
    andamentos_resumo:
      raw.andamentos_resumo != null ? String(raw.andamentos_resumo) : null,
    providencias_planilha:
      raw.providencias_planilha != null ? String(raw.providencias_planilha) : null,
    citacao: raw.citacao != null ? String(raw.citacao) : null,
    tribunal: raw.tribunal != null ? String(raw.tribunal) : null,
    tipo_acao_planilha:
      raw.tipo_acao_planilha != null ? String(raw.tipo_acao_planilha) : null,
    importado_em: raw.importado_em != null ? String(raw.importado_em) : null,
    importado_de: raw.importado_de != null ? String(raw.importado_de) : null,
    andamentos_sync_em:
      raw.andamentos_sync_em != null ? String(raw.andamentos_sync_em) : null,
    andamentos_fonte:
      raw.andamentos_fonte != null ? String(raw.andamentos_fonte) : null,
  }
}

function parseProcesso(raw: Record<string, unknown>): ProcessoViosRow {
  return {
    id: String(raw.id),
    ci: raw.ci != null ? String(raw.ci) : null,
    grupo_cliente: raw.grupo_cliente != null ? String(raw.grupo_cliente) : null,
    departamento: raw.departamento != null ? String(raw.departamento) : null,
    area: raw.area != null ? String(raw.area) : null,
    advogado_responsavel:
      raw.advogado_responsavel != null ? String(raw.advogado_responsavel) : null,
    cliente: raw.cliente != null ? String(raw.cliente) : null,
    acao: raw.acao != null ? String(raw.acao) : null,
    nro_cnj: raw.nro_cnj != null ? String(raw.nro_cnj) : null,
    situacao_processo:
      raw.situacao_processo != null ? String(raw.situacao_processo) : null,
    fase_processual: raw.fase_processual != null ? String(raw.fase_processual) : null,
    pessoa_id: raw.pessoa_id != null ? String(raw.pessoa_id) : null,
  }
}

export function buildGrupoChave(grupoCliente: string): string {
  const trimmed = grupoCliente.trim()
  if (!trimmed || trimmed === GRUPO_SEM_NOME) return normalizarNomeGrupo(trimmed || GRUPO_SEM_NOME)
  return normalizarNomeGrupo(trimmed)
}

function processoMatchesGrupo(processo: ProcessoViosRow, grupoCliente: string): boolean {
  const grupoNorm = buildGrupoChave(grupoCliente)
  if (processo.grupo_cliente?.trim()) {
    return normalizarNomeGrupo(processo.grupo_cliente) === grupoNorm
  }
  if (processo.cliente?.trim()) {
    return normalizarNomeGrupo(processo.cliente) === grupoNorm
  }
  return false
}

async function fetchPessoaIdsDoGrupo(grupoCliente: string): Promise<string[]> {
  const grupo = grupoCliente.trim()
  const { data, error } = await supabase
    .from('pessoas')
    .select('id')
    .eq('grupo_cliente', grupo)
  if (error) throw error
  return (data ?? []).map((r) => String((r as { id: string }).id))
}

export async function calcularValorAutoGrupo(grupoCliente: string): Promise<number> {
  const grupo = grupoCliente.trim()
  if (!grupo || grupo === GRUPO_SEM_NOME) return 0

  const { data, error } = await supabase
    .from('escritorio_grupos_resumo')
    .select('valor_em_atraso, valor_em_atraso_ativos')
    .eq('grupo_cliente', grupo)
    .maybeSingle()

  if (error) {
    console.error('[judicializadaService] calcularValorAutoGrupo', error)
    return 0
  }

  if (data) {
    const row = data as { valor_em_atraso: number; valor_em_atraso_ativos: number }
    const ativos = Number(row.valor_em_atraso_ativos) || 0
    const total = Number(row.valor_em_atraso) || 0
    return ativos > 0 ? ativos : total
  }

  const grupoNorm = buildGrupoChave(grupo)
  const { data: allRows, error: errAll } = await supabase
    .from('escritorio_grupos_resumo')
    .select('grupo_cliente, valor_em_atraso, valor_em_atraso_ativos')

  if (errAll) return 0

  for (const row of (allRows ?? []) as {
    grupo_cliente: string
    valor_em_atraso: number
    valor_em_atraso_ativos: number
  }[]) {
    if (normalizarNomeGrupo(row.grupo_cliente) === grupoNorm) {
      const ativos = Number(row.valor_em_atraso_ativos) || 0
      const total = Number(row.valor_em_atraso) || 0
      return ativos > 0 ? ativos : total
    }
  }

  return 0
}

async function assertProcessoDisponivel(processoId: string, excludeId?: string): Promise<void> {
  let query = supabase
    .from('inadimplencia_judicializada')
    .select('id')
    .eq('processo_id', processoId)
    .is('encerrado_at', null)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (data) {
    throw new Error('Este processo VIOS já está vinculado a um caso judicializado ativo.')
  }
}

async function assertGrupoNaoNoComite(grupoCliente: string): Promise<void> {
  const index = await fetchInadimplenciaGruposIndex()
  if (grupoChaveNoComiteInadimplencia(grupoCliente, index)) {
    throw new Error(
      'Este grupo está ativo no Comitê de Inadimplência. Encerre ou resolva o card antes de judicializar.',
    )
  }
}

async function assertProcessoDoGrupo(
  processoId: string,
  grupoCliente: string,
): Promise<ProcessoViosRow> {
  const { data, error } = await supabase
    .from('processos_completo')
    .select(PROCESSO_SELECT)
    .eq('id', processoId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Processo VIOS não encontrado.')

  const processo = parseProcesso(data as Record<string, unknown>)
  if (!processoMatchesGrupo(processo, grupoCliente)) {
    const pessoaIds = await fetchPessoaIdsDoGrupo(grupoCliente)
    if (!processo.pessoa_id || !pessoaIds.includes(processo.pessoa_id)) {
      throw new Error('O processo selecionado não pertence ao grupo informado.')
    }
  }

  return processo
}

export async function fetchProcessosDoGrupo(
  grupoCliente: string,
  busca?: string,
): Promise<ProcessoViosRow[]> {
  const grupo = grupoCliente.trim()
  if (!grupo) return []

  const pessoaIds = await fetchPessoaIdsDoGrupo(grupo)
  const termo = busca?.trim().toLowerCase() ?? ''

  const { data: byGrupo, error: errGrupo } = await supabase
    .from('processos_completo')
    .select(PROCESSO_SELECT)
    .eq('grupo_cliente', grupo)
    .order('nro_cnj', { ascending: true, nullsFirst: false })
    .limit(200)

  if (errGrupo) throw errGrupo

  let processos = ((byGrupo ?? []) as Record<string, unknown>[]).map(parseProcesso)

  if (processos.length === 0 && pessoaIds.length > 0) {
    const { data: byPessoa, error: errPessoa } = await supabase
      .from('processos_completo')
      .select(PROCESSO_SELECT)
      .in('pessoa_id', pessoaIds.slice(0, 100))
      .order('nro_cnj', { ascending: true, nullsFirst: false })
      .limit(200)

    if (errPessoa) throw errPessoa
    processos = ((byPessoa ?? []) as Record<string, unknown>[]).map(parseProcesso)
  }

  if (termo) {
    const cnjNorm = normalizarCnj(termo)
    if (cnjNorm.length >= 10) {
      try {
        const porCnj = await lookupProcessosPorCnj(termo)
        for (const p of porCnj) {
          if (!processos.some((x) => x.id === p.id)) processos.push(p)
        }
      } catch {
        /* fallback só busca local */
      }
    }

    processos = processos.filter((p) => {
      const haystack = [p.nro_cnj, p.acao, p.area, p.cliente, p.ci, p.grupo_cliente]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(termo.toLowerCase()) || normalizarCnj(p.nro_cnj ?? '').includes(cnjNorm)
    })
  }

  const seen = new Set<string>()
  return processos.filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

export async function fetchJudicializadaList(
  incluirEncerrados: boolean,
): Promise<InadimplenciaJudicializadaRow[]> {
  let query = supabase
    .from('inadimplencia_judicializada_list')
    .select(LIST_SELECT)
    .order('valor_em_aberto', { ascending: false })

  if (!incluirEncerrados) {
    query = query.is('encerrado_at', null)
  }

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(parseRow)
}

export function calcularKpis(rows: InadimplenciaJudicializadaRow[]): JudicializadaKpis {
  const ativos = rows.filter((r) => !r.encerrado_at)
  const byArea = new Map<string, { valor: number; qtd: number }>()

  let totalEmAberto = 0
  let totalValorCausa = 0
  let totalLancamentoVios = 0
  for (const r of ativos) {
    totalEmAberto += r.valor_em_aberto
    totalLancamentoVios += r.valor_em_aberto_nominal
    if (r.valor_causa != null && r.valor_causa > 0) {
      totalValorCausa += r.valor_causa
    }
    const area = r.area?.trim() || 'Não informada'
    const cur = byArea.get(area) ?? { valor: 0, qtd: 0 }
    cur.valor += r.valor_em_aberto
    cur.qtd += 1
    byArea.set(area, cur)
  }

  return {
    totalEmAberto,
    totalValorCausa,
    totalLancamentoVios,
    qtdGrupos: new Set(ativos.map((r) => r.grupo_chave)).size,
    qtdProcessos: ativos.length,
    porArea: Array.from(byArea.entries())
      .map(([area, v]) => ({ area, valor: v.valor, qtd: v.qtd }))
      .sort((a, b) => b.valor - a.valor),
  }
}

export async function createJudicializada(
  input: CreateJudicializadaInput & { skipValidacaoGrupoProcesso?: boolean },
): Promise<InadimplenciaJudicializadaRow> {
  const grupoCliente = input.grupo_cliente.trim()
  if (!grupoCliente) throw new Error('Selecione um grupo.')

  await assertProcessoDisponivel(input.processo_id)
  await assertGrupoNaoNoComite(grupoCliente)
  if (!input.skipValidacaoGrupoProcesso) {
    await assertProcessoDoGrupo(input.processo_id, grupoCliente)
  }

  const valorAuto = await calcularValorAutoGrupo(grupoCliente)
  const grupoChave = buildGrupoChave(grupoCliente)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('inadimplencia_judicializada')
    .insert({
      grupo_cliente: grupoCliente,
      grupo_chave: grupoChave,
      processo_id: input.processo_id,
      nro_cnj: input.nro_cnj ?? null,
      parte_passiva: input.parte_passiva ?? null,
      valor_causa: input.valor_causa ?? null,
      status_planilha: input.status_planilha ?? null,
      andamentos_resumo: input.andamentos_resumo ?? null,
      providencias_planilha: input.providencias_planilha ?? null,
      citacao: input.citacao ?? null,
      tribunal: input.tribunal ?? null,
      tipo_acao_planilha: input.tipo_acao_planilha ?? null,
      importado_em: input.importado_de ? now : null,
      importado_de: input.importado_de ?? null,
      andamentos_fonte: input.andamentos_resumo ? 'planilha' : 'planilha',
      valor_em_aberto_auto: valorAuto,
      valor_em_aberto_ajuste: input.valor_em_aberto_ajuste ?? null,
      data_judicializacao: input.data_judicializacao ?? null,
      observacoes: input.observacoes?.trim() || null,
      created_by: input.created_by ?? null,
    } as never)
    .select('id')
    .single()

  if (error) throw error

  const { data: row, error: errRow } = await supabase
    .from('inadimplencia_judicializada_list')
    .select(LIST_SELECT)
    .eq('id', (data as { id: string }).id)
    .single()

  if (errRow) throw errRow
  const parsed = parseRow(row as Record<string, unknown>)

  if (input.andamentos_resumo?.trim()) {
    await inserirAndamentoPlanilha(parsed.id, input.processo_id, input.andamentos_resumo)
  }

  return parsed
}

export async function updateJudicializada(
  id: string,
  input: UpdateJudicializadaInput,
): Promise<InadimplenciaJudicializadaRow> {
  const { data: current, error: errCurrent } = await supabase
    .from('inadimplencia_judicializada')
    .select('grupo_cliente, encerrado_at, processo_id')
    .eq('id', id)
    .single()

  if (errCurrent) throw errCurrent
  if (!current) throw new Error('Registro não encontrado.')

  const grupoCliente = String((current as { grupo_cliente: string }).grupo_cliente)
  const encerradoAt = (current as { encerrado_at: string | null }).encerrado_at

  if (input.processo_id && input.processo_id !== (current as { processo_id?: string }).processo_id) {
    await assertProcessoDisponivel(input.processo_id, id)
    await assertProcessoDoGrupo(input.processo_id, input.grupo_cliente ?? grupoCliente)
  }

  const novoGrupo = input.grupo_cliente?.trim() ?? grupoCliente
  if (input.grupo_cliente !== undefined && !encerradoAt) {
    await assertGrupoNaoNoComite(novoGrupo)
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.grupo_cliente !== undefined) {
    patch.grupo_cliente = novoGrupo
    patch.grupo_chave = buildGrupoChave(novoGrupo)
    patch.valor_em_aberto_auto = await calcularValorAutoGrupo(novoGrupo)
  }
  if (input.processo_id !== undefined) patch.processo_id = input.processo_id
  if (input.data_judicializacao !== undefined) patch.data_judicializacao = input.data_judicializacao
  if (input.observacoes !== undefined) patch.observacoes = input.observacoes?.trim() || null
  if (input.valor_em_aberto_ajuste !== undefined) {
    patch.valor_em_aberto_ajuste = input.valor_em_aberto_ajuste
  }

  const { error } = await supabase
    .from('inadimplencia_judicializada')
    .update(patch as never)
    .eq('id', id)

  if (error) throw error

  const { data: row, error: errRow } = await supabase
    .from('inadimplencia_judicializada_list')
    .select(LIST_SELECT)
    .eq('id', id)
    .single()

  if (errRow) throw errRow
  return parseRow(row as Record<string, unknown>)
}

export async function recalcularValorAuto(id: string): Promise<InadimplenciaJudicializadaRow> {
  const { data: current, error: errCurrent } = await supabase
    .from('inadimplencia_judicializada')
    .select('grupo_cliente')
    .eq('id', id)
    .single()

  if (errCurrent) throw errCurrent
  if (!current) throw new Error('Registro não encontrado.')

  const valorAuto = await calcularValorAutoGrupo(String((current as { grupo_cliente: string }).grupo_cliente))

  const { error } = await supabase
    .from('inadimplencia_judicializada')
    .update({
      valor_em_aberto_auto: valorAuto,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) throw error

  const { data: row, error: errRow } = await supabase
    .from('inadimplencia_judicializada_list')
    .select(LIST_SELECT)
    .eq('id', id)
    .single()

  if (errRow) throw errRow
  return parseRow(row as Record<string, unknown>)
}

export async function encerrarJudicializada(id: string): Promise<void> {
  const { error } = await supabase
    .from('inadimplencia_judicializada')
    .update({
      encerrado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) throw error
}

export async function reabrirJudicializada(id: string): Promise<void> {
  const { data: current, error: errCurrent } = await supabase
    .from('inadimplencia_judicializada')
    .select('grupo_cliente, processo_id')
    .eq('id', id)
    .single()

  if (errCurrent) throw errCurrent
  if (!current) throw new Error('Registro não encontrado.')

  const row = current as { grupo_cliente: string; processo_id: string }
  await assertProcessoDisponivel(row.processo_id, id)
  await assertGrupoNaoNoComite(row.grupo_cliente)

  const { error } = await supabase
    .from('inadimplencia_judicializada')
    .update({
      encerrado_at: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) throw error
}

function normalizeNomeEmpresa(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function isGrupoEscritorio(grupo: string | null | undefined): boolean {
  const g = normalizeNomeEmpresa(grupo ?? '')
  return g.includes('bismarchi') && g.includes('pires')
}

export async function lookupProcessosPorCnj(cnj: string): Promise<ProcessoViosRow[]> {
  const { data, error } = await supabase.rpc(
    'lookup_processos_por_cnj' as never,
    { p_cnj: cnj } as never,
  )
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(parseProcesso)
}

export async function resolveGrupoFromPartePassiva(
  partePassiva: string | null,
  processo: ProcessoViosRow | null,
): Promise<string | null> {
  const parte = partePassiva?.trim()
  if (parte) {
    const parteNorm = normalizeNomeEmpresa(parte)
    const tokens = parteNorm.split(' ').filter((t) => t.length > 3)
    const termo = tokens.slice(0, 3).join(' ') || parteNorm.slice(0, 24)

    const { data, error } = await supabase
      .from('pessoas')
      .select('nome, grupo_cliente')
      .ilike('nome', `%${termo}%`)
      .not('grupo_cliente', 'is', null)
      .limit(20)

    if (!error && data?.length) {
      const rows = data as { nome: string; grupo_cliente: string | null }[]
      const exact = rows.find((r) => normalizeNomeEmpresa(r.nome) === parteNorm)
      if (exact?.grupo_cliente?.trim()) return exact.grupo_cliente.trim()

      const partial = rows.find((r) => {
        const n = normalizeNomeEmpresa(r.nome)
        return n.includes(parteNorm) || parteNorm.includes(n)
      })
      if (partial?.grupo_cliente?.trim()) return partial.grupo_cliente.trim()

      if (rows[0]?.grupo_cliente?.trim()) return rows[0].grupo_cliente.trim()
    }
  }

  if (processo?.grupo_cliente?.trim() && !isGrupoEscritorio(processo.grupo_cliente)) {
    return processo.grupo_cliente.trim()
  }

  return parte || null
}

async function fetchProcessosJaCadastrados(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('inadimplencia_judicializada')
    .select('processo_id, nro_cnj')
    .is('encerrado_at', null)

  if (error) throw error

  const set = new Set<string>()
  for (const row of (data ?? []) as { processo_id: string; nro_cnj: string | null }[]) {
    set.add(row.processo_id)
    if (row.nro_cnj) set.add(normalizarCnj(row.nro_cnj))
  }
  return set
}

export async function buildImportPreview(
  rows: PlanilhaAjuizadoRow[],
): Promise<ImportPreviewRow[]> {
  const cadastrados = await fetchProcessosJaCadastrados()
  const preview: ImportPreviewRow[] = []

  for (const row of rows) {
    let processoId: string | null = null
    let processoViosCliente: string | null = null
    let processoViosGrupo: string | null = null
    let grupoCliente: string | null = null
    let erro: string | null = null
    let status: ImportPreviewRow['status'] = 'ok'

    try {
      const processos = await lookupProcessosPorCnj(row.cnj)
      if (processos.length === 0) {
        erro = 'CNJ não encontrado na base VIOS.'
        status = 'erro'
      } else {
        const processo = processos[0]
        processoId = processo.id
        processoViosCliente = processo.cliente
        processoViosGrupo = processo.grupo_cliente
        grupoCliente = await resolveGrupoFromPartePassiva(row.partePassiva, processo)

        if (!grupoCliente) {
          erro = 'Não foi possível identificar o grupo (parte passiva / VIOS).'
          status = 'erro'
        } else if (cadastrados.has(processo.id) || cadastrados.has(row.cnjNormalizado)) {
          erro = 'Processo já cadastrado como judicializado.'
          status = 'duplicado'
        } else if (processos.length > 1) {
          status = 'aviso'
          erro = `${processos.length} processos VIOS com este CNJ — usando o primeiro.`
        } else if (
          processo.grupo_cliente &&
          grupoCliente &&
          normalizarNomeGrupo(processo.grupo_cliente) !== normalizarNomeGrupo(grupoCliente)
        ) {
          status = 'aviso'
          erro = `Grupo planilha (${grupoCliente}) difere do VIOS (${processo.grupo_cliente}).`
        }
      }
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Erro ao consultar VIOS.'
      status = 'erro'
    }

    preview.push({
      ...row,
      processoId,
      processoViosCliente,
      processoViosGrupo,
      grupoCliente,
      jaCadastrado: status === 'duplicado',
      erro,
      status,
    })
  }

  return preview
}

async function inserirAndamentoPlanilha(
  judicializadaId: string,
  processoId: string,
  descricao: string,
): Promise<void> {
  const texto = descricao.trim()
  if (!texto) return

  await supabase.from('inadimplencia_judicializada_andamentos').insert({
    judicializada_id: judicializadaId,
    processo_id: processoId,
    descricao: texto,
    fonte: 'planilha',
  } as never)
}

export async function fetchAndamentosJudicializada(
  judicializadaId: string,
): Promise<InadimplenciaJudicializadaAndamentoRow[]> {
  const { data, error } = await supabase
    .from('inadimplencia_judicializada_andamentos')
    .select('*')
    .eq('judicializada_id', judicializadaId)
    .order('data_andamento', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as Record<string, unknown>[]).map((raw) => ({
    id: String(raw.id),
    judicializada_id: String(raw.judicializada_id),
    processo_id: String(raw.processo_id),
    data_andamento: raw.data_andamento != null ? String(raw.data_andamento) : null,
    descricao: String(raw.descricao ?? ''),
    fonte: raw.fonte as InadimplenciaJudicializadaAndamentoRow['fonte'],
    vios_evento_id: raw.vios_evento_id != null ? String(raw.vios_evento_id) : null,
    vios_sync_em: raw.vios_sync_em != null ? String(raw.vios_sync_em) : null,
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  }))
}

export async function importPlanilhaAjuizados(
  rows: ImportPreviewRow[],
  options: { arquivoNome: string; createdBy?: string | null; sobrescreverDuplicados?: boolean },
): Promise<ImportPlanilhaResult> {
  const result: ImportPlanilhaResult = {
    importados: 0,
    ignorados: 0,
    erros: 0,
    detalhes: [],
  }

  for (const row of rows) {
    if (row.status === 'duplicado' && !options.sobrescreverDuplicados) {
      result.ignorados++
      result.detalhes.push({ cnj: row.cnj, ok: false, mensagem: row.erro ?? 'Duplicado' })
      continue
    }
    if (row.status === 'erro' || !row.processoId || !row.grupoCliente) {
      result.erros++
      result.detalhes.push({
        cnj: row.cnj,
        ok: false,
        mensagem: row.erro ?? 'Linha inválida',
      })
      continue
    }

    try {
      if (row.status === 'duplicado' && options.sobrescreverDuplicados) {
        const { data: existente } = await supabase
          .from('inadimplencia_judicializada')
          .select('id')
          .eq('processo_id', row.processoId)
          .is('encerrado_at', null)
          .maybeSingle()

        if (existente) {
          await supabase
            .from('inadimplencia_judicializada')
            .update({
              encerrado_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', (existente as { id: string }).id)
        }
      }

      const observacoes = [
        row.providenciasPlanilha ? `Providências: ${row.providenciasPlanilha}` : null,
        row.etiquetas ? `Etiquetas: ${row.etiquetas}` : null,
        row.acao ? `Ação planilha: ${row.acao}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      await createJudicializada({
        grupo_cliente: row.grupoCliente,
        processo_id: row.processoId,
        skipValidacaoGrupoProcesso: true,
        nro_cnj: row.cnj,
        parte_passiva: row.partePassiva,
        valor_causa: row.valorCausa,
        status_planilha: row.statusPlanilha,
        andamentos_resumo: row.andamentosPlanilha,
        providencias_planilha: row.providenciasPlanilha,
        citacao: row.citacao,
        tribunal: row.tribunal,
        tipo_acao_planilha: row.tipoAcao,
        data_judicializacao: row.dataAjuizamento,
        observacoes: observacoes || null,
        valor_em_aberto_ajuste: row.valorCausa,
        importado_de: options.arquivoNome,
        created_by: options.createdBy ?? null,
      })

      result.importados++
      result.detalhes.push({ cnj: row.cnj, ok: true, mensagem: 'Importado' })
    } catch (e) {
      result.erros++
      result.detalhes.push({
        cnj: row.cnj,
        ok: false,
        mensagem: e instanceof Error ? e.message : 'Erro ao importar',
      })
    }
  }

  return result
}

export const judicializadaService = {
  buildGrupoChave,
  calcularValorAutoGrupo,
  fetchProcessosDoGrupo,
  fetchJudicializadaList,
  calcularKpis,
  createJudicializada,
  updateJudicializada,
  recalcularValorAuto,
  encerrarJudicializada,
  reabrirJudicializada,
  lookupProcessosPorCnj,
  resolveGrupoFromPartePassiva,
  buildImportPreview,
  importPlanilhaAjuizados,
  fetchAndamentosJudicializada,
}
