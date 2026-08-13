/** Texto e comparação de meta — mesma lógica da OverviewKpiHeatRow. */

export function formatMetaPct(meta: number): string {
  return meta % 1 === 0 ? String(meta) : meta.toFixed(2)
}

export function resolveMetaTexto(
  meta: number,
  metaLabel?: string,
  metasPorMes?: (number | null)[],
): string {
  if (metaLabel) return metaLabel

  const metasDefinidas = (metasPorMes ?? []).filter((m): m is number => m != null)
  if (metasDefinidas.length === 0) {
    return `Meta ${formatMetaPct(meta)}%`
  }

  const labels = new Set(metasDefinidas.map(formatMetaPct))
  if (labels.size === 1) {
    return `Meta ${formatMetaPct(metasDefinidas[0])}%`
  }

  return 'Meta D-1 (variável)'
}

/** `minimo` = value ≥ meta; `maximo` = value ≤ meta (ex.: inadimplência). */
export type MetaComparacaoKpi = 'minimo' | 'maximo'

export function atingiuMetaKpi(
  value: number | null,
  meta: number,
  comparacao: MetaComparacaoKpi = 'minimo',
): boolean | null {
  if (value == null) return null
  if (!Number.isFinite(meta)) return null
  return comparacao === 'maximo' ? value <= meta : value >= meta
}

export function resultadoKpiTextClass(atingiu: boolean | null): string {
  if (atingiu === null) return 'text-slate-700'
  return atingiu ? 'text-emerald-600' : 'text-red-600'
}

export function resultadoKpiBadgeClass(atingiu: boolean | null): string {
  if (atingiu === null) return 'bg-slate-50 text-slate-700'
  return atingiu ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
}
