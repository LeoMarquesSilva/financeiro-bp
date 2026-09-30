import { supabase } from '@/lib/supabaseClient'
import { unifyGrupoOptions } from '../utils/levantamentoAreas'

export type LevantamentoBloco =
  | 'publicacoes'
  | 'timesheet'
  | 'processos'
  | 'tarefas'

export type LevantamentoFiltros = {
  dataInicio: string
  dataFim: string
  /** Um ou mais grupos; vazio = todos. */
  grupos: string[]
  area: string | null
}

export type LevantamentoColuna = { key: string; label: string }

export type LevantamentoTipoRow = {
  tipo_agendamento: string
  qtd: number
}

/** Quebra Principal × Recurso × Incidente (escritorio_processo_tipo_vinculo). */
export type LevantamentoTipoVinculoQtd = {
  principal: number
  recurso: number
  incidente: number
  nao_classificado: number
}

export type LevantamentoSituacaoRow = LevantamentoTipoVinculoQtd & {
  situacao: string
  qtd: number
}

export type LevantamentoDepartamentoRow = LevantamentoTipoVinculoQtd & {
  departamento: string
  qtd: number
}

export type LevantamentoTipoProcessoRow = {
  tipo: string
  qtd: number
}

export type LevantamentoResumo = {
  publicacoes_total: number
  timesheet_apontamentos: number
  timesheet_horas: number
  processos_total: number
  processos_por_situacao: LevantamentoSituacaoRow[]
  processos_por_tipo: LevantamentoTipoProcessoRow[]
  processos_por_departamento: LevantamentoDepartamentoRow[]
  agendamento_total: number
  agendamento_por_tipo: LevantamentoTipoRow[]
  tarefas_total: number
  tarefas_prazos: number
  tarefas_providencias: number
  timesheet_data_max: string | null
  data_inicio: string
  data_fim: string
  grupos: string[]
  area: string | null
}

export type LevantamentoRacional = {
  bloco: LevantamentoBloco
  colunas: LevantamentoColuna[]
  linhas: Array<Record<string, unknown>>
  total: number
  truncado: boolean
  limit: number
}

export type LevantamentoFiltrosOpcoes = {
  timesheetDataMax: string | null
  timesheetDataMin: string | null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
}

function parseTipoVinculoQtd(o: Record<string, unknown>): LevantamentoTipoVinculoQtd {
  return {
    principal: Number(o.principal ?? 0),
    recurso: Number(o.recurso ?? 0),
    incidente: Number(o.incidente ?? 0),
    nao_classificado: Number(o.nao_classificado ?? 0),
  }
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

function parseResumo(raw: unknown): LevantamentoResumo {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    publicacoes_total: Number(o.publicacoes_total ?? 0),
    timesheet_apontamentos: Number(o.timesheet_apontamentos ?? 0),
    timesheet_horas: Number(o.timesheet_horas ?? 0),
    processos_total: Number(o.processos_total ?? 0),
    processos_por_situacao: asRecordArray(o.processos_por_situacao).map((s) => ({
      situacao: String(s.situacao ?? ''),
      qtd: Number(s.qtd ?? 0),
      ...parseTipoVinculoQtd(s),
    })),
    processos_por_tipo: asRecordArray(o.processos_por_tipo).map((t) => ({
      tipo: String(t.tipo ?? ''),
      qtd: Number(t.qtd ?? 0),
    })),
    processos_por_departamento: asRecordArray(o.processos_por_departamento).map((d) => ({
      departamento: String(d.departamento ?? ''),
      qtd: Number(d.qtd ?? 0),
      ...parseTipoVinculoQtd(d),
    })),
    agendamento_total: Number(o.agendamento_total ?? 0),
    agendamento_por_tipo: Array.isArray(o.agendamento_por_tipo)
      ? (o.agendamento_por_tipo as LevantamentoTipoRow[])
      : [],
    tarefas_total: Number(o.tarefas_total ?? 0),
    tarefas_prazos: Number(o.tarefas_prazos ?? 0),
    tarefas_providencias: Number(o.tarefas_providencias ?? 0),
    timesheet_data_max: o.timesheet_data_max ? String(o.timesheet_data_max).slice(0, 10) : null,
    data_inicio: String(o.data_inicio ?? ''),
    data_fim: String(o.data_fim ?? ''),
    grupos: asStringArray(o.grupos),
    area: (o.area as string | null) ?? null,
  }
}

function parseRacional(raw: unknown): LevantamentoRacional {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    bloco: String(o.bloco ?? 'publicacoes') as LevantamentoBloco,
    colunas: Array.isArray(o.colunas) ? (o.colunas as LevantamentoColuna[]) : [],
    linhas: Array.isArray(o.linhas) ? (o.linhas as Array<Record<string, unknown>>) : [],
    total: Number(o.total ?? 0),
    truncado: Boolean(o.truncado),
    limit: Number(o.limit ?? 5000),
  }
}

function rpcGrupos(filtros: LevantamentoFiltros): string[] | null {
  return filtros.grupos.length > 0 ? filtros.grupos : null
}

export const escritorioLevantamentoService = {
  async fetchFiltrosOpcoes(): Promise<LevantamentoFiltrosOpcoes> {
    const { data, error } = await supabase.rpc(
      'escritorio_levantamento_filtros_opcoes' as never,
    )
    if (error) throw error
    const o = (data ?? {}) as Record<string, unknown>
    return {
      timesheetDataMax: o.timesheet_data_max
        ? String(o.timesheet_data_max).slice(0, 10)
        : null,
      timesheetDataMin: o.timesheet_data_min
        ? String(o.timesheet_data_min).slice(0, 10)
        : null,
    }
  },

  async fetchGruposPeriodo(dataInicio: string, dataFim: string): Promise<string[]> {
    const { data, error } = await supabase.rpc(
      'escritorio_levantamento_grupos_periodo' as never,
      {
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      } as never,
    )
    if (error) throw error
    return unifyGrupoOptions(asStringArray(data))
  },

  async fetchResumo(filtros: LevantamentoFiltros): Promise<LevantamentoResumo> {
    const { data, error } = await supabase.rpc('escritorio_levantamento_resumo_v2' as never, {
      p_data_inicio: filtros.dataInicio,
      p_data_fim: filtros.dataFim,
      p_grupos: rpcGrupos(filtros),
      p_area: filtros.area,
    } as never)
    if (error) throw error
    return parseResumo(data)
  },

  async fetchRacional(
    bloco: LevantamentoBloco,
    filtros: LevantamentoFiltros,
    opts?: { tipoAgendamento?: string | null; limit?: number },
  ): Promise<LevantamentoRacional> {
    const { data, error } = await supabase.rpc('escritorio_levantamento_racional_v2' as never, {
      p_bloco: bloco,
      p_data_inicio: filtros.dataInicio,
      p_data_fim: filtros.dataFim,
      p_grupos: rpcGrupos(filtros),
      p_area: filtros.area,
      p_tipo_agendamento: opts?.tipoAgendamento ?? null,
      p_limit: opts?.limit ?? 5000,
    } as never)
    if (error) throw error
    return parseRacional(data)
  },
}

export const BLOCO_LABELS: Record<LevantamentoBloco, string> = {
  publicacoes: 'Publicações',
  timesheet: 'Timesheet',
  processos: 'Processos',
  tarefas: 'Tarefas VIOS',
}

export function defaultMesCorrente(): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const inicio = new Date(y, m, 1)
  const fim = new Date(y, m + 1, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { dataInicio: iso(inicio), dataFim: iso(fim) }
}
