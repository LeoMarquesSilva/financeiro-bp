import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import type { GrupoEscritorio, FiltroFinanceiro, OrdenacaoEscritorio } from '../services/escritorioService'
import { GrupoEscritorioCard } from '../components/GrupoEscritorioCard'
import { ClienteEscritorioDetailSheet } from '../components/ClienteEscritorioDetailSheet'
import { useGruposEscritorioPaginado } from '../hooks/useGruposEscritorioPaginado'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, parseCurrencyBr } from '@/shared/utils/format'
import { Search, Building2, Loader2, RefreshCw, Filter, ArrowUpDown, AlertTriangle, CircleDollarSign, Banknote, CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type { FiltroFinanceiro, OrdenacaoEscritorio }

const GRUPOS_POR_PAGINA = 12
const DEBOUNCE_BUSCA_MS = 350

export function EscritorioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [busca, setBusca] = useState('')
  const debouncedBusca = useDebounce(busca, DEBOUNCE_BUSCA_MS)

  useEffect(() => {
    const buscaParam = searchParams.get('busca')
    if (buscaParam) {
      setBusca(buscaParam)
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [filtroFinanceiro, setFiltroFinanceiro] = useState<FiltroFinanceiro>('todos')
  const [minValorStr, setMinValorStr] = useState('')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoEscritorio>('nome')
  const [selectedCliente, setSelectedCliente] = useState<ClienteEscritorioRow | null>(null)

  const minValor = useMemo(() => (minValorStr.trim() ? parseCurrencyBr(minValorStr) : 0), [minValorStr])
  const filtros = useMemo(
    () => ({ busca: debouncedBusca, filtroFinanceiro, minValor, ordenacao }),
    [debouncedBusca, filtroFinanceiro, minValor, ordenacao],
  )

  const {
    grupos: filtrado,
    totalCount,
    totalPages,
    page,
    setPage,
    totais,
    loading,
    fetchingResumo,
    loadingEmpresas,
    error,
    refetch,
  } = useGruposEscritorioPaginado(filtros, GRUPOS_POR_PAGINA)

  useEffect(() => {
    setPage(1)
  }, [debouncedBusca, filtroFinanceiro, minValor, ordenacao])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <Building2 className="h-7 w-7 shrink-0 text-slate-600" />
          Escritório
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          Grupos e, dentro de cada grupo, as empresas. Processos (contagem CI), horas (TimeSheets) e financeiro. Atualizado pelo sync.
        </p>
      </header>

      {/* Cards de totais */}
      {!loading && !error && totalCount > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-700">
                <CalendarClock className="h-3.5 w-3.5" /> A vencer
              </p>
              <p className="mt-1 text-xl font-bold text-amber-900">{formatCurrency(totais.aVencer)}</p>
              <p className="text-xs text-amber-600">{totais.countAVencer} grupo(s)</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Em atraso
              </p>
              <p className="mt-1 text-xl font-bold text-red-900">{formatCurrency(totais.emAtraso)}</p>
              <p className="text-xs text-red-600">{totais.countAtraso} grupo(s)</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50/50">
            <CardContent className="pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-600">
                <CircleDollarSign className="h-3.5 w-3.5" /> Em aberto (total)
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(totais.emAberto)}</p>
              <p className="text-xs text-slate-500">{totais.countAberto} grupo(s)</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700">
                <Banknote className="h-3.5 w-3.5" /> Pago
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{formatCurrency(totais.pago)}</p>
              <p className="text-xs text-emerald-600">{totais.countPago} grupo(s)</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Buscar por grupo ou empresa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={loading || fetchingResumo}
          className="shrink-0"
        >
          {(fetchingResumo || loadingEmpresas) && !loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5">Atualizar</span>
        </Button>
      </div>

      {/* Filtros: situação (com contagem) + valor mínimo + ordenação */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Situação:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: 'todos' as const, label: 'Todos', icon: undefined, count: totalCount },
              { value: 'em_atraso' as const, label: 'Em atraso', icon: AlertTriangle, count: totais.countAtraso },
              { value: 'a_vencer' as const, label: 'A vencer', icon: CalendarClock, count: totais.countAVencer },
              { value: 'em_aberto' as const, label: 'Em aberto', icon: CircleDollarSign, count: totais.countAberto },
              { value: 'com_pago' as const, label: 'Com valor pago', icon: Banknote, count: totais.countPago },
            ]
          ).map(({ value, label, icon: Icon, count }) => (
            <Button
              key={value}
              type="button"
              variant={filtroFinanceiro === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroFinanceiro(value)}
              className={cn('shrink-0', filtroFinanceiro === value && 'ring-1 ring-slate-400')}
            >
              {Icon != null && <Icon className="mr-1 h-3.5 w-3.5" />}
              {value === 'todos' ? `${label} (${count})` : `${label} (${count})`}
            </Button>
          ))}
        </div>
        {filtroFinanceiro !== 'todos' && (
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <Label htmlFor="min-valor-escritorio" className="whitespace-nowrap text-sm font-medium text-slate-600">
              Valor mínimo (R$):
            </Label>
            <Input
              id="min-valor-escritorio"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 1000"
              value={minValorStr}
              onChange={(e) => setMinValorStr(e.target.value)}
              className="h-8 w-24"
            />
          </div>
        )}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <ArrowUpDown className="h-4 w-4 text-slate-500" />
          <Label htmlFor="ordenacao-escritorio" className="whitespace-nowrap text-sm font-medium text-slate-600">
            Ordenar:
          </Label>
          <select
            id="ordenacao-escritorio"
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as OrdenacaoEscritorio)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="nome">Nome do grupo</option>
            <option value="atraso">Mais valor em atraso</option>
            <option value="a_vencer">Mais a vencer</option>
            <option value="aberto">Mais valor em aberto</option>
            <option value="pago">Mais valor pago</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && totalCount === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          Nenhum grupo encontrado ou nenhum grupo corresponde aos filtros. Execute o sync do Processos Completo no vios-app.
        </div>
      )}

      {!loading && !error && filtrado.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Grupos</h2>
              <p className="text-sm text-slate-500">
                Cada card é um grupo; dentro dele estão as empresas. Página {page} de {totalPages} ({totalCount} grupo{totalCount !== 1 ? 's' : ''}).
              </p>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loadingEmpresas}
                  className="shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loadingEmpresas}
                  className="shrink-0"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {loadingEmpresas && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando empresas da página...
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtrado.map((grupo: GrupoEscritorio) => (
              <GrupoEscritorioCard
                key={grupo.grupo_cliente}
                grupo={grupo}
                onSelectCliente={setSelectedCliente}
              />
            ))}
          </div>
        </section>
      )}

      <ClienteEscritorioDetailSheet
        open={!!selectedCliente}
        onClose={() => setSelectedCliente(null)}
        cliente={selectedCliente}
      />
    </div>
  )
}
