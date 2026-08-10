import type { CobrancaPainelKpiRow } from '@/features/cobranca/services/cobrancaService'
import { isTituloSaldoParcial } from '@/features/cobranca/utils/titulo'
import { mesNoFiltro, type MesFiltroEficiencia } from '../constants'

export type EfetividadeMesAgg = {
  mes: number
  total: number
  cobrados_d1: number
  pct_efetividade: number
}

/** Filtra o painel de cobrança (títulos em aberto) por ano/mês de vencimento. */
export function filtrarPainelEfetividade(
  rows: CobrancaPainelKpiRow[],
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): CobrancaPainelKpiRow[] {
  return rows.filter((r) => {
    if (isTituloSaldoParcial(r.nro_titulo)) return false
    const venc = r.data_vencimento ?? ''
    if (venc.slice(0, 4) !== String(ano)) return false
    const mes = Number(venc.slice(5, 7))
    if (!Number.isFinite(mes) || mes < 1 || mes > 12) return false
    return mesNoFiltro(mes, mesFiltro, ano)
  })
}

export function agregarEfetividade(rows: CobrancaPainelKpiRow[]): {
  total: number
  cobrados_d1: number
  pct_efetividade: number
} {
  const total = rows.length
  const cobrados_d1 = rows.filter((r) => r.tem_whatsapp_d1).length
  return {
    total,
    cobrados_d1,
    pct_efetividade: total > 0 ? (100 * cobrados_d1) / total : 100,
  }
}

/** Série mensal a partir dos títulos em aberto do painel (mesma base da aba Cobrança). */
export function serieMensalEfetividade(
  rows: CobrancaPainelKpiRow[],
  ano: number,
): EfetividadeMesAgg[] {
  const doAno = rows.filter((r) => {
    if (isTituloSaldoParcial(r.nro_titulo)) return false
    return (r.data_vencimento ?? '').slice(0, 4) === String(ano)
  })

  const porMes = new Map<number, CobrancaPainelKpiRow[]>()
  for (const r of doAno) {
    const mes = Number((r.data_vencimento ?? '').slice(5, 7))
    if (!Number.isFinite(mes) || mes < 1 || mes > 12) continue
    const list = porMes.get(mes) ?? []
    list.push(r)
    porMes.set(mes, list)
  }

  return Array.from(porMes.entries())
    .sort(([a], [b]) => a - b)
    .map(([mes, list]) => {
      const agg = agregarEfetividade(list)
      return {
        mes,
        total: agg.total,
        cobrados_d1: agg.cobrados_d1,
        pct_efetividade: agg.pct_efetividade,
      }
    })
}
