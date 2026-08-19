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
    const grupo = grupos.get(treinamentoKey) ?? {
      treinamento,
      pessoas: new Map<string, string>(),
      participacoes: new Set<string>(),
      duracaoMinutos: 0,
    }

    grupo.pessoas.set(colaboradorKey, colaborador)
    grupo.duracaoMinutos = Math.max(
      grupo.duracaoMinutos,
      Math.max(0, Number(row.duracao_minutos) || 0),
    )
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
      'Duração do treinamento (min)': grupo.duracaoMinutos,
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

  const rows: Array<Record<string, string | number>> = linhas.map((row) => {
    const out: Record<string, string | number> = {}
    for (const coluna of colunas) {
      const value = row[coluna.key]
      out[coluna.label] =
        preservarNumeros && typeof value === 'number' ? value : formatRacionalCell(value)
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
  if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] }
  XLSX.utils.book_append_sheet(wb, ws, treinamentoBase ? 'Base' : 'Racional')

  if (treinamentoBase) {
    const resumoTreinamentos = buildTreinamentoResumoRows(linhas)
    const wsResumo = XLSX.utils.json_to_sheet(resumoTreinamentos)
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
