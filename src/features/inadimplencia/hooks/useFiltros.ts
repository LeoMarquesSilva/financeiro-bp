import { useState, useMemo } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import type { FiltrosInadimplencia, ListagemParams, OrderByInadimplencia, PrioridadeTipo } from '../types/inadimplencia.types'
import type { InadimplenciaClasse } from '@/lib/database.types'

const DEFAULT_FILTROS: FiltrosInadimplencia = {
  busca: '',
  gestor: '',
  area: '',
  classe: '',
  prioridade: '',
}

export function useFiltros(debounceMs = 400) {
  const [filtros, setFiltros] = useState<FiltrosInadimplencia>(DEFAULT_FILTROS)
  const [orderBy, setOrderByState] = useState<OrderByInadimplencia>('created_at')
  const [orderDesc, setOrderDesc] = useState(true)

  const debouncedFiltros = useDebounce(filtros, debounceMs)

  const listagemParams = useMemo((): ListagemParams => {
    const p: ListagemParams = {
      page: 1,
      pageSize: 20,
      orderBy,
      orderDesc,
    }
    if (debouncedFiltros.busca.trim()) p.busca = debouncedFiltros.busca.trim()
    if (debouncedFiltros.gestor) p.gestor = debouncedFiltros.gestor
    if (debouncedFiltros.area) p.area = debouncedFiltros.area
    if (debouncedFiltros.classe) p.classe = debouncedFiltros.classe as InadimplenciaClasse
    if (debouncedFiltros.prioridade) p.prioridade = debouncedFiltros.prioridade as PrioridadeTipo
    return p
  }, [debouncedFiltros, orderBy, orderDesc])

  const setBusca = (v: string) => setFiltros((f) => ({ ...f, busca: v }))
  const setGestor = (v: string) => setFiltros((f) => ({ ...f, gestor: v }))
  const setArea = (v: string) => setFiltros((f) => ({ ...f, area: v }))
  const setClasse = (v: InadimplenciaClasse | '') => setFiltros((f) => ({ ...f, classe: v }))
  const setPrioridade = (v: PrioridadeTipo | '') => setFiltros((f) => ({ ...f, prioridade: v }))
  const setOrderBy = (by: OrderByInadimplencia, desc?: boolean) => {
    setOrderByState(by)
    if (desc !== undefined) setOrderDesc(desc)
  }
  const reset = () => {
    setFiltros(DEFAULT_FILTROS)
    setOrderByState('created_at')
    setOrderDesc(true)
  }

  return {
    filtros,
    listagemParams,
    orderBy,
    orderDesc,
    setBusca,
    setGestor,
    setArea,
    setClasse,
    setPrioridade,
    setOrderBy,
    setOrderDesc,
    reset,
  }
}
