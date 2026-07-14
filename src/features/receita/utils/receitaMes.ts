/** Mês ainda não ocorreu no calendário (ex.: julho quando estamos em junho do mesmo ano). */
export function isMesFuturo(ano: number, mes: number, ref = new Date()): boolean {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  if (ano > y) return true
  if (ano < y) return false
  return mes > m
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

type MetaRow = { mes: number; meta: number; recebido: number }

/**
 * Rateia em cascata o gap (meta − recebido) de meses já fechados que não bateram a meta,
 * somando o valor faltante — dividido em partes iguais — à meta dos meses restantes do ano.
 *
 * Ex.: meta mensal R$1,42mi; junho recebeu R$1,185mi (faltou ~R$236mil) → esse valor é somado
 * (dividido igualmente) à meta de jul-dez. Se julho, já com a meta reforçada, também não bater,
 * o novo gap é rateado entre ago-dez, e assim por diante até dezembro. Excedente (mês que superou
 * a meta) não é descontado dos meses futuros — só o que faltou é repassado.
 */
export function aplicarMetaComRateioDeGap<T extends MetaRow>(
  rows: T[],
  ano: number,
  ref = new Date(),
): T[] {
  const ordenados = [...rows].sort((a, b) => a.mes - b.mes)
  const metaAjustada = new Map<number, number>(ordenados.map((r) => [r.mes, r.meta]))

  for (let i = 0; i < ordenados.length; i++) {
    const r = ordenados[i]
    if (isMesFuturo(ano, r.mes, ref)) break

    const metaMes = metaAjustada.get(r.mes) ?? r.meta
    if (metaMes <= 0) continue
    const faltou = metaMes - r.recebido
    if (faltou <= 0) continue

    const mesesRestantes = ordenados.filter(
      (futuro) => futuro.mes > r.mes && (metaAjustada.get(futuro.mes) ?? futuro.meta) > 0,
    )
    if (mesesRestantes.length === 0) continue

    const parcela = faltou / mesesRestantes.length
    for (const futuro of mesesRestantes) {
      metaAjustada.set(futuro.mes, (metaAjustada.get(futuro.mes) ?? futuro.meta) + parcela)
    }
  }

  return rows.map((r) => ({ ...r, meta: metaAjustada.get(r.mes) ?? r.meta }))
}
