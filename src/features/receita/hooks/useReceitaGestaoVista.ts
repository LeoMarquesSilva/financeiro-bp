import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { mesMaxDisponivelInadimplencia } from '../constants'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import { receitaService } from '../services/receitaService'
import type { GestaoVistaMesRow, GestaoVistaResumo, ReceitaMesRow } from '../types/receita.types'
import type {
  ReceitaInadimplenciaDepartamentoMes,
  ReceitaInadimplenciaEvolucaoMes,
} from '../types/receitaInadimplencia.types'
import { findMetaAreaSlice, type ReceitaMetaAreaSlice } from '../utils/departamentoAreaCores'
import { inadimplenciaAreaPeriodo } from '../utils/receitaInadimplenciaAreaFilter'
import {
  buildGestaoVistaArea,
  buildGestaoVistaConsolidado,
  buildGestaoVistaTotalYtd,
} from '../utils/receitaGestaoVista'

export type UseReceitaGestaoVistaResult = {
  meses: GestaoVistaMesRow[]
  resumo: GestaoVistaResumo | null
  totalYtd: GestaoVistaMesRow | null
  areaSelecionada: ReceitaMetaAreaSlice | null
  isLoading: boolean
  error: Error | null
}

export function useReceitaGestaoVista(
  ano: number,
  rows: ReceitaMesRow[],
  areaKey: string | null,
  metaAreaSlices: ReceitaMetaAreaSlice[],
): UseReceitaGestaoVistaResult {
  const meses = useMemo(() => rows.map((r) => r.mes), [rows])
  const mesMax = mesMaxDisponivelInadimplencia(ano)
  const areaSelecionada = areaKey ? findMetaAreaSlice(metaAreaSlices, areaKey) : null

  const {
    data: deptRecebido,
    isLoading: recebidoLoading,
    error: recebidoError,
  } = useQuery({
    queryKey: ['receita', 'gestao-vista', 'recebido-departamento', ano],
    queryFn: () => receitaService.fetchRecebidoPorDepartamento(ano),
    enabled: meses.length > 0,
  })

  const {
    data: deptPrevisto,
    isLoading: previstoLoading,
    error: previstoError,
  } = useQuery({
    queryKey: ['receita', 'gestao-vista', 'previsto-departamento', ano],
    queryFn: () => receitaService.fetchPrevistoPorDepartamento(ano),
    enabled: meses.length > 0,
  })

  const {
    data: inadDashboard,
    isLoading: inadDashLoading,
    error: inadDashError,
  } = useQuery({
    queryKey: ['receita-inadimplencia', 'gestao-vista-dashboard', ano, mesMax],
    queryFn: () =>
      receitaInadimplenciaService.fetchDashboard({
        ano,
        mesInicio: 1,
        mesFim: mesMax,
      }),
    enabled: mesMax > 0,
  })

  const {
    data: inadDeptPorMes,
    isLoading: inadDeptLoading,
    error: inadDeptError,
  } = useQuery({
    queryKey: ['receita-inadimplencia', 'gestao-vista-dept-mes', ano, meses],
    queryFn: async () => {
      const entries = await Promise.all(
        meses.map(async (mes) => {
          const deptRows = await receitaInadimplenciaService.fetchDepartamentosMes(ano, mes)
          return [mes, deptRows] as const
        }),
      )
      return Object.fromEntries(entries) as Record<number, ReceitaInadimplenciaDepartamentoMes[]>
    },
    enabled: meses.length > 0,
  })

  const {
    data: gruposDeptPeriodo,
    isLoading: gruposDeptLoading,
    error: gruposDeptError,
  } = useQuery({
    queryKey: ['receita-inadimplencia', 'gestao-vista-grupos-dept-periodo', ano, mesMax],
    queryFn: () =>
      receitaInadimplenciaService.fetchGruposDepartamentoPeriodo(ano, 1, mesMax, true),
    enabled: areaKey != null && mesMax > 0,
  })

  const mesesCongelados = useMemo(() => {
    const set = new Set<number>()
    for (const m of inadDashboard?.evolucao ?? []) {
      if (m.congelado) set.add(m.mes)
    }
    return set
  }, [inadDashboard])

  const { meses: mesesGestao, resumo } = useMemo(() => {
    if (!inadDashboard || mesMax <= 0) {
      return { meses: [] as GestaoVistaMesRow[], resumo: null as GestaoVistaResumo | null }
    }

    if (areaKey && areaSelecionada && deptRecebido && deptPrevisto && inadDeptPorMes) {
      const inadPeriodo =
        gruposDeptPeriodo != null
          ? inadimplenciaAreaPeriodo(gruposDeptPeriodo, areaKey)
          : 0
      const built = buildGestaoVistaArea(
        rows,
        deptRecebido,
        deptPrevisto,
        inadDeptPorMes,
        mesesCongelados,
        areaKey,
        areaSelecionada.pct,
        inadPeriodo,
        ano,
      )
      return built
    }

    const evolucao: ReceitaInadimplenciaEvolucaoMes[] = inadDashboard.evolucao
    const built = buildGestaoVistaConsolidado(
      rows,
      evolucao,
      inadDashboard.valor_total_periodo,
      evolucao.filter((m) => m.mes <= mesMax).reduce((s, m) => s + (m.previsto ?? 0), 0),
      ano,
    )
    return built
  }, [
    inadDashboard,
    mesMax,
    areaKey,
    areaSelecionada,
    deptRecebido,
    deptPrevisto,
    inadDeptPorMes,
    mesesCongelados,
    gruposDeptPeriodo,
    rows,
    ano,
  ])

  const totalYtd = useMemo(() => {
    if (mesesGestao.length === 0 || !resumo) return null
    return buildGestaoVistaTotalYtd(mesesGestao, resumo.mesesNoPeriodo)
  }, [mesesGestao, resumo])

  const isLoading =
    recebidoLoading ||
    previstoLoading ||
    inadDashLoading ||
    inadDeptLoading ||
    (areaKey != null && gruposDeptLoading)

  const error =
    recebidoError ??
    previstoError ??
    inadDashError ??
    inadDeptError ??
    gruposDeptError ??
    null

  return {
    meses: mesesGestao,
    resumo,
    totalYtd,
    areaSelecionada,
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
  }
}
