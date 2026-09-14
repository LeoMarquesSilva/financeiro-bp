import type { TreinamentoItemRow } from '../types/eficiencia.types'
import { matchNomeChaveNaEquipe, normalizeResponsavelChave } from './responsavelMatch'

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

/** Presenças cujo colaborador está no headcount da lista/área atual. */
export function itensDaEquipe(
  itens: TreinamentoItemRow[],
  equipe: Array<{ colaborador?: string | null }>,
): TreinamentoItemRow[] {
  const keys = new Set(
    equipe
      .map((p) => normalizeResponsavelChave(String(p.colaborador ?? '')))
      .filter(Boolean),
  )
  if (keys.size === 0) return []
  return itens.filter((item) => matchNomeChaveNaEquipe(item.colaborador, keys) != null)
}

export type TreinamentoDuplicadoGrupo = {
  colaborador: string
  treinamento: string
  data: string | null
  qtd: number
}

/** Uma entrada por pessoa + treinamento + data, só linhas já marcadas. */
export function agruparTreinamentosDuplicados(
  itens: TreinamentoItemRow[],
): TreinamentoDuplicadoGrupo[] {
  const map = new Map<string, TreinamentoDuplicadoGrupo>()
  for (const item of itens) {
    if (!item.duplicado) continue
    const key = chavePresenca(item)
    if (key.startsWith('|')) continue
    const existing = map.get(key)
    if (existing) {
      existing.qtd += 1
      continue
    }
    map.set(key, {
      colaborador: item.colaborador,
      treinamento: item.treinamento?.trim() || 'Treinamento sem nome',
      data: item.data ? String(item.data).slice(0, 10) : null,
      qtd: 1,
    })
  }
  return [...map.values()].sort((a, b) =>
    a.colaborador.localeCompare(b.colaborador, 'pt-BR', { sensitivity: 'base' }),
  )
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
