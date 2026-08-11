import { toPriMaiuscula } from '@/features/eficiencia/utils/textFormat'

/** Corrige rótulos conhecidos e aplica PriMaiuscula. */
export function canonicalizeAreaLabel(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  const lower = trimmed.toLocaleLowerCase('pt-BR')
  if (lower === 'distressd deals' || lower === 'distressed deals') {
    return 'Distressed Deals'
  }
  return toPriMaiuscula(trimmed)
}

function preferLabel(prev: string, nextRaw: string, nextLabel: string): string {
  const nextAllCaps = nextRaw === nextRaw.toLocaleUpperCase('pt-BR')
  const prevAllCaps = prev === prev.toLocaleUpperCase('pt-BR')
  if (prevAllCaps && !nextAllCaps) return nextLabel
  if (prev !== nextLabel && nextLabel === toPriMaiuscula(nextRaw)) return nextLabel
  return prev
}

/** Unifica áreas duplicadas por casing (Cível/CÍVEL). */
export function unifyAreaOptions(areas: string[]): string[] {
  const map = new Map<string, string>()
  for (const raw of areas) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLocaleLowerCase('pt-BR')
    const label = canonicalizeAreaLabel(trimmed)
    const prev = map.get(key)
    if (!prev) map.set(key, label)
    else map.set(key, preferLabel(prev, trimmed, label))
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Unifica grupos duplicados por casing (Grupo BPP / Grupo Bpp). */
export function unifyGrupoOptions(grupos: string[]): string[] {
  const map = new Map<string, string>()
  for (const raw of grupos) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLocaleLowerCase('pt-BR')
    const label = toPriMaiuscula(trimmed)
    const prev = map.get(key)
    if (!prev) map.set(key, label)
    else map.set(key, preferLabel(prev, trimmed, label))
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/** Intervalo do mês que contém a data ISO (YYYY-MM-DD). */
export function mesContainingIso(iso: string): { dataInicio: string; dataFim: string } {
  const [y, m] = iso.split('-').map(Number)
  const inicio = new Date(y, m - 1, 1)
  const fim = new Date(y, m, 0)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { dataInicio: fmt(inicio), dataFim: fmt(fim) }
}
