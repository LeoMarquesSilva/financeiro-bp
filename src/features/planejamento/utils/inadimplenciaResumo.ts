/**
 * Inadimplência do ano para servir de referência à meta de 2027.
 *
 * Duas medidas (as duas aparecem no painel, porque respondem perguntas diferentes):
 * - No fechamento do mês: o que estava em aberto quando cada mês fechou (valor congelado do painel de
 *   Inadimplência). A média é ponderada pelo previsto: Σ inadimplência dos meses ÷ Σ previsto.
 * - Em aberto hoje: o acumulado do painel (por grupo de cliente) dos títulos vencidos no período que
 *   ainda não foram pagos. É menor, porque parte do atraso é paga depois do fechamento.
 *
 * Sem imports com alias: roda no node --test.
 */
import type { PlanInadimplenciaPeriodoRow, PlanInadimplenciaRow } from '../types.ts'

export type ResumoInadimplencia = {
  /** Meses fechados usados (1..mesFim). */
  meses: number[]
  /** Σ inadimplência no fechamento ÷ Σ previsto dos meses (%). */
  mediaFechamentoPct: number | null
  /** Média simples dos % de cada mês. */
  mediaSimplesPct: number | null
  /** Acumulado do período ainda em aberto hoje ÷ previsto do período (%). */
  emAbertoHojePct: number | null
  inadimplenciaFechamento: number
  emAbertoHoje: number | null
  previsto: number
}

export function resumoInadimplencia(
  mensal: readonly PlanInadimplenciaRow[] | undefined,
  periodo: readonly PlanInadimplenciaPeriodoRow[] | undefined,
  ultimoMes: number,
): ResumoInadimplencia {
  const porMes = new Map<number, { inad: number; previsto: number }>()
  for (const r of mensal ?? []) {
    if (r.mes < 1 || r.mes > ultimoMes) continue
    const cur = porMes.get(r.mes) ?? { inad: 0, previsto: 0 }
    cur.inad += r.inadimplencia
    // O previsto do mês é do escritório e vem repetido em cada área.
    cur.previsto = r.previsto_mes
    porMes.set(r.mes, cur)
  }
  const meses = [...porMes.keys()].filter((m) => (porMes.get(m)?.previsto ?? 0) > 0).sort((a, b) => a - b)
  const inadimplenciaFechamento = meses.reduce((s, m) => s + (porMes.get(m)?.inad ?? 0), 0)
  const previsto = meses.reduce((s, m) => s + (porMes.get(m)?.previsto ?? 0), 0)
  const pcts = meses.map((m) => ((porMes.get(m)?.inad ?? 0) / (porMes.get(m)?.previsto ?? 1)) * 100)
  const esc = (periodo ?? []).find((r) => r.area_key === 'escritorio')
  return {
    meses,
    mediaFechamentoPct: previsto > 0 ? (inadimplenciaFechamento / previsto) * 100 : null,
    mediaSimplesPct: pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : null,
    emAbertoHojePct: esc && esc.previsto > 0 ? (esc.inadimplencia / esc.previsto) * 100 : null,
    inadimplenciaFechamento,
    emAbertoHoje: esc ? esc.inadimplencia : null,
    previsto,
  }
}
