/**
 * Rateio de um título de receita sem área entre as áreas (% com até 2 casas, soma 100).
 * Mesmas regras da RPC `planejamento_rateio_titulos_salvar`. Sem imports com alias (roda no node --test).
 */

export type LinhaRateio = { area_key: string; pct: number }

const cent = (v: number) => Math.round(v * 100)

export function somaPct(linhas: readonly LinhaRateio[]): number {
  return linhas.reduce((s, l) => s + cent(l.pct), 0) / 100
}

/** Valida o rateio; lista vazia é válida (apaga o rateio do título). */
export function validarRateio(linhas: readonly LinhaRateio[]): { ok: true } | { ok: false; motivo: string } {
  if (linhas.length === 0) return { ok: true }
  if (linhas.some((l) => !l.area_key)) return { ok: false, motivo: 'Escolha a área de cada linha.' }
  if (new Set(linhas.map((l) => l.area_key)).size !== linhas.length) return { ok: false, motivo: 'A mesma área aparece mais de uma vez.' }
  if (linhas.some((l) => !(l.pct > 0) || l.pct > 100)) return { ok: false, motivo: 'Cada % precisa ser maior que 0 e no máximo 100.' }
  const soma = somaPct(linhas)
  if (soma !== 100) {
    const falta = Math.round((100 - soma) * 100) / 100
    return { ok: false, motivo: falta > 0 ? `Falta distribuir ${fmtPct(falta)}.` : `Passou ${fmtPct(-falta)} de 100%.` }
  }
  return { ok: true }
}

/** Divide 100% igualmente entre as áreas (2 casas; a última fica com a sobra para somar 100). */
export function dividirIgual(areas: readonly string[]): LinhaRateio[] {
  if (areas.length === 0) return []
  const parte = Math.floor(10000 / areas.length)
  return areas.map((a, i) => ({ area_key: a, pct: (i === areas.length - 1 ? 10000 - parte * (areas.length - 1) : parte) / 100 }))
}

/** Valor de cada área num título (valor × %). */
export function valorPorArea(valor: number, linhas: readonly LinhaRateio[]): number[] {
  return linhas.map((l) => (valor * l.pct) / 100)
}

/** Arredonda o % para 2 casas e limita entre 0 e 100. */
export function normalizarPct(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, Math.round(v * 100) / 100))
}

function fmtPct(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}
