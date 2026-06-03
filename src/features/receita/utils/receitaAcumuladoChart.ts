import type { ReceitaAcumuladoChartPoint, ReceitaMesRow } from '../types/receita.types'
import { isMesFuturo } from './receitaMes'

/** Série acumulada mês a mês (soma dos meses exibidos no dashboard). */
export function buildAcumuladoChartData(
  ano: number,
  rows: ReceitaMesRow[],
  ref = new Date(),
): ReceitaAcumuladoChartPoint[] {
  let recebidoAcumulado = 0
  let previstoAcumulado = 0
  let metaAcumulada = 0

  return rows.map((r) => {
    const futuro = isMesFuturo(ano, r.mes, ref)

    if (!futuro) {
      recebidoAcumulado += r.recebido
    }
    previstoAcumulado += r.previsto
    metaAcumulada += r.meta

    return {
      mes: r.mes,
      mesLabel: r.mesLabel,
      recebidoAcumulado: futuro ? null : recebidoAcumulado,
      previstoAcumulado,
      metaAcumulada,
    }
  })
}
