/**
 * Fênix no gráfico "Horas por mês" do Timesheet.
 *
 * Função pura. Recebe o mesmo array `data` que o gráfico desenha (12 meses, jan–dez),
 * então os valores da explicação são os da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixLinha, FenixPontoGrafico } from '../../../shared/fenix/fenix.types.ts'
import { formatTimesheetHoras } from '../utils/formatTimesheetHoras.ts'
import {
  FONTE_TIMESHEET,
  filtrosTimesheet,
  regrasRecorteTimesheet,
  rotuloMesTimesheet,
  type TimesheetFenixRecorte,
} from './timesheetFenix.ts'

/** Um ponto do gráfico (o rótulo do eixo é `mes`, ex.: "Jan"). */
export type TimesheetGraficoPonto = { mes: string; minutos: number; lancamentos: number }

export type TimesheetGraficoFenixContexto = {
  recorte: TimesheetFenixRecorte
  /** O array `data` do gráfico: jan–dez, na ordem. */
  data: readonly TimesheetGraficoPonto[]
  /** Totais dos cards Horas e Lançamentos (mesmo recorte). */
  totalMinutos: number
  totalLancamentos: number
}

const TELA = 'Timesheet › Horas por mês'
const inteiro = (v: number) => v.toLocaleString('pt-BR')

const REGRAS_GRAFICO = [
  'Cada barra soma os minutos dos lançamentos com data naquele mês; o rótulo e o tooltip mostram horas:minutos.',
  'Cada lançamento vira minutos inteiros (a fração de hora é arredondada para o minuto mais próximo).',
]

export function explicarGraficoTimesheetMes(
  c: TimesheetGraficoFenixContexto,
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const r = c.recorte
  const regrasMeses =
    r.meses && r.meses.length > 0 ? ['Meses fora do filtro de meses aparecem zerados no gráfico.'] : []
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) {
    const mes = ponto.indice + 1
    const share = c.totalMinutos > 0 ? (p.minutos / c.totalMinutos) * 100 : 0
    const conta: FenixLinha[] = [
      {
        rotulo: 'Horas',
        valor: formatTimesheetHoras(p.minutos),
        numero: p.minutos,
        detalhe: `${inteiro(p.minutos)} minutos`,
      },
      { rotulo: 'Lançamentos', valor: `${inteiro(p.lancamentos)} lançamentos`, numero: p.lancamentos },
      {
        rotulo: 'Parte das horas do recorte',
        valor: `${share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
        numero: share,
        tipo: 'info',
        detalhe: `${formatTimesheetHoras(p.minutos)} ÷ ${formatTimesheetHoras(c.totalMinutos)} (card Horas)`,
      },
    ]
    if (p.lancamentos > 0) {
      const media = p.minutos / p.lancamentos
      conta.push({
        rotulo: 'Minutos por lançamento',
        valor: media.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        numero: media,
        tipo: 'info',
        detalhe: 'não aparece no gráfico',
      })
    }
    return {
      tela: TELA,
      titulo: `Horas por mês · ${rotuloMesTimesheet(r.ano, mes)}`,
      valor: formatTimesheetHoras(p.minutos),
      resumo: `Horas apontadas no VIOS em ${p.mes}/${r.ano} no recorte escolhido, como no tooltip da barra.`,
      formula: 'Horas do mês = soma dos minutos dos lançamentos com data no mês',
      conta,
      filtros: [...filtrosTimesheet(r), { rotulo: 'Mês apontado', valor: rotuloMesTimesheet(r.ano, mes) }],
      regras: [...REGRAS_GRAFICO, ...regrasMeses, ...regrasRecorteTimesheet(r)],
      fonte: FONTE_TIMESHEET,
      fonteTecnica: 'timesheet_visao (por_mes, timesheet_minutos_linha) sobre a tabela timesheets',
      detalhe: 'O botão Racional (Excel) baixa os lançamentos deste recorte, um por linha.',
    }
  }

  const parcelas: FenixLinha[] = c.data
    .map((d, i) => ({ d, mes: i + 1 }))
    .filter((x) => x.d.minutos !== 0)
    .map((x, idx) => ({
      rotulo: rotuloMesTimesheet(r.ano, x.mes),
      valor: formatTimesheetHoras(x.d.minutos),
      numero: x.d.minutos,
      operador: idx === 0 ? undefined : '+',
      detalhe: `${inteiro(x.d.lancamentos)} lançamentos`,
    }))
  const somaMin = parcelas.reduce((s, l) => s + (l.numero ?? 0), 0)
  const somaLanc = c.data.reduce((s, d) => s + d.lancamentos, 0)
  const conta: FenixLinha[] = [
    ...parcelas,
    {
      rotulo: 'Horas no recorte',
      valor: formatTimesheetHoras(c.totalMinutos),
      numero: c.totalMinutos,
      operador: '=',
      tipo: 'total',
      detalhe: 'o mesmo do card Horas',
    },
    {
      rotulo: 'Lançamentos no recorte',
      valor: inteiro(c.totalLancamentos),
      numero: c.totalLancamentos,
      tipo: 'info',
      detalhe: 'o mesmo do card Lançamentos',
    },
  ]
  if (somaMin !== c.totalMinutos || somaLanc !== c.totalLancamentos) {
    conta.push({
      rotulo: 'Diferença',
      valor: formatTimesheetHoras(Math.abs(c.totalMinutos - somaMin)),
      numero: c.totalMinutos - somaMin,
      tipo: 'info',
      detalhe: `as barras somam ${formatTimesheetHoras(somaMin)} e ${inteiro(somaLanc)} lançamentos; recarregue a página se persistir`,
    })
  }
  return {
    tela: TELA,
    titulo: 'Horas por mês',
    valor: formatTimesheetHoras(c.totalMinutos),
    resumo: `Horas apontadas no VIOS em cada mês de ${r.ano}, de janeiro a dezembro. Somadas, dão o card Horas.`,
    formula: 'Horas do ano = soma das horas de cada mês',
    conta,
    filtros: filtrosTimesheet(r),
    regras: [...REGRAS_GRAFICO, ...regrasMeses, ...regrasRecorteTimesheet(r), 'Aponte uma barra para ver o mês.'],
    fonte: FONTE_TIMESHEET,
    fonteTecnica: 'timesheet_visao (por_mes) sobre a tabela timesheets',
  }
}
