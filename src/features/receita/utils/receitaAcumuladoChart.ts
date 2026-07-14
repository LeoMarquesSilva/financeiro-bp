import type {
  ReceitaAcumuladoChartPoint,
  ReceitaAreaChartSlice,
  ReceitaMesRow,
  ReceitaRecebidoDepartamentoRow,
} from '../types/receita.types'
import { departamentoDataKey } from './receitaColunasChart'
import { isMesFechado, isMesFuturo } from './receitaMes'

/**
 * Meta acumulada com trajetória ajustada pelo gap — fecha em R$ 10 mi no último mês.
 *
 * - Meses **fechados**: rampa original (soma de metaBase).
 * - Mês **corrente e futuros**: recebido já realizado nos fechados + metas mensais ajustadas
 *   dos meses restantes (1,4 mi + gap rateado).
 *
 * Não soma metaBase + meta ajustada no mesmo mês (isso inflava a linha para ~10,2 mi).
 */
export function metaAcumuladaPorMes(
  ano: number,
  rows: ReceitaMesRow[],
  ref = new Date(),
): Map<number, number> {
  const ordenados = [...rows].sort((a, b) => a.mes - b.mes)
  const out = new Map<number, number>()

  let metaBaseCum = 0
  let recebidoFechado = 0
  let metaRestanteAcum = 0

  for (const r of ordenados) {
    if (r.metaBase <= 0) continue

    metaBaseCum += r.metaBase

    if (isMesFechado(ano, r.mes, ref)) {
      recebidoFechado += r.recebido
      metaRestanteAcum = 0
      out.set(r.mes, metaBaseCum)
    } else {
      metaRestanteAcum += r.meta
      out.set(r.mes, recebidoFechado + metaRestanteAcum)
    }
  }

  return out
}

/** Série acumulada mês a mês (soma dos meses exibidos no dashboard). */
export function buildAcumuladoChartData(
  ano: number,
  rows: ReceitaMesRow[],
  ref = new Date(),
): ReceitaAcumuladoChartPoint[] {
  const metaPorMes = metaAcumuladaPorMes(ano, rows, ref)
  let recebidoAcumulado = 0
  let previstoAcumulado = 0

  return rows.map((r) => {
    const futuro = isMesFuturo(ano, r.mes, ref)
    const possuiMeta = r.metaBase > 0

    if (!futuro && possuiMeta) {
      recebidoAcumulado += r.recebido
    }
    if (possuiMeta) {
      previstoAcumulado += r.previsto
    }

    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      recebidoAcumulado: futuro ? null : recebidoAcumulado,
      previstoAcumulado,
      metaAcumulada: possuiMeta ? (metaPorMes.get(r.mes) ?? 0) : 0,
    }
  })
}

function pctDaMeta(valor: number | null, meta: number): number | null {
  if (valor == null) return null
  if (meta <= 0) return null
  return (valor / meta) * 100
}

/** Converte valores acumulados em % da meta acumulada do mês (meta = 100%, não exibida). */
export function toAcumuladoPercentData(
  data: ReceitaAcumuladoChartPoint[],
): ReceitaAcumuladoChartPoint[] {
  return data.map((p) => ({
    ...p,
    recebidoAcumulado: pctDaMeta(p.recebidoAcumulado, p.metaAcumulada),
    previstoAcumulado: pctDaMeta(p.previstoAcumulado, p.metaAcumulada) ?? 0,
    metaAcumulada: p.metaAcumulada > 0 ? 100 : 0,
  }))
}

/**
 * Recebido acumulado por área em % da meta acumulada (barras empilhadas).
 * Cada segmento = contribuição da área para compor o atingimento até 100% da meta.
 */
export function buildAcumuladoAreaPercentData(
  ano: number,
  rows: ReceitaMesRow[],
  deptRows: ReceitaRecebidoDepartamentoRow[],
  areaSlices: ReceitaAreaChartSlice[],
  ref = new Date(),
): ReceitaAcumuladoChartPoint[] {
  const meses = rows.map((r) => r.mes)
  const deptByMes = new Map<number, ReceitaRecebidoDepartamentoRow[]>()
  for (const d of deptRows) {
    if (!meses.includes(d.mes)) continue
    const list = deptByMes.get(d.mes) ?? []
    list.push(d)
    deptByMes.set(d.mes, list)
  }

  const acumPorDataKey = new Map<string, number>()
  for (const slice of areaSlices) {
    acumPorDataKey.set(slice.dataKey, 0)
  }

  const metaPorMes = metaAcumuladaPorMes(ano, rows, ref)
  let previstoAcumulado = 0

  return rows.map((r) => {
    const futuro = isMesFuturo(ano, r.mes, ref)
    const possuiMeta = r.metaBase > 0
    const metaAcumulada = possuiMeta ? (metaPorMes.get(r.mes) ?? 0) : 0

    if (possuiMeta) {
      previstoAcumulado += r.previsto
    }

    if (!futuro && possuiMeta) {
      for (const d of deptByMes.get(r.mes) ?? []) {
        const dataKey = departamentoDataKey(d.departamento)
        if (!acumPorDataKey.has(dataKey)) continue
        acumPorDataKey.set(dataKey, (acumPorDataKey.get(dataKey) ?? 0) + d.total)
      }
    }

    const point: ReceitaAcumuladoChartPoint = {
      mes: r.mes,
      mesLabel: r.mesLabel,
      recebidoAcumulado: null,
      previstoAcumulado: pctDaMeta(previstoAcumulado, metaAcumulada) ?? 0,
      metaAcumulada: metaAcumulada > 0 ? 100 : 0,
    }

    let recebidoTotal = 0
    for (const slice of areaSlices) {
      const acum = acumPorDataKey.get(slice.dataKey) ?? 0
      if (!futuro) {
        recebidoTotal += acum
        point[slice.dataKey] = pctDaMeta(acum, metaAcumulada)
      } else {
        point[slice.dataKey] = null
      }
    }

    point.recebidoAcumulado = futuro ? null : pctDaMeta(recebidoTotal, metaAcumulada)

    return point
  })
}
