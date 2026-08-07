import type {
  GestaoPdiDetalheRow,
  GestaoPdiMesRow,
  RacionalResultado,
  TurnoverAnualRow,
  TurnoverDesligamentoRow,
} from './eficiencia.types'
import type { AmostraChamadoItem, AmostraEstratoResumo } from '../utils/amostraChamados'

export type IndicadoresResultadoMes = {
  ano: number
  mes: number
  slaProtocolo: RacionalResultado
  eficienciaProtocolo: RacionalResultado
  agendamento: RacionalResultado
  vistagemRisco: RacionalResultado
  vistagemNormal: RacionalResultado
  desenvolvimento: RacionalResultado
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
