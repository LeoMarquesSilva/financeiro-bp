import type {
  GestaoPdiDetalheRow,
  GestaoPdiMesRow,
  RacionalResultado,
  TreinamentosAnualRow,
  TurnoverAnualRow,
  TurnoverDesligamentoRow,
} from './eficiencia.types'
import type { AmostraChamadoItem, AmostraEstratoResumo } from '../utils/amostraChamados'

export type IndicadoresResultadoFinanceiroMes = {
  receitaBrutaPct: number | null
  recebido: number | null
  meta: number | null
  inadimplenciaPct: number | null
  inadimplencia: number | null
  previsto: number | null
}

export type IndicadoresResultadoMes = {
  ano: number
  mes: number
  financeiro: IndicadoresResultadoFinanceiroMes | null
  slaProtocolo: RacionalResultado
  eficienciaProtocolo: RacionalResultado
  agendamento: RacionalResultado
  vistagemRisco: RacionalResultado
  vistagemNormal: RacionalResultado
  desenvolvimento: RacionalResultado
  /** Acumulado anual (horas + meta) — mesmo KPI do Overview. */
  desenvolvimentoAnual: TreinamentosAnualRow | null
  gestaoPdiMensal: GestaoPdiMesRow | null
  gestaoPdiDetalhe: GestaoPdiDetalheRow[]
  retencaoAnual: TurnoverAnualRow | null
  retencaoTalentos: RacionalResultado
  retencaoDesligamentos: TurnoverDesligamentoRow[]
  /** FATAL excludentes com flag de amostra. */
  detalhesExcludentes: AmostraChamadoItem[]
  amostraChamados: AmostraChamadoItem[]
  resumoAmostra: AmostraEstratoResumo[]
}
