import type { RacionalColuna, RacionalResultado } from '../types/eficiencia.types'
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

  const rows: Array<Record<string, string>> = linhas.map((row) => {
    const out: Record<string, string> = {}
    for (const coluna of colunas) {
      out[coluna.label] = formatRacionalCell(row[coluna.key])
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
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Racional')

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
