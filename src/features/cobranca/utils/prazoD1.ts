/** ISO weekday: 0 = domingo, 6 = sábado */
function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function proximoDiaUtil(d: Date): Date {
  let cur = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  while (isWeekend(cur)) {
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
  }
  return cur
}

/**
 * Vencimento efetivo: se cair em sábado/domingo, prorroga para o próximo dia útil.
 * Alinhado à função SQL cobranca_vencimento_efetivo.
 */
export function cobrancaVencimentoEfetivo(
  dataVencimento: string | null | undefined,
): string | null {
  if (!dataVencimento?.trim()) return null
  return toIsoDate(proximoDiaUtil(parseIsoDate(dataVencimento.slice(0, 10))))
}

/**
 * Data-alvo da cobrança D+1: dia útil seguinte ao vencimento efetivo.
 * Ex.: venc. 31/05 (dom) → efetivo 01/06 → cobrança 02/06.
 */
export function cobrancaPrazoD1(dataVencimento: string | null | undefined): string | null {
  const efetivo = cobrancaVencimentoEfetivo(dataVencimento)
  if (!efetivo) return null
  const d = parseIsoDate(efetivo)
  const maisUm = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return toIsoDate(proximoDiaUtil(maisUm))
}
