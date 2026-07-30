import { cnjValidoParaImportacao, normalizarCnj } from './cnjUtils'

const HEADER_ALIASES: Record<string, string[]> = {
  acao: ['ação', 'acao'],
  cnj: ['n.º cnj', 'nº cnj', 'no cnj', 'numero cnj', 'número cnj', 'cnj'],
  data_ajuizamento: ['data de ajuizamento', 'data ajuizamento'],
  tipo_acao: ['tipo de ação', 'tipo de acao', 'tipo acao'],
  tribunal: ['tribunal'],
  valor_causa: ['valor da causa', 'valor causa'],
  parte_passiva: ['parte passiva', 'parte passiva '],
  status: ['status'],
  citacao: ['citação', 'citacao'],
  andamentos: ['principais andamentos', 'andamentos'],
  providencias: ['providências a adotar', 'providencias a adotar', 'providencias'],
  etiquetas: ['etiquetas'],
}

export type PlanilhaAjuizadoRow = {
  linha: number
  acao: string | null
  cnj: string
  cnjNormalizado: string
  dataAjuizamento: string | null
  tipoAcao: string | null
  tribunal: string | null
  valorCausa: number | null
  partePassiva: string | null
  statusPlanilha: string | null
  citacao: string | null
  andamentosPlanilha: string | null
  providenciasPlanilha: string | null
  etiquetas: string | null
}

export type ImportPreviewStatus = 'ok' | 'erro' | 'aviso' | 'ignorado' | 'duplicado'

export type ImportPreviewRow = PlanilhaAjuizadoRow & {
  processoId: string | null
  processoViosCliente: string | null
  processoViosGrupo: string | null
  grupoCliente: string | null
  jaCadastrado: boolean
  erro: string | null
  status: ImportPreviewStatus
}

export type ImportPlanilhaResult = {
  importados: number
  ignorados: number
  erros: number
  detalhes: { cnj: string; ok: boolean; mensagem: string }[]
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function findColumnIndex(headers: string[], field: keyof typeof HEADER_ALIASES): number {
  const aliases = HEADER_ALIASES[field]
  return headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)))
}

export function parseValorMonetario(val: unknown): number | null {
  if (val == null || val === '') return null
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const s = String(val).trim()
  if (!s || s === '-') return null
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || null
  }
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

function parseExcelDate(val: unknown): string | null {
  if (val == null || val === '') return null
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  if (typeof val === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + val * 86400000)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) {
    const [, dd, mm, yyyy] = br
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function detectHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const headers = (rows[i] ?? []).map(normalizeHeader)
    if (findColumnIndex(headers, 'cnj') >= 0) return i
  }
  return -1
}

function cellStr(val: unknown): string | null {
  const s = String(val ?? '').trim()
  return s || null
}

export function parsePlanilhaAjuizadosFromWorkbook(
  workbook: import('xlsx').WorkBook,
  XLSX: typeof import('xlsx'),
): PlanilhaAjuizadoRow[] {
  const sheetName =
    workbook.SheetNames.find((n) => normalizeHeader(n).includes('ajuizado')) ??
    workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  const headerIdx = detectHeaderRowIndex(rows)
  if (headerIdx < 0) return []

  const headers = (rows[headerIdx] ?? []).map(normalizeHeader)
  const idx = {
    acao: findColumnIndex(headers, 'acao'),
    cnj: findColumnIndex(headers, 'cnj'),
    dataAjuizamento: findColumnIndex(headers, 'data_ajuizamento'),
    tipoAcao: findColumnIndex(headers, 'tipo_acao'),
    tribunal: findColumnIndex(headers, 'tribunal'),
    valorCausa: findColumnIndex(headers, 'valor_causa'),
    partePassiva: findColumnIndex(headers, 'parte_passiva'),
    status: findColumnIndex(headers, 'status'),
    citacao: findColumnIndex(headers, 'citacao'),
    andamentos: findColumnIndex(headers, 'andamentos'),
    providencias: findColumnIndex(headers, 'providencias'),
    etiquetas: findColumnIndex(headers, 'etiquetas'),
  }

  if (idx.cnj < 0) return []

  const out: PlanilhaAjuizadoRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const cnjRaw = cellStr(row[idx.cnj])
    if (!cnjRaw || !cnjValidoParaImportacao(cnjRaw)) continue

    out.push({
      linha: i + 1,
      acao: idx.acao >= 0 ? cellStr(row[idx.acao]) : null,
      cnj: cnjRaw.replace(/\s+/g, ''),
      cnjNormalizado: normalizarCnj(cnjRaw),
      dataAjuizamento: idx.dataAjuizamento >= 0 ? parseExcelDate(row[idx.dataAjuizamento]) : null,
      tipoAcao: idx.tipoAcao >= 0 ? cellStr(row[idx.tipoAcao]) : null,
      tribunal: idx.tribunal >= 0 ? cellStr(row[idx.tribunal]) : null,
      valorCausa: idx.valorCausa >= 0 ? parseValorMonetario(row[idx.valorCausa]) : null,
      partePassiva: idx.partePassiva >= 0 ? cellStr(row[idx.partePassiva]) : null,
      statusPlanilha: idx.status >= 0 ? cellStr(row[idx.status]) : null,
      citacao: idx.citacao >= 0 ? cellStr(row[idx.citacao]) : null,
      andamentosPlanilha: idx.andamentos >= 0 ? cellStr(row[idx.andamentos]) : null,
      providenciasPlanilha: idx.providencias >= 0 ? cellStr(row[idx.providencias]) : null,
      etiquetas: idx.etiquetas >= 0 ? cellStr(row[idx.etiquetas]) : null,
    })
  }

  return out
}

export async function parsePlanilhaAjuizadosFile(file: File): Promise<PlanilhaAjuizadoRow[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  return parsePlanilhaAjuizadosFromWorkbook(workbook, XLSX)
}
