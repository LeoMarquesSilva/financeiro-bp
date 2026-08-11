import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Banknote,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Search,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate, formatPercent } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { receitaService } from '../services/receitaService'
import type {
  ReceitaRecebidoClassificacaoItemRow,
  ReceitaPrevistoFechamentoMes,
  ReceitaPrevistoFechamentoItemRow,
} from '../types/receita.types'
import {
  agruparClassificacaoPorGrupo,
  agruparClassificacaoPorTitulo,
  agruparRecebidoDetalhe,
  agruparRecebidoPorCategoria,
  filtrarItensDetalheRecebido,
  RECEBIDO_DETALHE_DESCRICOES,
  RECEBIDO_DETALHE_LABELS,
  somaRecebidoClassificado,
  type ReceitaRecebidoDetalheKey,
} from '../utils/recebidoClassificacao'
import { buildClienteGrupoMap } from '../utils/recebidoGrupos'
import {
  agruparPrevistoPorGrupo,
  agruparPrevistoPorTitulo,
  agruparPrevistoPorVencimentoComQuitado,
  agruparPrevistoTituloComQuitado,
  agruparInadMesPorGrupoSemCompensacao,
  agruparInadMesFlatPorVencimento,
  filtrarPrevistoItensPorBusca,
  normalizePrevistoVencimentoKey,
  PREVISTO_SEM_VENCIMENTO_KEY,
  type ReceitaInadMesGrupoAgg,
  type ReceitaInadMesVencimentoAgg,
  type ReceitaPrevistoGrupoQuitadoAgg,
} from '../utils/previstoGrupos'
import {
  FECHAMENTO_DRILL_HINTS,
  FECHAMENTO_DRILL_LABELS,
  buildPrevistoFechamentoMesFromDados,
  filtrarPrevistoMesItensPorCiItens,
  inadimplenciaItemMesFaturadoNaoPago,
  inadimplenciaMesFaturadoNaoPago,
  type FechamentoDrillKey,
} from '../utils/receitaPrevistoFechamento'
import { filtrarClassificacaoPorArea } from '../utils/receitaInadimplenciaAreaFilter'
import { ReceitaMesVisaoGerencialPanel } from './ReceitaMesVisaoGerencialPanel'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  mesLabel: string
  totalRecebido: number
  totalPrevisto: number
  areaKey?: string | null
  areaLabel?: string | null
}

type View = 'categorias' | 'titulos' | 'fechamento'

type PrevistoGrupoSortKey = 'grupo' | 'previsto' | 'quitado_no_mes' | 'inadimplencia'
type SortDir = 'asc' | 'desc'

const PREVISTO_GRUPO_SORT_DEFAULT: { key: PrevistoGrupoSortKey; dir: SortDir } = {
  key: 'inadimplencia',
  dir: 'desc',
}

type InadGrupoSortKey = 'grupo' | 'data_vencimento' | 'faturado' | 'recebido' | 'inadimplencia'

const INAD_GRUPO_SORT_DEFAULT: { key: InadGrupoSortKey; dir: SortDir } = {
  key: 'data_vencimento',
  dir: 'asc',
}

