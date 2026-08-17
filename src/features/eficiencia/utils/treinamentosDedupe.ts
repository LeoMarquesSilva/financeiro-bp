import type { TreinamentoItemRow } from '../types/eficiencia.types'
import { normalizeResponsavelChave } from './responsavelMatch'

function chavePresenca(row: {
  colaborador?: string | null
  treinamento?: string | null
  data?: string | null
}): string {
  return [
    normalizeResponsavelChave(String(row.colaborador ?? '')),
    String(row.treinamento ?? '')
      .trim()
      .toLocaleUpperCase('pt-BR'),
    String(row.data ?? '').slice(0, 10),
  ].join('|')
}

/** Uma linha por pessoa + treinamento + data (horas/KPI — não esconde na lista). */
export function dedupeTreinamentoItens(rows: TreinamentoItemRow[]): TreinamentoItemRow[] {
  const map = new Map<string, TreinamentoItemRow>()
  for (const row of rows) {
    const key = chavePresenca(row)
    if (!key.startsWith('|') && !map.has(key)) map.set(key, row)
  }
  return [...map.values()]
}

/** Marca cópias da mesma pessoa + treinamento + data para o gestor conferir. */
export function marcarTreinamentosDuplicados(rows: TreinamentoItemRow[]): TreinamentoItemRow[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = chavePresenca(row)
    if (key.startsWith('|')) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return rows.map((row) => ({
    ...row,
    duplicado: (counts.get(chavePresenca(row)) ?? 0) > 1,
  }))
}

export function marcarTreinamentoLinhasRacional(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = chavePresenca({
      colaborador: String(row.colaborador ?? ''),
      treinamento: row.treinamento == null ? null : String(row.treinamento),
      data: row.data == null ? null : String(row.data),
    })
    if (key.startsWith('|')) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return rows.map((row) => {
    const key = chavePresenca({
      colaborador: String(row.colaborador ?? ''),
      treinamento: row.treinamento == null ? null : String(row.treinamento),
      data: row.data == null ? null : String(row.data),
    })
    return { ...row, _duplicado: (counts.get(key) ?? 0) > 1 }
  })
}
