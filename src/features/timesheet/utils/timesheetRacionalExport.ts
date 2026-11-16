import type { TimesheetRacionalLinha } from '../services/timesheetService'
import { formatTimesheetHoras } from './formatTimesheetHoras'

export type TimesheetRacionalMeta = {
  ano: number
  areaLabel: string
  mesesLabel: string | null
  responsavel: string | null
}

const COLUNAS: Array<{ header: string; width: number; numFmt?: string }> = [
  { header: 'Data', width: 11, numFmt: 'dd/mm/yyyy' },
  { header: 'Área', width: 22 },
  { header: 'Responsável', width: 30 },
  { header: 'Tipo de apontamento', width: 22 },
  { header: 'Tipo de tarefa', width: 32 },
  { header: 'Grupo', width: 28 },
  { header: 'Cliente', width: 36 },
  { header: 'CI', width: 10 },
  { header: 'Nº processo', width: 26 },
  { header: 'Parte contrária', width: 30 },
  { header: 'Descrição', width: 60 },
  { header: 'Hora inicial', width: 11 },
  { header: 'Hora final', width: 11 },
  { header: 'Horas', width: 9, numFmt: '[h]:mm' },
]

function safeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** `yyyy-mm-dd` → Date em UTC (o Excel grava a data sem deslocar fuso). */
function isoDateToExcel(value: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!m) return null
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

function ciValue(ci: string | number | null): string | number | null {
  if (ci == null) return null
  const raw = String(ci).trim()
  if (!raw) return null
  return /^\d+$/.test(raw) ? Number(raw) : raw
}

export async function exportTimesheetRacionalExcel(
  linhas: TimesheetRacionalLinha[],
  meta: TimesheetRacionalMeta,
): Promise<void> {
  // exceljs comprime bem melhor que o xlsx: o ano inteiro fica em ~8 MB em vez de ~30 MB.
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Racional', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLUNAS.map((c) => ({ header: c.header, width: c.width, style: c.numFmt ? { numFmt: c.numFmt } : {} }))
  ws.getRow(1).font = { bold: true }

  let totalMinutos = 0
  for (const linha of linhas) {
    const minutos = Number(linha.minutos ?? 0)
    totalMinutos += minutos
    ws.addRow([
      isoDateToExcel(linha.data),
      linha.area,
      linha.colaborador,
      linha.tipo_apontamento,
      linha.tipo_tarefa,
      linha.grupo_cliente,
      linha.cliente,
      ciValue(linha.ci),
      linha.nro_processo,
      linha.parte_contraria,
      linha.descricao,
      linha.hora_inicial,
      linha.hora_final,
      minutos / (24 * 60),
    ])
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS.length } }

  const filtros = wb.addWorksheet('Filtros')
  filtros.columns = [{ width: 14 }, { width: 40 }]
  filtros.addRows([
    ['Filtro', 'Valor'],
    ['Ano', meta.ano],
    ['Área', meta.areaLabel],
    ['Meses', meta.mesesLabel ?? 'Ano inteiro'],
    ['Responsável', meta.responsavel ?? 'Todos'],
    ['Lançamentos', linhas.length],
    ['Horas', formatTimesheetHoras(totalMinutos)],
  ])
  filtros.getRow(1).font = { bold: true }

  const filename = [
    'racional-timesheet',
    meta.ano,
    safeFilenamePart(meta.areaLabel),
    meta.mesesLabel ? safeFilenamePart(meta.mesesLabel) : null,
    meta.responsavel ? safeFilenamePart(meta.responsavel) : null,
  ]
    .filter(Boolean)
    .join('-')

  const buffer = await wb.xlsx.writeBuffer({ useSharedStrings: true, useStyles: true })
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
