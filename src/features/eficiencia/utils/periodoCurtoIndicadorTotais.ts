import type { RacionalResultado } from '../types/eficiencia.types'
import { pctSlaVistagemAcumulado } from './slaVistagemKpi'

type Resumo = NonNullable<RacionalResultado['resumo']>

export type SlaProtocoloPeriodoTotais = {
  qtdD1: number
  qtdFatal: number
  qtdTotal: number
  qtdExcludente: number
  pctGeral: number
}

export type EficienciaProtocoloPeriodoTotais = {
  semInconsistencia: number
  total: number
  inconsistentes: number
  pctGeral: number
}

export type AgendamentoPeriodoTotais = {
  dentroPrazo: number
  foraPrazo: number
  total: number
  pctGeral: number | null
}

export type VistagemPeriodoTotais = {
  vistadoD1: number
  total: number
  pctGeral: number | null
}

export type OpsCadastroPeriodoTotais = {
  dentro: number
  fora: number
  total: number
  pct: number | null
}

export function totaisSlaProtocoloFromResumo(resumo: Resumo): SlaProtocoloPeriodoTotais {
  const qtdD1 = resumo.qtd_d1 ?? 0
  const qtdFatal = resumo.qtd_fatal ?? 0
  const qtdTotal = qtdD1 + qtdFatal
  return {
    qtdD1,
    qtdFatal,
    qtdTotal,
    qtdExcludente: resumo.qtd_excludente ?? 0,
    pctGeral: qtdTotal > 0 ? (qtdD1 / qtdTotal) * 100 : 0,
  }
}

export function totaisEficienciaProtocoloFromResumo(
  resumo: Resumo,
): EficienciaProtocoloPeriodoTotais {
  const semInconsistencia = resumo.qtd_eficiencia ?? 0
  const inconsistentes = resumo.qtd_inconsistencia ?? 0
  const total = resumo.qtd_total ?? semInconsistencia + inconsistentes
  return {
    semInconsistencia,
    total,
    inconsistentes,
    pctGeral: total > 0 ? (semInconsistencia / total) * 100 : 0,
  }
}

export function totaisAgendamentoFromResumo(resumo: Resumo): AgendamentoPeriodoTotais {
  const dentroPrazo = resumo.qtd_eficiencia ?? 0
  const foraPrazo = resumo.qtd_inconsistencia ?? 0
  const total = resumo.qtd_total ?? dentroPrazo + foraPrazo
  return {
    dentroPrazo,
    foraPrazo,
    total,
    pctGeral: total > 0 ? (dentroPrazo / total) * 100 : null,
  }
}

export function totaisVistagemFromResumo(resumo: Resumo): VistagemPeriodoTotais {
  const vistadoD1 = resumo.qtd_vistado_sim ?? 0
  const total = resumo.qtd_total ?? vistadoD1 + (resumo.qtd_vistado_nao ?? 0)
  return {
    vistadoD1,
    total,
    pctGeral: pctSlaVistagemAcumulado(vistadoD1, total),
  }
}

export function totaisOpsCadastroFromResumo(resumo: Resumo): OpsCadastroPeriodoTotais {
  const dentro = resumo.qtd_eficiencia ?? 0
  const fora = resumo.qtd_inconsistencia ?? 0
  const total = resumo.qtd_total ?? dentro + fora
  return {
    dentro,
    fora,
    total,
    pct: total > 0 ? (dentro / total) * 100 : null,
  }
}

export function pctOpsPublicacaoFromResumo(resumo: Resumo): number {
  const ok = resumo.qtd_eficiencia ?? 0
  const nok = resumo.qtd_inconsistencia ?? 0
  const total = ok + nok
  return total > 0 ? (ok / total) * 100 : 0
}
