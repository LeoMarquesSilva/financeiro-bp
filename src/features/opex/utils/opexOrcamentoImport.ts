import type { OpexOrcamentoImportLinha } from '../types/opex.types'

const MESES_LABEL: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  março: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
}

const COLUMN_ALIASES: Record<string, string[]> = {
  ano: ['ano', 'year'],
  mes: ['mes', 'mês', 'month'],
  grupo_conta: ['grupo macro', 'grupo_conta', 'grupo de conta', 'grupo'],
  plano_contas: ['plano mínimo', 'plano minimo', 'plano_contas', 'plano de contas', 'plano'],
  conta_numero: ['nº conta', 'no conta', 'conta_numero', 'conta'],
  titulo_ref: ['título', 'titulo', 'titulo_ref', 'referência', 'referencia', 'nº título', 'no titulo'],
  descricao: ['descrição', 'descricao', 'complemento'],
  departamento: ['departamento', 'depto', 'area', 'área'],
  valor: ['valor', 'valor (r$)', 'valor r$', 'previsto', 'orçamento', 'orcamento'],
}

export function parseValorMonetario(val: unknown): number {
  if (val == null || val === '') return 0
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const s = String(val).trim()
  if (!s) return 0
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  const normalized = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(normalized)
  if (!Number.isNaN(parsed)) return parsed
  return parseFloat(s) || 0
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function resolveMes(value: unknown): number | null {
  if (typeof value === 'number' && value >= 1 && value <= 12) return Math.trunc(value)
  const s = normalizeHeader(value)
  if (!s) return null
  const n = Number(s)
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n
  return MESES_LABEL[s] ?? null
}

function findColumnIndex(headers: string[], field: keyof typeof COLUMN_ALIASES): number {
  const aliases = COLUMN_ALIASES[field]
  return headers.findIndex((h) => aliases.some((a) => h === normalizeHeader(a) || h.includes(normalizeHeader(a))))
}

function isWideMonthHeader(header: string): number | null {
  const h = normalizeHeader(header)
  return MESES_LABEL[h] ?? null
}

export type OpexOrcamentoParseResult = {
  linhas: OpexOrcamentoImportLinha[]
  totaisPorMes: Record<number, number>
  totalGeral: number
  preview: OpexOrcamentoImportLinha[]
}

export function parseOrcamentoSheetRows(
  rows: unknown[][],
  defaultAno: number,
): OpexOrcamentoParseResult {
  if (!rows.length) {
    return { linhas: [], totaisPorMes: {}, totalGeral: 0, preview: [] }
  }

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const h = normalizeHeader(cell)
      return (
        h.includes('grupo') ||
        h.includes('plano') ||
        h === 'mes' ||
        h === 'mês' ||
        h === 'jan' ||
        h === 'janeiro'
      )
    }),
  )
  const headerIndex = headerRowIndex >= 0 ? headerRowIndex : 0
  const headers = (rows[headerIndex] ?? []).map(normalizeHeader)

  const wideMonthCols = headers
    .map((h, idx) => ({ idx, mes: isWideMonthHeader(h) }))
    .filter((c): c is { idx: number; mes: number } => c.mes != null)

  const linhas: OpexOrcamentoImportLinha[] = []

  if (wideMonthCols.length >= 3) {
    const idxGrupo = findColumnIndex(headers, 'grupo_conta')
    const idxPlano = findColumnIndex(headers, 'plano_contas')
    const idxConta = findColumnIndex(headers, 'conta_numero')
    const idxTitulo = findColumnIndex(headers, 'titulo_ref')
    const idxDesc = findColumnIndex(headers, 'descricao')
    const idxDept = findColumnIndex(headers, 'departamento')

    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? []
      const grupo = String(row[idxGrupo >= 0 ? idxGrupo : 0] ?? '').trim()
      const plano = String(row[idxPlano >= 0 ? idxPlano : 1] ?? '').trim()
      if (!grupo && !plano) continue

      for (const col of wideMonthCols) {
        const valor = parseValorMonetario(row[col.idx])
        if (valor <= 0) continue
        linhas.push({
          mes: col.mes,
          grupo_conta: grupo || 'Sem grupo',
          plano_contas: plano || 'Sem plano',
          conta_numero: idxConta >= 0 ? String(row[idxConta] ?? '').trim() : '',
          titulo_ref: idxTitulo >= 0 ? String(row[idxTitulo] ?? '').trim() : '—',
          descricao: idxDesc >= 0 ? String(row[idxDesc] ?? '').trim() : '',
          departamento: idxDept >= 0 ? String(row[idxDept] ?? '').trim() : '',
          valor,
        })
      }
    }
  } else {
    const idxAno = findColumnIndex(headers, 'ano')
    const idxMes = findColumnIndex(headers, 'mes')
    const idxGrupo = findColumnIndex(headers, 'grupo_conta')
    const idxPlano = findColumnIndex(headers, 'plano_contas')
    const idxConta = findColumnIndex(headers, 'conta_numero')
    const idxTitulo = findColumnIndex(headers, 'titulo_ref')
    const idxDesc = findColumnIndex(headers, 'descricao')
    const idxDept = findColumnIndex(headers, 'departamento')
    const idxValor = findColumnIndex(headers, 'valor')

    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r] ?? []
      const mes = resolveMes(idxMes >= 0 ? row[idxMes] : null)
      const valor = parseValorMonetario(idxValor >= 0 ? row[idxValor] : null)
      const grupo = String(row[idxGrupo >= 0 ? idxGrupo : 0] ?? '').trim()
      const plano = String(row[idxPlano >= 0 ? idxPlano : 1] ?? '').trim()
      if (!mes || valor <= 0 || (!grupo && !plano)) continue

      const anoLinha = idxAno >= 0 ? Number(row[idxAno]) : defaultAno
      if (idxAno >= 0 && anoLinha !== defaultAno) continue

      linhas.push({
        mes,
        grupo_conta: grupo || 'Sem grupo',
        plano_contas: plano || 'Sem plano',
        conta_numero: idxConta >= 0 ? String(row[idxConta] ?? '').trim() : '',
        titulo_ref: idxTitulo >= 0 ? String(row[idxTitulo] ?? '').trim() : '—',
        descricao: idxDesc >= 0 ? String(row[idxDesc] ?? '').trim() : '',
        departamento: idxDept >= 0 ? String(row[idxDept] ?? '').trim() : '',
        valor,
      })
    }
  }

  const totaisPorMes: Record<number, number> = {}
  let totalGeral = 0
  for (const l of linhas) {
    totaisPorMes[l.mes] = (totaisPorMes[l.mes] ?? 0) + l.valor
    totalGeral += l.valor
  }

  return {
    linhas,
    totaisPorMes,
    totalGeral: Math.round(totalGeral * 100) / 100,
    preview: linhas.slice(0, 12),
  }
}

export async function parseOrcamentoXlsxFile(
  file: File,
  defaultAno: number,
): Promise<OpexOrcamentoParseResult> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true, raw: true })
  const sheetName =
    wb.SheetNames.find((n) => /orçamento|orcamento|budget|opex/i.test(n)) ?? wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]
  return parseOrcamentoSheetRows(rows, defaultAno)
}

export async function exportOrcamentoBackupExcel(
  linhas: OpexOrcamentoImportLinha[],
  ano: number,
): Promise<void> {
  const XLSX = await import('xlsx')
  const rows = linhas.map((l) => ({
    Ano: ano,
    Mês: l.mes,
    'Grupo macro': l.grupo_conta,
    'Plano mínimo': l.plano_contas,
    'Nº conta': l.conta_numero ?? '',
    'Título/Referência': l.titulo_ref ?? '',
    Descrição: l.descricao ?? '',
    Departamento: l.departamento ?? '',
    'Valor (R$)': l.valor,
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Orçamento')
  XLSX.writeFile(wb, `opex-orcamento-backup-${ano}.xlsx`)
}