export function ReceitaRecebidoClassificacaoSheet({
  open,
  onOpenChange,
  ano,
  mes,
  mesLabel,
  totalRecebido,
  totalPrevisto,
  areaKey = null,
  areaLabel = null,
}: Props) {
  const [view, setView] = useState<View>('categorias')
  const [detalheSelecionado, setDetalheSelecionado] = useState<ReceitaRecebidoDetalheKey | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itens, setItens] = useState<ReceitaRecebidoClassificacaoItemRow[]>([])
  const [clienteGrupoMap, setClienteGrupoMap] = useState<Map<string, string>>(() => new Map())
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null)
  const [previstoVencExpandido, setPrevistoVencExpandido] = useState<string | null>(null)
  const [fechamento, setFechamento] = useState<ReceitaPrevistoFechamentoMes | null>(null)
  const [fechamentoDrill, setFechamentoDrill] = useState<FechamentoDrillKey | null>(null)
  const [fechamentoItens, setFechamentoItens] = useState<ReceitaPrevistoFechamentoItemRow[]>([])
  const [inadGrupos, setInadGrupos] = useState<ReceitaInadMesGrupoAgg[]>([])
  const [fechamentoLoading, setFechamentoLoading] = useState(false)
  const [fechamentoError, setFechamentoError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [previstoGrupoSort, setPrevistoGrupoSort] = useState(PREVISTO_GRUPO_SORT_DEFAULT)
  const [inadGrupoSort, setInadGrupoSort] = useState(INAD_GRUPO_SORT_DEFAULT)
  const [previstoMesItensArea, setPrevistoMesItensArea] = useState<ReceitaPrevistoFechamentoItemRow[]>(
    [],
  )
  const buscaDebounced = useDebounce(busca, 250)

  useEffect(() => {
    if (!open) {
      setView('categorias')
      setDetalheSelecionado(null)
      setBusca('')
      setItens([])
      setClienteGrupoMap(new Map())
      setGrupoExpandido(null)
      setPrevistoVencExpandido(null)
      setFechamento(null)
      setFechamentoDrill(null)
      setFechamentoItens([])
      setInadGrupos([])
      setInadGrupoSort(INAD_GRUPO_SORT_DEFAULT)
      setPrevistoMesItensArea([])
      setFechamentoError(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setPrevistoMesItensArea([])

    const load = areaKey
      ? Promise.all([
          receitaService.fetchRecebidoClassificacaoMes(ano, mes),
          receitaService.fetchPrevistoMesItens(ano, mes),
          receitaService.fetchPrevistoItensPorArea(ano, mes, areaKey),
          receitaService.fetchEmpresasNomeGrupo(),
        ]).then(([classAll, prevMesAll, prevArea, empresas]) => {
          const classArea = filtrarClassificacaoPorArea(classAll, areaKey)
          const prevMesArea = filtrarPrevistoMesItensPorCiItens(prevMesAll, prevArea)
          return {
            itens: classArea,
            fechamento: buildPrevistoFechamentoMesFromDados(prevMesArea, classArea, ano, mes),
            empresas,
            prevMesArea,
          }
        })
      : Promise.all([
          receitaService.fetchRecebidoClassificacaoMes(ano, mes),
          receitaService.fetchPrevistoMesItens(ano, mes),
          receitaService.fetchEmpresasNomeGrupo(),
        ]).then(([itensData, prevMesAll, empresas]) => ({
          itens: itensData,
          fechamento: buildPrevistoFechamentoMesFromDados(prevMesAll, itensData, ano, mes),
          empresas,
          prevMesArea: prevMesAll,
        }))

    load
      .then(({ itens: itensData, fechamento: fechamentoData, empresas, prevMesArea }) => {
        if (!cancelled) {
          setItens(itensData)
          setFechamento(fechamentoData)
          setPrevistoMesItensArea(prevMesArea)
          setClienteGrupoMap(buildClienteGrupoMap(empresas))
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar detalhe do recebido.')
          setItens([])
          setFechamento(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes, areaKey])

  const categoriasAgg = useMemo(() => agruparRecebidoPorCategoria(itens), [itens])
  const somaCategorias = useMemo(() => somaRecebidoClassificado(categoriasAgg), [categoriasAgg])

  const detalheAgg = useMemo(() => agruparRecebidoDetalhe(itens, ano, mes), [itens, ano, mes])

  const detalheAtual = useMemo(
    () => detalheAgg.find((d) => d.key === detalheSelecionado) ?? null,
    [detalheAgg, detalheSelecionado],
  )

  const itensDetalhe = useMemo(() => {
    if (!detalheSelecionado) return []
    return filtrarItensDetalheRecebido(itens, detalheSelecionado, ano, mes)
  }, [itens, detalheSelecionado, ano, mes])

  const gruposAgg = useMemo(() => {
    if (!detalheSelecionado) return []
    return agruparClassificacaoPorGrupo(itensDetalhe, clienteGrupoMap)
  }, [itensDetalhe, clienteGrupoMap, detalheSelecionado])

  const titulosAgg = useMemo(() => {
    if (!detalheSelecionado) return []
    return agruparClassificacaoPorTitulo(itensDetalhe, undefined, undefined, clienteGrupoMap)
  }, [itensDetalhe, clienteGrupoMap, detalheSelecionado])

  function tituloMatchesBusca(
    t: ReturnType<typeof agruparClassificacaoPorTitulo>[number],
    q: string,
  ): boolean {
    const hay = [t.nro_titulo, t.cliente, t.descricao, String(t.ci_titulo)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  }

  const gruposFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return gruposAgg
    return gruposAgg.filter((g) => {
      if (g.grupo.toLowerCase().includes(q)) return true
      return agruparClassificacaoPorTitulo(itensDetalhe, undefined, g.grupo, clienteGrupoMap).some(
        (t) => tituloMatchesBusca(t, q),
      )
    })
  }, [gruposAgg, buscaDebounced, itensDetalhe, clienteGrupoMap])

  const titulosPorGrupo = (grupo: string) => {
    const q = buscaDebounced.trim().toLowerCase()
    const titulos = agruparClassificacaoPorTitulo(
      itensDetalhe,
      undefined,
      grupo,
      clienteGrupoMap,
    )
    if (!q) return titulos
    return titulos.filter((t) => tituloMatchesBusca(t, q))
  }

  const totalTitulosFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return titulosAgg.reduce((s, t) => s + t.total, 0)
    return titulosAgg.filter((t) => tituloMatchesBusca(t, q)).reduce((s, t) => s + t.total, 0)
  }, [titulosAgg, buscaDebounced])

  const qtdTitulosFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return titulosAgg.length
    return titulosAgg.filter((t) => tituloMatchesBusca(t, q)).length
  }, [titulosAgg, buscaDebounced])

  const fechamentoGruposAgg = useMemo(() => {
    if (fechamentoDrill === 'inad_grupo' || fechamentoDrill === 'previsto_grupo') return []
    return agruparPrevistoPorGrupo(fechamentoItens, clienteGrupoMap)
  }, [fechamentoItens, clienteGrupoMap, fechamentoDrill])

  const previstoItensFiltrados = useMemo(() => {
    if (fechamentoDrill !== 'previsto_grupo') return []
    return filtrarPrevistoItensPorBusca(fechamentoItens, buscaDebounced, clienteGrupoMap)
  }, [fechamentoItens, buscaDebounced, clienteGrupoMap, fechamentoDrill])

  const previstoVencimentoAgg = useMemo(() => {
    if (fechamentoDrill !== 'previsto_grupo') return []
    return agruparPrevistoPorVencimentoComQuitado(
      previstoItensFiltrados,
      clienteGrupoMap,
      ano,
      mes,
    )
  }, [previstoItensFiltrados, clienteGrupoMap, fechamentoDrill, ano, mes])

  const previstoGrupoAgg = useMemo(
    () => previstoVencimentoAgg.flatMap((v) => v.grupos),
    [previstoVencimentoAgg],
  )

  function previstoTituloMatchesBusca(
    t: ReturnType<typeof agruparPrevistoPorTitulo>[number],
    q: string,
  ): boolean {
    const hay = [t.nro_titulo, t.cliente, t.descricao, String(t.ci_titulo)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  }

  const ordenarPrevistoGrupos = (grupos: ReceitaPrevistoGrupoQuitadoAgg[]) => {
    const { key, dir } = previstoGrupoSort
    const mult = dir === 'asc' ? 1 : -1
    return [...grupos].sort((a, b) => {
      if (key === 'grupo') {
        return mult * a.grupo.localeCompare(b.grupo, 'pt-BR')
      }
      if (key === 'inadimplencia') {
        return mult * (a.inadimplencia - b.inadimplencia)
      }
      return mult * (a[key] - b[key])
    })
  }

  const previstoVencimentoOrdenados = useMemo(
    () =>
      previstoVencimentoAgg.map((venc) => ({
        ...venc,
        grupos: ordenarPrevistoGrupos(venc.grupos),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ordenarPrevistoGrupos usa previstoGrupoSort
    [previstoVencimentoAgg, previstoGrupoSort],
  )

  const previstoGrupoOrdenados = previstoGrupoAgg

  const previstoGrupoSoma = useMemo(() => {
    const previsto = previstoItensFiltrados.reduce((s, i) => s + i.valor_item, 0)
    const quitado = previstoItensFiltrados.reduce((s, i) => {
      if (!i.data_pagamento) return s
      const d = new Date(`${i.data_pagamento}T12:00:00`)
      return d.getFullYear() === ano && d.getMonth() + 1 === mes ? s + i.valor_item : s
    }, 0)
    const inadimplencia = previstoItensFiltrados.reduce(
      (s, i) => s + inadimplenciaItemMesFaturadoNaoPago(i, ano, mes),
      0,
    )
    return {
      previsto,
      quitado,
      inadimplencia,
      pctInadimplencia: previsto > 0 ? (inadimplencia / previsto) * 100 : null,
    }
  }, [previstoItensFiltrados, ano, mes])

  const previstoTitulosPorGrupo = (vencimentoKey: string, grupo: string) => {
    const q = buscaDebounced.trim().toLowerCase()
    const itensVenc = fechamentoItens.filter(
      (i) => normalizePrevistoVencimentoKey(i.data_vencimento) === vencimentoKey,
    )
    let titulos = agruparPrevistoTituloComQuitado(
      itensVenc,
      grupo,
      clienteGrupoMap,
      ano,
      mes,
    )
    if (q) {
      titulos = titulos.filter((t) => previstoTituloMatchesBusca(t, q))
    }
    const { key, dir } = previstoGrupoSort
    const mult = dir === 'asc' ? 1 : -1
    return [...titulos].sort((a, b) => {
      if (key === 'grupo') {
        const aLabel = a.nro_titulo ?? String(a.ci_titulo)
        const bLabel = b.nro_titulo ?? String(b.ci_titulo)
        return mult * aLabel.localeCompare(bLabel, 'pt-BR')
      }
      if (key === 'previsto') return mult * (a.total - b.total)
      if (key === 'inadimplencia') {
        return mult * (a.inadimplencia - b.inadimplencia)
      }
      return mult * (a[key] - b[key])
    })
  }

  const previstoGrupoExpandidoKey = (vencimentoKey: string, grupo: string) =>
    `${vencimentoKey}::${grupo}`

  const togglePrevistoVencimento = (vencimentoKey: string) => {
    setPrevistoVencExpandido((prev) => (prev === vencimentoKey ? null : vencimentoKey))
    setGrupoExpandido(null)
  }

  const togglePrevistoGrupo = (vencimentoKey: string, grupo: string) => {
    const key = previstoGrupoExpandidoKey(vencimentoKey, grupo)
    setGrupoExpandido((prev) => (prev === key ? null : key))
  }

  const labelPrevistoVencimento = (vencimentoKey: string) =>
    vencimentoKey === PREVISTO_SEM_VENCIMENTO_KEY
      ? 'Sem data de vencimento'
      : formatDate(vencimentoKey)

  const togglePrevistoGrupoSort = (key: PrevistoGrupoSortKey) => {
    setPrevistoGrupoSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'grupo' ? 'asc' : 'desc' },
    )
  }

  const previstoGrupoSortIcon = (key: PrevistoGrupoSortKey) => {
    if (previstoGrupoSort.key !== key) return null
    return previstoGrupoSort.dir === 'desc' ? (
      <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
    ) : (
      <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
    )
  }

  const toggleInadGrupoSort = (key: InadGrupoSortKey) => {
    setInadGrupoSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'grupo' || key === 'data_vencimento' ? 'asc' : 'desc' },
    )
  }

  const toggleInadHierarchySort = () => {
    setInadGrupoSort((prev) => {
      if (prev.key === 'data_vencimento') {
        return { key: 'grupo', dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key: 'data_vencimento', dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  const inadHierarchySortIcon = () => {
    if (inadGrupoSort.key !== 'data_vencimento' && inadGrupoSort.key !== 'grupo') return null
    return inadGrupoSort.dir === 'desc' ? (
      <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
    ) : (
      <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
    )
  }

  const inadGrupoSortIcon = (key: InadGrupoSortKey) => {
    if (inadGrupoSort.key !== key) return null
    return inadGrupoSort.dir === 'desc' ? (
      <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
    ) : (
      <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
    )
  }

  const ordenarInadGrupos = (rows: ReceitaInadMesGrupoAgg[]) => {
    const { key, dir } = inadGrupoSort
    const mult = dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (key === 'grupo' || key === 'data_vencimento') {
        return mult * a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR')
      }
      return mult * (a[key] - b[key])
    })
  }

  const ordenarInadVencimentos = (rows: ReceitaInadMesVencimentoAgg[]) => {
    const { key, dir } = inadGrupoSort
    const mult = dir === 'asc' ? 1 : -1
    if (key === 'grupo') {
      return [...rows].sort((a, b) => {
        const aGrupo = [...a.grupos].sort((x, y) =>
          x.grupo_cliente.localeCompare(y.grupo_cliente, 'pt-BR'),
        )[0]?.grupo_cliente
        const bGrupo = [...b.grupos].sort((x, y) =>
          x.grupo_cliente.localeCompare(y.grupo_cliente, 'pt-BR'),
        )[0]?.grupo_cliente
        if (!aGrupo || !bGrupo) return 0
        return mult * aGrupo.localeCompare(bGrupo, 'pt-BR')
      })
    }
    if (key === 'data_vencimento') {
      return [...rows].sort((a, b) => mult * a.vencimentoKey.localeCompare(b.vencimentoKey))
    }
    return [...rows].sort((a, b) => mult * (a[key] - b[key]))
  }

  const fechamentoGruposFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return fechamentoGruposAgg
    return fechamentoGruposAgg.filter((g) => {
      if (g.grupo.toLowerCase().includes(q)) return true
      return agruparPrevistoPorTitulo(fechamentoItens, g.grupo, clienteGrupoMap).some((t) =>
        previstoTituloMatchesBusca(t, q),
      )
    })
  }, [fechamentoGruposAgg, buscaDebounced, fechamentoItens, clienteGrupoMap])

  const fechamentoTitulosPorGrupo = (grupo: string) => {
    const q = buscaDebounced.trim().toLowerCase()
    const titulos = agruparPrevistoPorTitulo(fechamentoItens, grupo, clienteGrupoMap)
    if (!q) return titulos
    return titulos.filter((t) => previstoTituloMatchesBusca(t, q))
  }

  const fechamentoSomaItens = useMemo(
    () => fechamentoItens.reduce((s, i) => s + i.valor_item, 0),
    [fechamentoItens],
  )

  const inadGruposFiltrados = useMemo(() => {
    const q = buscaDebounced.trim().toLowerCase()
    if (!q) return inadGrupos
    return inadGrupos.filter(
      (g) =>
        g.grupo_cliente.toLowerCase().includes(q) ||
        g.data_vencimento.includes(q) ||
        formatDate(g.data_vencimento).toLowerCase().includes(q),
    )
  }, [inadGrupos, buscaDebounced])

  const inadVencimentoOrdenados = useMemo(() => {
    const porVenc = agruparInadMesFlatPorVencimento(inadGruposFiltrados)
    return ordenarInadVencimentos(porVenc).map((venc) => ({
      ...venc,
      grupos: ordenarInadGrupos(venc.grupos),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ordenadores usam inadGrupoSort
  }, [inadGruposFiltrados, inadGrupoSort])

  const inadGruposSoma = useMemo(
    () => inadGrupos.reduce((s, g) => s + g.inadimplencia, 0),
    [inadGrupos],
  )

  const fechamentoDrillEsperado = useMemo(() => {
    if (!fechamento || !fechamentoDrill) return null
    if (fechamentoDrill === 'inad_grupo') return inadimplenciaMesFaturadoNaoPago(fechamento)
    if (fechamentoDrill === 'previsto_grupo') return fechamento.previsto
    return fechamento[fechamentoDrill]
  }, [fechamento, fechamentoDrill])

  const fechamentoDrillTotal = useMemo(() => {
    if (fechamentoDrill === 'inad_grupo') return inadGruposSoma
    if (fechamentoDrill === 'previsto_grupo') return previstoGrupoSoma.previsto
    return fechamentoSomaItens
  }, [fechamentoDrill, inadGruposSoma, fechamentoSomaItens, previstoGrupoSoma.previsto])

  const fechamentoDrillFecha =
    fechamentoDrillEsperado != null &&
    Math.abs(fechamentoDrillTotal - fechamentoDrillEsperado) < 0.02

  const previstoInadFecha =
    fechamento != null &&
    Math.abs(previstoGrupoSoma.inadimplencia - inadimplenciaMesFaturadoNaoPago(fechamento)) < 0.02

  const pagamentoTituloFechamento = (ciTitulo: number) => {
    const datas = fechamentoItens
      .filter((i) => i.ci_titulo === ciTitulo && i.data_pagamento)
      .map((i) => i.data_pagamento as string)
    return datas.sort().pop() ?? null
  }

  const recebidoHeader = somaCategorias > 0 ? somaCategorias : totalRecebido
  const inadHeader = fechamento ? inadimplenciaMesFaturadoNaoPago(fechamento) : null
  const pctPrevistoCaixaHeader =
    fechamento && fechamento.previsto > 0
      ? (fechamento.recebido_previsto_caixa / fechamento.previsto) * 100
      : null

  const abrirFechamentoDrill = (key: FechamentoDrillKey) => {
    setFechamentoDrill(key)
    setBusca('')
    setGrupoExpandido(null)
    setPrevistoVencExpandido(null)
    if (key === 'previsto_grupo') {
      setPrevistoGrupoSort(PREVISTO_GRUPO_SORT_DEFAULT)
    }
    if (key === 'inad_grupo') {
      setInadGrupoSort(INAD_GRUPO_SORT_DEFAULT)
    }
    setView('fechamento')
    setFechamentoLoading(true)
    setFechamentoError(null)
    setFechamentoItens([])
    setInadGrupos([])

    const loadInadGrupos = (rows: ReceitaPrevistoFechamentoItemRow[]) =>
      setInadGrupos(agruparInadMesPorGrupoSemCompensacao(rows, clienteGrupoMap, ano, mes))

    const load =
      key === 'inad_grupo'
        ? previstoMesItensArea.length > 0
          ? Promise.resolve().then(() => loadInadGrupos(previstoMesItensArea))
          : receitaService.fetchPrevistoMesItens(ano, mes).then((rows) => loadInadGrupos(rows))
        : key === 'previsto_grupo'
          ? areaKey
            ? Promise.resolve().then(() => {
                setFechamentoItens(previstoMesItensArea)
              })
            : receitaService.fetchPrevistoMesItens(ano, mes).then((rows) => {
                setFechamentoItens(rows)
              })
          : receitaService.fetchPrevistoFechamentoItens(ano, mes, key).then((rows) => {
              setFechamentoItens(
                areaKey ? filtrarPrevistoMesItensPorCiItens(rows, previstoMesItensArea) : rows,
              )
            })

    load
      .catch((e) => {
        setFechamentoError(
          e instanceof Error ? e.message : 'Erro ao carregar composição do fechamento.',
        )
      })
      .finally(() => setFechamentoLoading(false))
  }

  const abrirTitulos = (key: ReceitaRecebidoDetalheKey) => {
    setDetalheSelecionado(key)
    setBusca('')
    setGrupoExpandido(null)
    setPrevistoVencExpandido(null)
    setView('titulos')
  }

  const voltarCategorias = () => {
    setView('categorias')
    setDetalheSelecionado(null)
    setFechamentoDrill(null)
    setFechamentoItens([])
    setInadGrupos([])
    setFechamentoError(null)
    setGrupoExpandido(null)
    setPrevistoVencExpandido(null)
    setBusca('')
  }

  const toggleGrupo = (grupo: string) => {
    setGrupoExpandido((prev) => (prev === grupo ? null : grupo))
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('categorias')
      setDetalheSelecionado(null)
      setFechamentoDrill(null)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-sky-600 to-sky-700 px-6 py-4 pr-14 text-left">
          {view === 'fechamento' && fechamentoDrill ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-sky-100 hover:bg-white/10 hover:text-white"
                onClick={voltarCategorias}
              >
                <ArrowLeft className="h-4 w-4" />
                {fechamentoDrill === 'previsto_grupo' ? 'Visão do mês' : 'Fechamento do previsto'}
              </Button>
              <SheetTitle className="text-base font-semibold text-white">
                {FECHAMENTO_DRILL_LABELS[fechamentoDrill]}
              </SheetTitle>
              <SheetDescription className="text-xs text-sky-100">
                {FECHAMENTO_DRILL_HINTS[fechamentoDrill]} · {mesLabel} / {ano}
                {fechamentoDrill === 'inad_grupo'
                  ? ` · ${inadVencimentoOrdenados.length} ${inadVencimentoOrdenados.length === 1 ? 'vencimento' : 'vencimentos'} · ${inadGruposFiltrados.length} ${inadGruposFiltrados.length === 1 ? 'grupo' : 'grupos'}`
                  : fechamentoDrill === 'previsto_grupo'
                    ? ` · ${previstoVencimentoOrdenados.length} ${previstoVencimentoOrdenados.length === 1 ? 'vencimento' : 'vencimentos'} · ${previstoGrupoOrdenados.length} ${previstoGrupoOrdenados.length === 1 ? 'grupo' : 'grupos'}`
                    : ` · ${fechamentoGruposFiltrados.length} ${fechamentoGruposFiltrados.length === 1 ? 'grupo' : 'grupos'} · ${fechamentoItens.length} ${fechamentoItens.length === 1 ? 'item' : 'itens'}`}
              </SheetDescription>
              {fechamentoDrill === 'previsto_grupo' ? (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-sky-100/90">
                        Previsto
                      </p>
                      <p className="text-lg font-bold tabular-nums text-white">
                        {formatCurrency(previstoGrupoSoma.previsto)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-sky-100/90">
                        Quitado
                      </p>
                      <p className="text-lg font-bold tabular-nums text-emerald-100">
                        {formatCurrency(previstoGrupoSoma.quitado)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-sky-100/90">
                        Inadimplência
                      </p>
                      <p className="text-lg font-bold tabular-nums text-red-100">
                        {formatCurrency(previstoGrupoSoma.inadimplencia)}
                      </p>
                      {previstoGrupoSoma.pctInadimplencia != null ? (
                        <p className="text-[11px] font-medium tabular-nums text-red-100/90">
                          {formatPercent(previstoGrupoSoma.pctInadimplencia)} do previsto
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {fechamentoDrillEsperado != null && fechamentoDrillFecha ? (
                    <span className="mt-2 inline-flex rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                      previsto fecha com o painel
                    </span>
                  ) : null}
                  {previstoInadFecha ? (
                    <span className="mt-2 inline-flex rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                      inad. fecha com o header
                    </span>
                  ) : null}
                </>
              ) : (
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <p className="text-xl font-bold tabular-nums text-white">
                    {formatCurrency(fechamentoDrillTotal)}
                  </p>
                  {fechamentoDrillEsperado != null && fechamentoDrillFecha ? (
                    <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                      fecha com o painel
                    </span>
                  ) : null}
                </div>
              )}
            </>
          ) : view === 'titulos' && detalheSelecionado ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 h-8 gap-1.5 px-2 text-sky-100 hover:bg-white/10 hover:text-white"
                onClick={voltarCategorias}
              >
                <ArrowLeft className="h-4 w-4" />
                Composição do recebido
              </Button>
              <SheetTitle className="text-base font-semibold text-white">
                {RECEBIDO_DETALHE_LABELS[detalheSelecionado]}
              </SheetTitle>
              <SheetDescription className="text-xs text-sky-100">
                {RECEBIDO_DETALHE_DESCRICOES[detalheSelecionado]} · {mesLabel} / {ano} ·{' '}
                {gruposAgg.length} {gruposAgg.length === 1 ? 'grupo' : 'grupos'} ·{' '}
                {detalheAtual?.quantidadeTitulos ?? titulosAgg.length}{' '}
                {(detalheAtual?.quantidadeTitulos ?? titulosAgg.length) === 1
                  ? 'título'
                  : 'títulos'}
              </SheetDescription>
              <p className="mt-2 text-xl font-bold tabular-nums text-white">
                {formatCurrency(detalheAtual?.total ?? totalTitulosFiltrados)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
                  <Banknote className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-semibold text-white">
                    Visão do mês
                    {areaLabel ? ` — ${areaLabel}` : ''} · {mesLabel} / {ano}
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-sky-100">
                    Previsto · Recebido · Inadimplência
                    {areaLabel ? ` · filtro ${areaLabel}` : ''}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => abrirFechamentoDrill('previsto_grupo')}
                  className="rounded-lg bg-white/10 px-2 py-2 text-left transition-colors hover:bg-white/20"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-sky-100/90">
                    Previsto
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-white/95">
                    {formatCurrency(totalPrevisto)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-0.5 text-[10px] leading-snug text-sky-100/80">
                    Venc. do mês
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  </p>
                </button>
                <div className="rounded-lg bg-white/15 px-2 py-2 ring-1 ring-white/20">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-sky-100">
                    Recebido
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-white">
                    {formatCurrency(recebidoHeader)}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-sky-100/90">Caixa do mês</p>
                  {pctPrevistoCaixaHeader != null ? (
                    <p className="mt-0.5 text-[10px] font-medium tabular-nums text-sky-100">
                      {formatPercent(pctPrevistoCaixaHeader)} do previsto (venc. mês)
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg bg-red-950/25 px-2 py-2 ring-1 ring-red-300/20">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-red-100/90">
                    Inad. mês
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums leading-tight text-red-100">
                    {inadHeader != null ? formatCurrency(inadHeader) : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-red-100/80">
                    Vencido, não pago
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {(view === 'titulos' || view === 'fechamento') && (
            <div className="shrink-0 border-b border-slate-100 px-6 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={
                    view === 'fechamento' && fechamentoDrill === 'inad_grupo'
                      ? 'Buscar grupo ou vencimento…'
                      : view === 'fechamento' && fechamentoDrill === 'previsto_grupo'
                        ? 'Buscar grupo, título, cliente…'
                        : 'Buscar grupo, título, cliente…'
                  }
                  className="pl-9"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && (
              <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                Carregando detalhe…
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            {!loading && !error && view === 'categorias' && !fechamento && recebidoHeader < 0.01 && (
              <p className="py-10 text-center text-sm text-slate-500">
                Nenhum recebimento neste mês.
              </p>
            )}

            {!loading && !error && view === 'categorias' && fechamento && (
              <ReceitaMesVisaoGerencialPanel
                fechamento={fechamento}
                onDrillRecebido={abrirTitulos}
                onDrillContabil={abrirFechamentoDrill}
              />
            )}

            {view === 'fechamento' && fechamentoLoading && (
              <div className="flex flex-col items-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
                Carregando composição…
              </div>
            )}

            {view === 'fechamento' && fechamentoError && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {fechamentoError}
              </p>
            )}

            {view === 'fechamento' &&
              !fechamentoLoading &&
              !fechamentoError &&
              fechamentoDrill === 'inad_grupo' &&
              inadVencimentoOrdenados.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">
                  {buscaDebounced
                    ? 'Nenhum grupo corresponde à busca.'
                    : 'Nenhum grupo inadimplente neste mês.'}
                </p>
              )}

            {view === 'fechamento' &&
              !fechamentoLoading &&
              !fechamentoError &&
              fechamentoDrill === 'inad_grupo' &&
              inadVencimentoOrdenados.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={toggleInadHierarchySort}
                            className="inline-flex items-center gap-1 hover:text-slate-800"
                            title={
                              inadGrupoSort.key === 'grupo'
                                ? 'Ordenar grupos dentro de cada vencimento'
                                : 'Ordenar blocos por data de vencimento'
                            }
                          >
                            Vencimento / Grupo
                            {inadHierarchySortIcon()}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggleInadGrupoSort('faturado')}
                            className="ml-auto inline-flex items-center gap-1 hover:text-slate-800"
                          >
                            Faturado
                            {inadGrupoSortIcon('faturado')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggleInadGrupoSort('recebido')}
                            className="ml-auto inline-flex items-center gap-1 hover:text-slate-800"
                          >
                            Recebido
                            {inadGrupoSortIcon('recebido')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => toggleInadGrupoSort('inadimplencia')}
                            className="ml-auto inline-flex items-center gap-1 text-red-700 hover:text-red-900"
                          >
                            Inadimplência
                            {inadGrupoSortIcon('inadimplencia')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inadVencimentoOrdenados.map((venc) => {
                        const vencExpandido = previstoVencExpandido === venc.vencimentoKey
                        return (
                          <Fragment key={venc.vencimentoKey}>
                            <tr
                              className="cursor-pointer border-t border-slate-200 bg-red-50/40 hover:bg-red-50/70"
                              onClick={() => togglePrevistoVencimento(venc.vencimentoKey)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  togglePrevistoVencimento(venc.vencimentoKey)
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-expanded={vencExpandido}
                            >
                              <td className="px-3 py-2.5 align-top">
                                <div className="flex items-start gap-2">
                                  {vencExpandido ? (
                                    <ChevronDown
                                      className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronRight
                                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                      aria-hidden
                                    />
                                  )}
                                  <Calendar
                                    className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                                    aria-hidden
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">
                                      {labelPrevistoVencimento(venc.vencimentoKey)}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                      {venc.qtd_grupos}{' '}
                                      {venc.qtd_grupos === 1 ? 'grupo' : 'grupos'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-bold tabular-nums text-slate-700">
                                {formatCurrency(venc.faturado)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-emerald-700">
                                {formatCurrency(venc.recebido)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-bold tabular-nums text-red-700">
                                {formatCurrency(venc.inadimplencia)}
                              </td>
                            </tr>
                            {vencExpandido &&
                              venc.grupos.map((g) => (
                                <tr
                                  key={`${venc.vencimentoKey}::${g.grupo_cliente}`}
                                  className="border-t border-slate-100 bg-slate-50/60 hover:bg-slate-50/80"
                                >
                                  <td className="px-3 py-2.5 align-top pl-10">
                                    <div className="flex items-start gap-2">
                                      <Building2
                                        className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                                        aria-hidden
                                      />
                                      <div className="min-w-0">
                                        <p className="font-semibold text-slate-800">
                                          {g.grupo_cliente}
                                        </p>
                                        {g.qtd_clientes_inad > 0 ? (
                                          <p className="mt-0.5 text-[11px] text-slate-500">
                                            {g.qtd_clientes_inad}{' '}
                                            {g.qtd_clientes_inad === 1
                                              ? 'cliente inad.'
                                              : 'clientes inad.'}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-slate-600">
                                    {formatCurrency(g.faturado)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-slate-600">
                                    {formatCurrency(g.recebido)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-red-700">
                                    {formatCurrency(g.inadimplencia)}
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold">
                        <td className="px-3 py-2.5 text-slate-700">Total</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {formatCurrency(
                            inadGruposFiltrados.reduce((s, g) => s + g.faturado, 0),
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-emerald-700">
                          {formatCurrency(
                            inadGruposFiltrados.reduce((s, g) => s + g.recebido, 0),
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-red-700">
                          {formatCurrency(inadGruposSoma)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            {view === 'fechamento' &&
              !fechamentoLoading &&
              !fechamentoError &&
              fechamentoDrill === 'previsto_grupo' &&
              previstoVencimentoOrdenados.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">
                  {buscaDebounced
                    ? 'Nenhum vencimento ou grupo corresponde à busca.'
                    : 'Nenhum vencimento previsto neste mês.'}
                </p>
              )}

            {view === 'fechamento' &&
              !fechamentoLoading &&
              !fechamentoError &&
              fechamentoDrill === 'previsto_grupo' &&
              previstoVencimentoOrdenados.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => togglePrevistoGrupoSort('grupo')}
                            className="inline-flex items-center gap-1 hover:text-slate-800"
                          >
                            Vencimento / Grupo
                            {previstoGrupoSortIcon('grupo')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => togglePrevistoGrupoSort('previsto')}
                            className="ml-auto inline-flex items-center gap-1 hover:text-slate-800"
                          >
                            Previsto
                            {previstoGrupoSortIcon('previsto')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => togglePrevistoGrupoSort('quitado_no_mes')}
                            className="ml-auto inline-flex items-center gap-1 hover:text-slate-800"
                          >
                            Quitado no mês
                            {previstoGrupoSortIcon('quitado_no_mes')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => togglePrevistoGrupoSort('inadimplencia')}
                            className="ml-auto inline-flex items-center gap-1 text-red-700 hover:text-red-900"
                          >
                            Inadimplência
                            {previstoGrupoSortIcon('inadimplencia')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previstoVencimentoOrdenados.map((venc) => {
                        const vencExpandido = previstoVencExpandido === venc.vencimentoKey
                        return (
                          <Fragment key={venc.vencimentoKey}>
                            <tr
                              className="cursor-pointer border-t border-slate-200 bg-violet-50/50 hover:bg-violet-50"
                              onClick={() => togglePrevistoVencimento(venc.vencimentoKey)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  togglePrevistoVencimento(venc.vencimentoKey)
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-expanded={vencExpandido}
                            >
                              <td className="px-3 py-2.5 align-top">
                                <div className="flex items-start gap-2">
                                  {vencExpandido ? (
                                    <ChevronDown
                                      className="mt-0.5 h-4 w-4 shrink-0 text-violet-700"
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronRight
                                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                      aria-hidden
                                    />
                                  )}
                                  <Calendar
                                    className="mt-0.5 h-4 w-4 shrink-0 text-violet-700"
                                    aria-hidden
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">
                                      {labelPrevistoVencimento(venc.vencimentoKey)}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                      {venc.grupos.length}{' '}
                                      {venc.grupos.length === 1 ? 'grupo' : 'grupos'} ·{' '}
                                      {venc.quantidadeTitulos}{' '}
                                      {venc.quantidadeTitulos === 1 ? 'título' : 'títulos'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-bold tabular-nums text-sky-900">
                                {formatCurrency(venc.previsto)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-emerald-700">
                                {formatCurrency(venc.quitado_no_mes)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-bold tabular-nums text-red-700">
                                {formatCurrency(venc.inadimplencia)}
                              </td>
                            </tr>
                            {vencExpandido &&
                              venc.grupos.map((grupo) => {
                                const grupoKey = previstoGrupoExpandidoKey(
                                  venc.vencimentoKey,
                                  grupo.grupo,
                                )
                                const expandido = grupoExpandido === grupoKey
                                const titulos = previstoTitulosPorGrupo(
                                  venc.vencimentoKey,
                                  grupo.grupo,
                                )
                                return (
                                  <Fragment key={grupoKey}>
                                    <tr
                                      className="cursor-pointer border-t border-slate-100 bg-slate-50/60 hover:bg-sky-50/50"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        togglePrevistoGrupo(venc.vencimentoKey, grupo.grupo)
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          togglePrevistoGrupo(venc.vencimentoKey, grupo.grupo)
                                        }
                                      }}
                                      tabIndex={0}
                                      role="button"
                                      aria-expanded={expandido}
                                    >
                                      <td className="px-3 py-2.5 align-top pl-8">
                                        <div className="flex items-start gap-2">
                                          {expandido ? (
                                            <ChevronDown
                                              className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                                              aria-hidden
                                            />
                                          ) : (
                                            <ChevronRight
                                              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                              aria-hidden
                                            />
                                          )}
                                          <Building2
                                            className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                                            aria-hidden
                                          />
                                          <div className="min-w-0">
                                            <p className="font-semibold text-slate-800">
                                              {grupo.grupo}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-slate-500">
                                              {grupo.quantidadeTitulos}{' '}
                                              {grupo.quantidadeTitulos === 1 ? 'título' : 'títulos'}{' '}
                                              · {grupo.quantidadeItens}{' '}
                                              {grupo.quantidadeItens === 1 ? 'item' : 'itens'}
                                            </p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-800">
                                        {formatCurrency(grupo.previsto)}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-emerald-700">
                                        {formatCurrency(grupo.quitado_no_mes)}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-red-700">
                                        {formatCurrency(grupo.inadimplencia)}
                                      </td>
                                    </tr>
                                    {expandido &&
                                      titulos.map((titulo) => (
                                        <tr
                                          key={`${grupoKey}-${titulo.ci_titulo}`}
                                          className="border-t border-slate-100 bg-white hover:bg-slate-50/80"
                                        >
                                          <td className="px-3 py-2.5 align-top pl-14">
                                            <div className="flex items-start gap-2">
                                              <FileText
                                                className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                                aria-hidden
                                              />
                                              <div className="min-w-0">
                                                <p className="font-medium text-slate-800">
                                                  {titulo.nro_titulo
                                                    ? `Tít. ${titulo.nro_titulo}`
                                                    : `CI ${titulo.ci_titulo}`}
                                                </p>
                                                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                                                  {titulo.descricao || '—'}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden">
                                                  {titulo.cliente || '—'}
                                                </p>
                                                {titulo.data_pagamento ? (
                                                  <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                                                    Pago {formatDate(titulo.data_pagamento)}
                                                  </p>
                                                ) : null}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-sky-700">
                                            {formatCurrency(titulo.total)}
                                          </td>
                                          <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-emerald-700">
                                            {formatCurrency(titulo.quitado_no_mes)}
                                          </td>
                                          <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-red-700">
                                            {formatCurrency(titulo.inadimplencia)}
                                          </td>
                                        </tr>
                                      ))}
                                  </Fragment>
                                )
                              })}
                          </Fragment>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold">
                        <td className="px-3 py-2.5 text-slate-700">Total</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sky-800">
                          {formatCurrency(previstoGrupoSoma.previsto)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-emerald-700">
                          {formatCurrency(previstoGrupoSoma.quitado)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-red-700">
                          {formatCurrency(previstoGrupoSoma.inadimplencia)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

            {view === 'fechamento' &&
              !fechamentoLoading &&
              !fechamentoError &&
              fechamentoDrill !== 'inad_grupo' &&
              fechamentoDrill !== 'previsto_grupo' &&
              fechamentoGruposFiltrados.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-500">
                  {buscaDebounced
                    ? 'Nenhum grupo corresponde à busca.'
                    : 'Nenhum item neste bucket.'}
                </p>
              )}

            {view === 'fechamento' &&
              !fechamentoLoading &&
              !fechamentoError &&
              fechamentoDrill !== 'inad_grupo' &&
              fechamentoDrill !== 'previsto_grupo' &&
              fechamentoGruposFiltrados.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Grupo / Título</th>
                        <th className="hidden px-3 py-2 sm:table-cell">Cliente</th>
                        <th className="px-3 py-2">Vencimento</th>
                        <th className="px-3 py-2">Pagamento</th>
                        <th className="px-3 py-2 text-right">Valor item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fechamentoGruposFiltrados.map((grupo) => {
                        const expandido = grupoExpandido === grupo.grupo
                        const titulos = fechamentoTitulosPorGrupo(grupo.grupo)
                        return (
                          <Fragment key={grupo.grupo}>
                            <tr
                              className="cursor-pointer border-t border-slate-100 bg-slate-50/60 hover:bg-sky-50/50"
                              onClick={() => toggleGrupo(grupo.grupo)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  toggleGrupo(grupo.grupo)
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              aria-expanded={expandido}
                            >
                              <td className="px-3 py-2.5 align-top">
                                <div className="flex items-start gap-2">
                                  {expandido ? (
                                    <ChevronDown
                                      className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronRight
                                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                      aria-hidden
                                    />
                                  )}
                                  <Building2
                                    className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                                    aria-hidden
                                  />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-800">{grupo.grupo}</p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                      {grupo.quantidadeTitulos}{' '}
                                      {grupo.quantidadeTitulos === 1 ? 'título' : 'títulos'} ·{' '}
                                      {grupo.quantidadeItens}{' '}
                                      {grupo.quantidadeItens === 1 ? 'item' : 'itens'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden sm:table-cell" />
                              <td className="px-3 py-2.5 align-top" />
                              <td className="px-3 py-2.5 align-top" />
                              <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-800">
                                {formatCurrency(grupo.total)}
                              </td>
                            </tr>
                            {expandido &&
                              titulos.map((titulo) => (
                                <tr
                                  key={`${grupo.grupo}-${titulo.ci_titulo}`}
                                  className="border-t border-slate-100 bg-white hover:bg-slate-50/80"
                                >
                                  <td className="px-3 py-2.5 align-top pl-11">
                                    <div className="flex items-start gap-2">
                                      <FileText
                                        className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                        aria-hidden
                                      />
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-800">
                                          {titulo.nro_titulo
                                            ? `Tít. ${titulo.nro_titulo}`
                                            : `CI ${titulo.ci_titulo}`}
                                        </p>
                                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                                          {titulo.descricao || '—'}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="hidden max-w-[180px] px-3 py-2.5 align-top text-slate-600 sm:table-cell">
                                    <span className="line-clamp-2">{titulo.cliente || '—'}</span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                                    {formatDate(titulo.data_vencimento)}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                                    {fechamentoDrill === 'em_aberto'
                                      ? '—'
                                      : formatDate(pagamentoTituloFechamento(titulo.ci_titulo))}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-700">
                                    {formatCurrency(titulo.total)}
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            {view === 'titulos' && !loading && !error && gruposFiltrados.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                {buscaDebounced ? 'Nenhum grupo corresponde à busca.' : 'Nenhum título nesta categoria.'}
              </p>
            )}

            {view === 'titulos' && !loading && !error && gruposFiltrados.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Grupo / Título</th>
                      <th className="hidden px-3 py-2 sm:table-cell">Cliente</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Pagamento</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposFiltrados.map((grupo) => {
                      const expandido = grupoExpandido === grupo.grupo
                      const titulos = titulosPorGrupo(grupo.grupo)
                      return (
                        <Fragment key={grupo.grupo}>
                          <tr
                            className="cursor-pointer border-t border-slate-100 bg-slate-50/60 hover:bg-sky-50/50"
                            onClick={() => toggleGrupo(grupo.grupo)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleGrupo(grupo.grupo)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-expanded={expandido}
                          >
                            <td className="px-3 py-2.5 align-top">
                              <div className="flex items-start gap-2">
                                {expandido ? (
                                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                                ) : (
                                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                                )}
                                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800">{grupo.grupo}</p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {grupo.quantidadeTitulos}{' '}
                                    {grupo.quantidadeTitulos === 1 ? 'título' : 'títulos'} ·{' '}
                                    {grupo.quantidadeItens}{' '}
                                    {grupo.quantidadeItens === 1 ? 'item' : 'itens'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell" />
                            <td className="px-3 py-2.5 align-top" />
                            <td className="px-3 py-2.5 align-top" />
                            <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-800">
                              {formatCurrency(grupo.total)}
                            </td>
                          </tr>
                          {expandido &&
                            titulos.map((titulo) => (
                              <tr
                                key={`${grupo.grupo}-${titulo.ci_titulo}`}
                                className="border-t border-slate-100 bg-white hover:bg-slate-50/80"
                              >
                                <td className="px-3 py-2.5 align-top pl-11">
                                  <div className="flex items-start gap-2">
                                    <FileText
                                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                      aria-hidden
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium text-slate-800">
                                        {titulo.nro_titulo
                                          ? `Tít. ${titulo.nro_titulo}`
                                          : `CI ${titulo.ci_titulo}`}
                                      </p>
                                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                                        {titulo.descricao || '—'}
                                      </p>
                                      {titulo.quantidadeItens > 1 && (
                                        <p className="mt-0.5 text-[11px] text-slate-400">
                                          {titulo.quantidadeItens} itens no título
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="hidden max-w-[180px] px-3 py-2.5 align-top text-slate-600 sm:table-cell">
                                  <span className="line-clamp-2">{titulo.cliente || '—'}</span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                                  {formatDate(titulo.data_vencimento)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-600">
                                  {formatDate(titulo.data_pagamento)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-semibold tabular-nums text-sky-700">
                                  {formatCurrency(titulo.total)}
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {view === 'titulos' && !loading && gruposFiltrados.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {buscaDebounced
                    ? `${qtdTitulosFiltrados} de ${titulosAgg.length} títulos · ${gruposFiltrados.length} grupos`
                    : `${titulosAgg.length} títulos · ${gruposAgg.length} grupos`}
                </span>
                <span className="tabular-nums text-sky-800">
                  {formatCurrency(totalTitulosFiltrados)}
                </span>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
