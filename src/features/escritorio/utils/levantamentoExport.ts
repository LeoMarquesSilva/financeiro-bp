import { formatHorasDuracao } from '@/shared/utils/format'
import { stripJsonArrayDecorators } from '@/features/eficiencia/utils/textFormat'
import {
  BLOCO_LABELS,
  type LevantamentoBloco,
  type LevantamentoColuna,
  type LevantamentoFiltros,
  type LevantamentoResumo,
  type LevantamentoRacional,
  escritorioLevantamentoService,
} from '../services/escritorioLevantamentoService'
import {
  formatHorasTimesheetHHMM,
  formatHorasTimesheetLinhaHHMM,
  formatHorasTimesheetTotalHHMM,
  minutosTimesheetLinha,
  parseHorasDecimaisValor,
} from './timesheetHorasExcel'

function safeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  const raw = String(value)
  if (raw.includes('[') || raw.includes('"')) {
    return stripJsonArrayDecorators(raw)
  }
  return raw
}

function rowsFromRacional(racional: LevantamentoRacional): Array<Record<string, string>> {
  const isTimesheet = racional.bloco === 'timesheet'
  let totalMinutos = 0

  const rows = racional.linhas.map((row) => {
    const out: Record<string, string> = {}
    for (const col of racional.colunas) {
      if (isTimesheet && col.key === 'total_horas_decimal') {
        const horas = parseHorasDecimaisValor(row[col.key])
        const minutos = minutosTimesheetLinha(horas)
        totalMinutos += minutos
        out['Horas (HH:MM)'] = formatHorasTimesheetLinhaHHMM(horas)
        out[col.label] = cellToString(row[col.key])
      } else {
        out[col.label] = cellToString(row[col.key])
      }
    }
    return out
  })

  if (isTimesheet && rows.length > 0) {
    const totalRow: Record<string, string> = {}
    for (const col of racional.colunas) {
      if (col.key === 'total_horas_decimal') {
        totalRow['Horas (HH:MM)'] = formatHorasTimesheetHHMM(totalMinutos)
        totalRow[col.label] = ''
      } else if (col.key === 'data') {
        totalRow[col.label] = 'TOTAL'
      } else {
        totalRow[col.label] = ''
      }
    }
    rows.push(totalRow)
  }

  return rows
}

export async function exportLevantamentoRacionalExcel(
  racional: LevantamentoRacional,
  meta: { titulo: string; filtros: LevantamentoFiltros },
): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = rowsFromRacional(racional)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Racional')

  const filename = [
    'escritorio',
    safeFilenamePart(meta.titulo),
    meta.filtros.dataInicio,
    meta.filtros.dataFim,
    meta.filtros.grupos.length ? safeFilenamePart(meta.filtros.grupos.join('_').slice(0, 40)) : null,
    meta.filtros.area ? safeFilenamePart(meta.filtros.area) : null,
  ]
    .filter(Boolean)
    .join('-')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export async function exportLevantamentoRelatorioCompleto(
  resumo: LevantamentoResumo,
  filtros: LevantamentoFiltros,
): Promise<{ truncado: boolean }> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  let truncado = false

  const resumoRows = [
    { Indicador: 'Publicações', Valor: resumo.publicacoes_total },
    {
      Indicador: 'Timesheet — horas',
      Valor: formatHorasDuracao(resumo.timesheet_horas),
    },
    {
      Indicador: 'Timesheet — horas (HH:MM)',
      Valor: formatHorasTimesheetTotalHHMM(resumo.timesheet_horas),
    },
    { Indicador: 'Timesheet — apontamentos', Valor: resumo.timesheet_apontamentos },
    { Indicador: 'Processos (estoque)', Valor: resumo.processos_total },
    { Indicador: 'Tarefas VIOS', Valor: resumo.tarefas_total },
    { Indicador: 'Data início', Valor: filtros.dataInicio },
    { Indicador: 'Data fim', Valor: filtros.dataFim },
    { Indicador: 'Grupo', Valor: filtros.grupos.length ? filtros.grupos.join('; ') : 'Todos' },
    { Indicador: 'Área', Valor: filtros.area ?? 'Todas' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), 'Resumo')

  const blocos: LevantamentoBloco[] = ['publicacoes', 'timesheet', 'processos', 'tarefas']

  for (const bloco of blocos) {
    const racional = await escritorioLevantamentoService.fetchRacional(bloco, filtros, {
      limit: 5000,
    })
    if (racional.truncado) truncado = true
    const sheetName = BLOCO_LABELS[bloco].slice(0, 28)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsFromRacional(racional)), sheetName)
  }

  const filename = [
    'escritorio-levantamento',
    filtros.dataInicio,
    filtros.dataFim,
    filtros.grupos.length ? safeFilenamePart(filtros.grupos.join('_').slice(0, 40)) : null,
    filtros.area ? safeFilenamePart(filtros.area) : null,
  ]
    .filter(Boolean)
    .join('-')

  XLSX.writeFile(wb, `${filename}.xlsx`)
  return { truncado }
}

export function formatRacionalCell(
  value: unknown,
  bloco?: LevantamentoBloco,
  colKey?: string,
): string {
  if (bloco === 'timesheet' && colKey === 'total_horas_decimal') {
    return formatHorasTimesheetLinhaHHMM(parseHorasDecimaisValor(value))
  }
  return cellToString(value)
}

export function emptyColunas(): LevantamentoColuna[] {
  return []
}
