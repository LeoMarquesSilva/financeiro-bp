import type { RacionalColuna, RacionalResultado } from '../types/eficiencia.types'
import {
  EXCEL_DURACAO_NUMFMT,
  minutosParaExcelDuracao,
} from './formatTreinamentoDuracao'
import { formatRacionalCell, formatRacionalResumoLabel } from './racionalFormat'

export type RacionalExportMeta = {
  titulo: string
  periodoLabel: string
  ano: number
  areaLabel: string
  metaTexto?: string
  resultadoLabel?: string
}

function safeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function emptySummaryRow(colunas: RacionalColuna[]): Record<string, string> {
  return Object.fromEntries(colunas.map((coluna) => [coluna.label, '']))
}

function isDuracaoColuna(coluna: RacionalColuna): boolean {
  return coluna.format === 'duracao_minutos'
}

/** Converte colunas de minutos em serial Excel + `[h]:mm` para somar em pivot. */
function applyExcelDuracaoFormat(
  ws: import('xlsx').WorkSheet,
  utils: typeof import('xlsx').utils,
  durationLabels: string[],
): void {
  if (!ws['!ref'] || durationLabels.length === 0) return

  const range = utils.decode_range(ws['!ref'])
  const headerRow = range.s.r
  const labelToCol = new Map<string, number>()
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = utils.encode_cell({ r: headerRow, c })
    const label = String(ws[addr]?.v ?? '').trim()
    if (label) labelToCol.set(label, c)
  }

  const colIndexes = durationLabels
    .map((label) => labelToCol.get(label))
    .filter((c): c is number => c != null)

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    for (const c of colIndexes) {
      const addr = utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell || typeof cell.v !== 'number') continue
      cell.t = 'n'
      cell.v = minutosParaExcelDuracao(cell.v)
      cell.z = EXCEL_DURACAO_NUMFMT
    }
  }
}

function normalizeExcelGroupKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
}

function buildTreinamentoResumoRows(
  linhas: Array<Record<string, unknown>>,
): Array<Record<string, string | number>> {
  const grupos = new Map<
    string,
    {
      treinamento: string
      pessoas: Map<string, string>
      participacoes: Set<string>
      duracaoMinutos: number
    }
  >()

  for (const row of linhas) {
    const treinamento = String(row.treinamento ?? '').trim() || 'Treinamento não informado'
    const colaborador = String(row.colaborador ?? '').trim() || 'Colaborador não informado'
    const treinamentoKey = normalizeExcelGroupKey(treinamento)
    const colaboradorKey = normalizeExcelGroupKey(colaborador)
    const dataKey = String(row.data ?? '').slice(0, 10)
    const participacaoKey = `${colaboradorKey}|${dataKey}`
    const minutos = Math.max(0, Number(row.duracao_minutos) || 0)
    const grupo = grupos.get(treinamentoKey) ?? {
      treinamento,
      pessoas: new Map<string, string>(),
      participacoes: new Set<string>(),
      duracaoMinutos: 0,
    }

    grupo.pessoas.set(colaboradorKey, colaborador)
    grupo.duracaoMinutos = Math.max(grupo.duracaoMinutos, minutos)
    if (!grupo.participacoes.has(participacaoKey)) {
      grupo.participacoes.add(participacaoKey)
    }
    grupos.set(treinamentoKey, grupo)
  }

  return Array.from(grupos.values())
    .sort((a, b) =>
      a.treinamento.localeCompare(b.treinamento, 'pt-BR', { sensitivity: 'base' }),
    )
    .map((grupo) => ({
      Treinamento: grupo.treinamento,
      Participantes: grupo.pessoas.size,
      Participações: grupo.participacoes.size,
      'Duração (HH:MM)': grupo.duracaoMinutos,
      Pessoas: Array.from(grupo.pessoas.values())
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
        .join(' | '),
    }))
}

export async function exportRacionalExcel(
  colunas: RacionalColuna[],
  linhas: Array<Record<string, unknown>>,
  resumo: RacionalResultado['resumo'],
  meta: RacionalExportMeta,
): Promise<void> {
  const { blob, filename } = await buildRacionalExcelBlob(colunas, linhas, resumo, meta)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Gera o .xlsx do racional (download ou anexo de Reportar Erro). */
export async function buildRacionalExcelBlob(
  colunas: RacionalColuna[],
  linhas: Array<Record<string, unknown>>,
  resumo: RacionalResultado['resumo'],
  meta: RacionalExportMeta,
): Promise<{ blob: Blob; filename: string }> {
  const XLSX = await import('xlsx')
  const treinamentoBase =
    colunas.some((coluna) => coluna.key === 'treinamento') &&
    colunas.some((coluna) => coluna.key === 'colaborador')
  const desenvolvimentoEquipe = colunas.some((coluna) => coluna.key === 'pct_atingimento')
  const preservarNumeros = treinamentoBase || desenvolvimentoEquipe

  const duracaoLabels = colunas.filter(isDuracaoColuna).map((c) => c.label)

  const rows: Array<Record<string, string | number>> = linhas.map((row) => {
    const out: Record<string, string | number> = {}
    for (const coluna of colunas) {
      const value = row[coluna.key]
      const exportarNumero =
        typeof value === 'number' &&
        ((preservarNumeros && !isDuracaoColuna(coluna)) || isDuracaoColuna(coluna))
      out[coluna.label] = exportarNumero ? value : formatRacionalCell(value)
    }
    return out
  })

  if (meta.metaTexto || meta.resultadoLabel) {
    const kpiRow = emptySummaryRow(colunas)
    const partes: string[] = []
    if (meta.metaTexto) partes.push(meta.metaTexto)
    if (meta.resultadoLabel) partes.push(`Resultado: ${meta.resultadoLabel}`)
    kpiRow[colunas[0]?.label ?? 'KPI'] = partes.join(' · ')
    rows.push(kpiRow)
  }

  const resumoLabel = resumo != null ? formatRacionalResumoLabel(resumo) : null
  if (resumoLabel) {
    const summaryRow = emptySummaryRow(colunas)
    summaryRow[colunas[0]?.label ?? 'Total'] = resumoLabel
    rows.push(summaryRow)
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  applyExcelDuracaoFormat(ws, XLSX.utils, duracaoLabels)
  const wb = XLSX.utils.book_new()
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] }
  XLSX.utils.book_append_sheet(wb, ws, treinamentoBase ? 'Base' : 'Racional')

  if (treinamentoBase) {
    const resumoTreinamentos = buildTreinamentoResumoRows(linhas)
    const wsResumo = XLSX.utils.json_to_sheet(resumoTreinamentos)
    applyExcelDuracaoFormat(wsResumo, XLSX.utils, ['Duração (HH:MM)'])
    if (wsResumo['!ref']) wsResumo['!autofilter'] = { ref: wsResumo['!ref'] }
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo por treinamento')
  }

  const filename = [
    'racional',
    safeFilenamePart(meta.titulo),
    meta.ano,
    safeFilenamePart(meta.periodoLabel),
    safeFilenamePart(meta.areaLabel),
  ]
    .filter(Boolean)
    .join('-')

  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return {
    blob: new Blob([buffer as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename: `${filename}.xlsx`,
  }
}
