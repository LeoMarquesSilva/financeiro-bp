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
  calcularInadVencidoNaoPagoMes,
  filtrarPrevistoMesItensPorCiItens,
} from '../utils/receitaPrevistoFechamento'
import {
  buildGestaoVistaArea,
  buildGestaoVistaConsolidado,
  buildGestaoVistaTotalYtd,
  enrichGestaoVistaResumoInadVencidoAno,
  mesInicioMetaGestao,
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
  const mesInicioMeta = mesInicioMetaGestao(rows)
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
    queryKey: ['receita-inadimplencia', 'gestao-vista-dashboard', ano, mesInicioMeta, mesMax],
    queryFn: () =>
      receitaInadimplenciaService.fetchDashboard({
        ano,
        mesInicio: mesInicioMeta,
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
    queryKey: ['receita-inadimplencia', 'gestao-vista-grupos-dept-periodo', ano, mesInicioMeta, mesMax],
    queryFn: () =>
      receitaInadimplenciaService.fetchGruposDepartamentoPeriodo(ano, mesInicioMeta, mesMax, true),
    enabled: areaKey != null && mesMax > 0,
  })

  const {
    data: inadVencidoAno,
    isLoading: inadVencidoLoading,
    error: inadVencidoError,
  } = useQuery({
    queryKey: ['receita', 'gestao-vista', 'inad-vencido-ano', ano, mesMax, areaKey],
    queryFn: async () => {
      const mesesAno = Array.from({ length: mesMax }, (_, i) => i + 1)
      if (!areaKey) {
        const fechamentos = await Promise.all(
          mesesAno.map((m) => receitaService.fetchPrevistoFechamentoMes(ano, m)),
        )
        return {
          valor: fechamentos.reduce((s, f) => s + f.inadimplencia_kpi, 0),
          previsto: fechamentos.reduce((s, f) => s + f.previsto, 0),
        }
      }
      const porMes = await Promise.all(
        mesesAno.map(async (m) => {
          const [prevAll, prevArea] = await Promise.all([
            receitaService.fetchPrevistoMesItens(ano, m),
            receitaService.fetchPrevistoItensPorArea(ano, m, areaKey),
          ])
          const itens = filtrarPrevistoMesItensPorCiItens(prevAll, prevArea)
          return {
            inad: calcularInadVencidoNaoPagoMes(itens, ano, m),
            previsto: itens.reduce((s, i) => s + i.valor_item, 0),
          }
        }),
      )
      return {
        valor: porMes.reduce((s, r) => s + r.inad, 0),
        previsto: porMes.reduce((s, r) => s + r.previsto, 0),
      }
    },
    enabled: mesMax > 0,
  })

  const mesesCongelados = useMemo(() => {
    const set = new Set<number>()
    for (const m of inadDashboard?.evolucao ?? []) {
      if (m.congelado) set.add(m.mes)
    }
    return set
  }, [inadDashboard])

  const { meses: mesesGestao, resumo: resumoBase } = useMemo(() => {
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

  const resumo = useMemo(() => {
    if (!resumoBase) return null
    if (!inadVencidoAno) return resumoBase
    return enrichGestaoVistaResumoInadVencidoAno(
      resumoBase,
      inadVencidoAno.valor,
      inadVencidoAno.previsto,
    )
  }, [resumoBase, inadVencidoAno])

  const totalYtd = useMemo(() => {
    if (mesesGestao.length === 0 || !resumo) return null
    return buildGestaoVistaTotalYtd(
      mesesGestao,
      resumo.mesesNoPeriodo,
      resumo.mesesMetaNoPeriodo,
      resumo.metaAcumulada,
      resumo.recebidoAtingimento,
    )
  }, [mesesGestao, resumo])

  const isLoading =
    recebidoLoading ||
    previstoLoading ||
    inadDashLoading ||
    inadDeptLoading ||
    inadVencidoLoading ||
    (areaKey != null && gruposDeptLoading)

  const error =
    recebidoError ??
    previstoError ??
    inadDashError ??
    inadDeptError ??
    inadVencidoError ??
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
