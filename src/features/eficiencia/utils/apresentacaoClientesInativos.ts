import { MESES_NOME } from '@/features/receita/constants'

/** Planilha Controladoria em `public/team`. */
export const CLIENTES_INATIVOS_XLSX_URL = '/team/CLIENTES%20INATIVOS.xlsx'

export type ClienteInativoMesRow = {
  mes: number
  mesLabel: string
  qtd: number
  /** Nomes curtos do grupo (sem prefixo "Grupo "). */
  grupos: string[]
}

export type ClientesInativosAno = {
  ano: number
  mensal: ClienteInativoMesRow[]
  mensalAtivo: ClienteInativoMesRow[]
  total: number
}

function parseDataSaida(v: unknown, XLSX: typeof import('xlsx')): Date | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return new Date(d.y, d.m - 1, d.d)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    let y = Number(m[3])
    if (y < 100) y += 2000
    // Planilha vem em M/D/YY (Excel US).
    return new Date(y, Number(m[1]) - 1, Number(m[2]))
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function shortGrupo(g: string): string {
  return g.replace(/^Grupo\s+/i, '').trim()
}

/**
 * Clientes inativados a partir da planilha Controladoria.
 * Conta 1× por grupo_cliente na 1ª DATA SAÍDA do ano (categoria Cliente inativo).
 */
export async function fetchClientesInativosAno(ano: number): Promise<ClientesInativosAno> {
  const XLSX = await import('xlsx')
  const res = await fetch(CLIENTES_INATIVOS_XLSX_URL)
  if (!res.ok) {
    throw new Error(`Não foi possível carregar CLIENTES INATIVOS.xlsx (${res.status})`)
  }
  const buf = await res.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName =
    wb.SheetNames.find((n) => n.toUpperCase().includes('INATIV')) ?? wb.SheetNames[0]
  if (!sheetName) throw new Error('Planilha de clientes inativos sem abas')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
    defval: null,
    raw: true,
  })

  /** chave grupo → 1ª saída no ano */
  const byGrupo = new Map<string, { label: string; dt: Date }>()
  for (const r of rows) {
    const grupo = String(r['Grupo Cliente'] ?? '').trim()
    if (!grupo) continue
    const cat = String(r['Categoria'] ?? '')
      .trim()
      .toLowerCase()
    if (cat && cat !== 'cliente inativo') continue
    const dt = parseDataSaida(r['DATA SAÍDA'], XLSX)
    if (!dt || dt.getFullYear() !== ano) continue
    const key = grupo.toLowerCase()
    const prev = byGrupo.get(key)
    if (!prev || dt < prev.dt) {
      byGrupo.set(key, { label: shortGrupo(grupo), dt })
    }
  }

  const buckets = new Map<number, string[]>()
  for (const { label, dt } of byGrupo.values()) {
    const mes = dt.getMonth() + 1
    const list = buckets.get(mes) ?? []
    list.push(label)
    buckets.set(mes, list)
  }

  const mensal: ClienteInativoMesRow[] = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const grupos = (buckets.get(mes) ?? []).slice().sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return {
      mes,
      mesLabel: MESES_NOME[i] ?? String(mes),
      qtd: grupos.length,
      grupos,
    }
  })

  const mensalAtivo = mensal.filter((m) => m.qtd > 0)
  const total = mensal.reduce((s, m) => s + m.qtd, 0)

  return { ano, mensal, mensalAtivo, total }
}
