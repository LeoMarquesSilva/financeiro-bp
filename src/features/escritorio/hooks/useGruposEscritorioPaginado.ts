import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GrupoEscritorio, FiltroFinanceiro, OrdenacaoEscritorio } from '../services/escritorioService'
import {
  fetchGruposResumo,
  fetchContagemCiPorGrupo,
  fetchHorasPorGrupo,
  fetchEmpresasPorGrupos,
  buildGruposEscritorioParaPagina,
  GRUPO_SEM_NOME,
  type GrupoResumoRow,
} from '../services/escritorioService'

const STALE_TIME_MS = 30 * 60 * 1000
const DEFAULT_PAGE_SIZE = 12

export interface FiltrosEscritorio {
  busca: string
  filtroFinanceiro: FiltroFinanceiro
  minValor: number
  ordenacao: OrdenacaoEscritorio
}

function aplicaFiltroFinanceiroResumo(r: GrupoResumoRow, filtro: FiltroFinanceiro): boolean {
  switch (filtro) {
    case 'em_atraso':
      return r.valor_em_atraso > 0
    case 'a_vencer':
      return r.valor_aberto - r.valor_em_atraso > 0
    case 'em_aberto':
      return r.valor_aberto > 0
    case 'com_pago':
      return r.valor_pago > 0
    default:
      return true
  }
}

function passaFiltroMinimoResumo(r: GrupoResumoRow, filtro: FiltroFinanceiro, minValor: number): boolean {
  if (minValor <= 0) return true
  switch (filtro) {
    case 'em_atraso':
      return r.valor_em_atraso >= minValor
    case 'a_vencer':
      return r.valor_aberto - r.valor_em_atraso >= minValor
    case 'em_aberto':
      return r.valor_aberto >= minValor
    case 'com_pago':
      return r.valor_pago >= minValor
    default:
      return true
  }
}

function ordenaResumo(list: GrupoResumoRow[], ordenacao: OrdenacaoEscritorio): GrupoResumoRow[] {
  const display = (r: GrupoResumoRow) => (r.grupo_cliente === '' ? GRUPO_SEM_NOME : r.grupo_cliente)
  const listCopy = [...list]
  const aVencer = (r: GrupoResumoRow) => r.valor_aberto - r.valor_em_atraso
  switch (ordenacao) {
    case 'atraso':
      return listCopy.sort((a, b) => b.valor_em_atraso - a.valor_em_atraso || display(a).localeCompare(display(b)))
    case 'a_vencer':
      return listCopy.sort((a, b) => aVencer(b) - aVencer(a) || display(a).localeCompare(display(b)))
    case 'aberto':
      return listCopy.sort((a, b) => b.valor_aberto - a.valor_aberto || display(a).localeCompare(display(b)))
    case 'pago':
      return listCopy.sort((a, b) => b.valor_pago - a.valor_pago || display(a).localeCompare(display(b)))
    default:
      return listCopy.sort((a, b) => display(a).localeCompare(display(b)))
  }
}

export function useGruposEscritorioPaginado(filtros: FiltrosEscritorio, pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1)

  const { data: resumoData, error: resumoError, isLoading: loadingResumo, isFetching: fetchingResumo, refetch: refetchResumo } = useQuery({
    queryKey: ['escritorio', 'resumo'],
    queryFn: async () => {
      const [resumo, contagens, horas] = await Promise.all([
        fetchGruposResumo(),
        fetchContagemCiPorGrupo(),
        fetchHorasPorGrupo(),
      ])
      const contagemByGrupo = new Map(contagens.map((c) => [c.grupo_cliente, c]))
      return { resumo, contagemByGrupo, horasPorGrupo: horas }
    },
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: true,
  })

  const filtrado = useMemo(() => {
    if (!resumoData?.resumo) return []
    const b = filtros.busca.toLowerCase().trim()
    let list = resumoData.resumo.filter((r: GrupoResumoRow) => {
      const nome = r.grupo_cliente === '' ? GRUPO_SEM_NOME : r.grupo_cliente
      return !b || nome.toLowerCase().includes(b)
    })
    list = list.filter((r: GrupoResumoRow) => aplicaFiltroFinanceiroResumo(r, filtros.filtroFinanceiro))
    list = list.filter((r: GrupoResumoRow) => passaFiltroMinimoResumo(r, filtros.filtroFinanceiro, filtros.minValor))
    return ordenaResumo(list, filtros.ordenacao)
  }, [resumoData?.resumo, filtros.busca, filtros.filtroFinanceiro, filtros.minValor, filtros.ordenacao])

  const totalCount = filtrado.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const resumoPage = useMemo(
    () => filtrado.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtrado, safePage, pageSize],
  )
  const groupKeys = useMemo(() => resumoPage.map((r) => r.grupo_cliente), [resumoPage])

  const { data: empresas, isLoading: loadingEmpresas, isFetching: fetchingEmpresas } = useQuery({
    queryKey: ['escritorio', 'empresas', safePage, groupKeys.join(',')],
    queryFn: () => fetchEmpresasPorGrupos(groupKeys),
    enabled: resumoData != null && groupKeys.length > 0,
    staleTime: STALE_TIME_MS,
  })

  const grupos: GrupoEscritorio[] = useMemo(() => {
    if (!resumoData || !empresas) return []
    return buildGruposEscritorioParaPagina(
      resumoPage,
      empresas,
      resumoData.contagemByGrupo,
      resumoData.horasPorGrupo,
    )
  }, [resumoData, empresas, resumoPage])

  const totais = useMemo(() => {
    let aVencer = 0
    let emAtraso = 0
    let emAberto = 0
    let pago = 0
    let countAtraso = 0
    let countAVencer = 0
    let countAberto = 0
    let countPago = 0
    for (const r of filtrado) {
      const vA = r.valor_aberto - r.valor_em_atraso
      aVencer += vA
      emAtraso += r.valor_em_atraso
      emAberto += r.valor_aberto
      pago += r.valor_pago
      if (r.valor_em_atraso > 0) countAtraso++
      if (vA > 0) countAVencer++
      if (r.valor_aberto > 0) countAberto++
      if (r.valor_pago > 0) countPago++
    }
    return { aVencer, emAtraso, emAberto, pago, countAtraso, countAVencer, countAberto, countPago }
  }, [filtrado])

  useEffect(() => {
    if (page > totalPages && totalPages >= 1) setPage(totalPages)
  }, [page, totalPages])

  return {
    grupos,
    totalCount,
    totalPages,
    page: safePage,
    setPage,
    pageSize,
    totais,
    loading: loadingResumo,
    fetchingResumo,
    loadingEmpresas,
    fetchingEmpresas,
    error: resumoError ? (resumoError as Error).message ?? 'Erro ao carregar dados.' : null,
    refetch: refetchResumo,
  }
}
