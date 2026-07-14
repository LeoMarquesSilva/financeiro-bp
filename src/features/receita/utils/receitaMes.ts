/** Mês ainda não ocorreu no calendário (ex.: julho quando estamos em junho do mesmo ano). */
export function isMesFuturo(ano: number, mes: number, ref = new Date()): boolean {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  if (ano > y) return true
  if (ano < y) return false
  return mes > m
}

/** Mês já encerrado (anterior ao mês corrente no calendário). */
export function isMesFechado(ano: number, mes: number, ref = new Date()): boolean {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  if (ano < y) return true
  if (ano > y) return false
  return mes < m
}

/** Recebido: null em mês futuro (ainda não houve pagamento); zero mantém zero em mês passado/atual. */
export function valorRecebidoGrafico(
  valor: number,
  ano: number,
  mes: number,
  ref = new Date(),
): number | null {
  return isMesFuturo(ano, mes, ref) ? null : valor
}

type MetaRow = { mes: number; meta: number; metaBase?: number; recebido: number }

/**
 * Rebalanceia a meta dos meses restantes quando um mês **fechado** não atinge a meta.
 *
 * Fórmula: cada mês futuro = metaBase + (gap do mês fechado) ÷ meses restantes.
 * Ex.: junho meta R$ 1,4 mi não atingida → julho = R$ 1,4 mi + faltou(jun) ÷ 6.
 *
 * - Meses fechados mantêm a meta que vigorou naquele mês.
 * - Gaps de vários meses fechados se acumulam nos meses futuros.
 * - Excedente (mês acima da meta) não reduz metas futuras.
 * - A meta **mensal** ajustada sobe (1,4 mi + gap rateado); a meta **acumulada** no gráfico
 *   usa recebido fechado + metas restantes e fecha em R$ 10 mi.
 *
 * Use `meta` (ajustada) para atingimento mensal e comparativo.
 * Use `metaBase` (fixa) para o teto anual em KPIs.
 */
export function aplicarMetaRebalanceada<T extends MetaRow>(
  rows: T[],
  _metaAnual: number,
  ano: number,
  ref = new Date(),
): T[] {
  const ordenados = [...rows].sort((a, b) => a.mes - b.mes)
  const comMeta = ordenados.filter((r) => r.meta > 0)
  if (comMeta.length === 0) return rows

  const metaEfetiva = new Map<number, number>(
    comMeta.map((r) => [r.mes, r.metaBase ?? r.meta]),
  )

  for (const r of comMeta) {
    if (!isMesFechado(ano, r.mes, ref)) break

    const metaMes = metaEfetiva.get(r.mes) ?? r.meta
    if (metaMes <= 0) continue

    const faltou = metaMes - r.recebido
    if (faltou <= 0) continue

    const futuros = comMeta.filter((f) => f.mes > r.mes)
    if (futuros.length === 0) continue

    const parcela = faltou / futuros.length
    for (const f of futuros) {
      metaEfetiva.set(f.mes, (metaEfetiva.get(f.mes) ?? 0) + parcela)
    }
  }

  return rows.map((r) => ({
    ...r,
    metaBase: r.metaBase ?? (r.meta > 0 ? r.meta : 0),
    meta: r.meta > 0 ? (metaEfetiva.get(r.mes) ?? r.meta) : 0,
  }))
}

/**
 * @deprecated Alias legado — use {@link aplicarMetaRebalanceada}.
 */
export function aplicarMetaComRateioDeGap<T extends MetaRow>(
  rows: T[],
  metaAnual: number,
  ano: number,
  ref = new Date(),
): T[] {
  return aplicarMetaRebalanceada(rows, metaAnual, ano, ref)
}
