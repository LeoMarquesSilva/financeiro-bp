import { useMemo } from 'react'
import { eficienciaService } from '@/features/eficiencia/services/eficienciaService'
import { planejamentoService } from '../services/planejamentoService'
import { usePlanNps, usePlanOpsLegais, usePlanOverview, usePlanTimesheet } from './usePlanejamento'
import {
  VALOR_VAZIO,
  valorHoras,
  valoresJuridico,
  valoresOpsLegais,
  valorNps,
  type IndicadorId,
  type ValorIndicador,
} from '../utils/indicadoresOperacionais'
import { AREAS_PLANEJAMENTO, zeros12 } from '../utils/areasPlanejamento'

export type ValoresAno = Partial<Record<IndicadorId, ValorIndicador>>

/** Indicadores do escritório para o Excel (usa o cache das abas quando já carregados). */
/** O react-query está declarado sem tipos (src/vite-env.d.ts): só o que é usado aqui. */
type ClienteConsultas = {
  fetchQuery: <T>(o: { queryKey: unknown[]; queryFn: () => Promise<T>; staleTime?: number; retry?: number }) => Promise<T>
}

export async function carregarIndicadoresEscritorio(qc: ClienteConsultas, ultimoMesFechado: number): Promise<{ v25: ValoresAno; v26: ValoresAno }> {
  const STALE = 5 * 60_000
  const umAno = async (ano: number): Promise<ValoresAno> => {
    const [ov, ops, nps, ts] = await Promise.all([
      qc.fetchQuery({ queryKey: ['planejamento', 'overview', ano, ''], queryFn: () => eficienciaService.getOverview(ano, null), staleTime: STALE }),
      qc.fetchQuery({
        queryKey: ['planejamento', 'ops-legais', ano],
        queryFn: async () => {
          const [protocolo, publicacoesAnalise, publicacoesAgendamento, cadastro, antecipacao] = await Promise.all([
            eficienciaService.fetchOpsLegaisProtocoloMensal(ano),
            eficienciaService.fetchOpsLegaisPublicacoesEficMensal(ano, 'analise'),
            eficienciaService.fetchOpsLegaisPublicacoesEficMensal(ano, 'agendamento'),
            eficienciaService.fetchOpsLegaisCadastroMensal(ano),
            eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
          ])
          return { protocolo, publicacoesAnalise, publicacoesAgendamento, cadastro, antecipacao }
        },
        staleTime: STALE,
      }),
      qc
        .fetchQuery({ queryKey: ['planejamento', 'nps', ano], queryFn: () => eficienciaService.fetchNpsKpi(ano), staleTime: STALE, retry: 0 })
        .catch(() => null),
      qc.fetchQuery({ queryKey: ['planejamento', 'timesheet', ano], queryFn: () => planejamentoService.timesheetMensal(ano), staleTime: STALE }),
    ])
    const horas = zeros12()
    for (const r of ts) {
      if (AREAS_PLANEJAMENTO.some((a) => a.key === r.area_key) && r.mes >= 1 && r.mes <= ultimoMesFechado) horas[r.mes - 1] += r.horas
    }
    return {
      ...valoresJuridico(ov),
      ...valoresOpsLegais(ops),
      ...(nps && !nps.unavailable ? { nps: valorNps(nps.nps) } : {}),
      horas_timesheet: valorHoras(horas),
    }
  }
  const [v25, v26] = await Promise.all([umAno(2025), umAno(2026)])
  return { v25, v26 }
}

/**
 * Indicadores operacionais de 2025 e 2026 para o escritório (areaKey = 'escritorio') ou uma área do
 * planejamento. Ops Legais e NPS só existem no escritório. Horas do timesheet: mesmos meses nos dois anos.
 */
export function useIndicadoresOperacionais(areaKey: string, ultimoMesFechado: number) {
  const area = AREAS_PLANEJAMENTO.find((a) => a.key === areaKey)
  const eficienciaArea = areaKey === 'escritorio' ? null : area?.eficienciaArea ?? null
  const temJuridico = areaKey === 'escritorio' || eficienciaArea != null
  const ov25 = usePlanOverview(2025, eficienciaArea, temJuridico)
  const ov26 = usePlanOverview(2026, eficienciaArea, temJuridico)
  const ops25 = usePlanOpsLegais(2025)
  const ops26 = usePlanOpsLegais(2026)
  const nps25 = usePlanNps(2025)
  const nps26 = usePlanNps(2026)
  const ts25 = usePlanTimesheet(2025)
  const ts26 = usePlanTimesheet(2026)

  const valores = useMemo(() => {
    const horas = (rows: typeof ts25.data) => {
      const porMes = zeros12()
      for (const r of rows ?? []) {
        const conta = areaKey === 'escritorio' ? AREAS_PLANEJAMENTO.some((a) => a.key === r.area_key) : r.area_key === areaKey
        if (conta && r.mes >= 1 && r.mes <= ultimoMesFechado) porMes[r.mes - 1] += r.horas
      }
      return valorHoras(porMes)
    }
    const montar = (
      ov: typeof ov25.data,
      ops: typeof ops25.data,
      nps: typeof nps25.data,
      ts: typeof ts25.data,
    ): ValoresAno => ({
      ...(ov ? valoresJuridico(ov) : {}),
      ...(areaKey === 'escritorio' && ops ? valoresOpsLegais(ops) : {}),
      ...(areaKey === 'escritorio' && nps && !nps.unavailable ? { nps: valorNps(nps.nps) } : {}),
      horas_timesheet: horas(ts),
    })
    return {
      v25: montar(ov25.data, ops25.data, nps25.data, ts25.data),
      v26: montar(ov26.data, ops26.data, nps26.data, ts26.data),
    }
  }, [areaKey, ultimoMesFechado, ov25.data, ov26.data, ops25.data, ops26.data, nps25.data, nps26.data, ts25.data, ts26.data])

  const consultas = [ov25, ov26, ops25, ops26, ts25, ts26]
  return {
    ...valores,
    vazio: VALOR_VAZIO,
    isLoading: consultas.some((q) => q.isLoading),
    error: consultas.find((q) => q.error)?.error ?? null,
    npsCarregando: nps25.isLoading || nps26.isLoading,
  }
}
