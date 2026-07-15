import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { formatCnpj, formatCurrency, formatDate, formatHorasDuracao } from '@/shared/utils/format'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import type { InadimplenciaGrupoStatus } from '../services/inadimplenciaGruposIndex'
import { fetchEscritorioEmpresaDetalhe } from '../services/escritorioService'
import { InadimplenciaGrupoBadges } from './InadimplenciaGrupoBadges'
import { fetchPagamentosPorPeriodo, fetchParcelasPorCliente, type ParcelaRow } from '@/features/inadimplencia/services/parcelasService'
import { Briefcase, Clock, Building2, Banknote, Loader2, CalendarRange, ChevronDown, ChevronRight, AlertTriangle, CircleDollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ClienteEscritorioDetailSheetProps {
  open: boolean
  onClose: () => void
  cliente: ClienteEscritorioRow | null
  /** Todas as empresas do grupo (para trocar sem fechar o painel) */
  grupoEmpresas?: ClienteEscritorioRow[]
  onClienteChange?: (cliente: ClienteEscritorioRow) => void
  inadimplencia?: InadimplenciaGrupoStatus | null
  /** Abre já com escopo "todo o grupo" (ex.: clique no nome do grupo) */
  escopoGrupoInicial?: boolean
}

function getDefaultPeriod(): { dataInicio: string; dataFim: string } {
  const now = new Date()
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    dataInicio: inicio.toISOString().slice(0, 10),
    dataFim: now.toISOString().slice(0, 10),
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

type PeriodoPreset = 'mes_atual' | 'mes_anterior' | 'ultimos_30' | 'ultimos_90'

function applyPreset(preset: PeriodoPreset): { dataInicio: string; dataFim: string } {
  const hoje = new Date()
  const fim = toIsoDate(hoje)
  switch (preset) {
    case 'mes_atual':
      return { dataInicio: toIsoDate(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), dataFim: fim }
    case 'mes_anterior': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
      return { dataInicio: toIsoDate(inicio), dataFim: toIsoDate(ultimoDia) }
    }
    case 'ultimos_30': {
      const inicio = new Date(hoje)
      inicio.setDate(inicio.getDate() - 29)
      return { dataInicio: toIsoDate(inicio), dataFim: fim }
    }
    case 'ultimos_90': {
      const inicio = new Date(hoje)
      inicio.setDate(inicio.getDate() - 89)
      return { dataInicio: toIsoDate(inicio), dataFim: fim }
    }
  }
}

function grupoKey(empresas: ClienteEscritorioRow[]): string {
  return empresas
    .map((e) => e.id)
    .sort()
    .join(',')
}

function PagamentoItem({ p }: { p: ParcelaRow }) {
  const valor = Number(p.valor_pago ?? p.valor ?? 0)
  const titulo = [p.nro_titulo, p.parcela && p.parcelas ? `${p.parcela}/${p.parcelas}` : p.parcela]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/60 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold text-slate-800">{formatDate(p.data_baixa)}</p>
        {titulo && <p className="truncate text-xs text-slate-500">{titulo}</p>}
        {p.plano_contas && (
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-500">Plano de contas: </span>
            {p.plano_contas}
          </p>
        )}
        {p.forma && <p className="text-xs text-slate-400">{p.forma}</p>}
        {p.descricao && <p className="line-clamp-2 text-xs text-slate-400">{p.descricao}</p>}
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700">
        {formatCurrency(valor)}
      </span>
    </li>
  )
}

function TituloAbertoItem({ p, valueColor }: { p: ParcelaRow; valueColor: string }) {
  const valor = Number(p.valor ?? 0)
  const titulo = [p.nro_titulo, p.parcela && p.parcelas ? `${p.parcela}/${p.parcelas}` : p.parcela]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/60 bg-white px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-semibold text-slate-800">{formatDate(p.data_vencimento)}</p>
        {titulo && <p className="truncate text-xs text-slate-500">{titulo}</p>}
        {p.plano_contas && (
          <p className="text-xs text-slate-600">
            <span className="font-medium text-slate-500">Plano de contas: </span>
            {p.plano_contas}
          </p>
        )}
        {p.descricao && <p className="line-clamp-2 text-xs text-slate-400">{p.descricao}</p>}
      </div>
      <span className={cn('shrink-0 text-sm font-bold tabular-nums', valueColor)}>
        {formatCurrency(valor)}
      </span>
    </li>
  )
}

function CollapsibleTitulos({
  icon: Icon,
  title,
  count,
  variant,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType
  title: string
  count: number
  variant: 'danger' | 'warning'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const styles = {
    danger: { bg: 'bg-red-50/60', border: 'border-red-200/60', icon: 'text-red-600', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
    warning: { bg: 'bg-amber-50/60', border: 'border-amber-200/60', icon: 'text-amber-600', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  }
  const s = styles[variant]

  return (
    <div className={cn('rounded-xl border', s.border, s.bg)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
      >
        <Icon className={cn('h-4 w-4 shrink-0', s.icon)} />
        <span className={cn('flex-1 text-sm font-semibold', s.text)}>{title}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', s.badge)}>{count}</span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="border-t border-inherit px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

export function ClienteEscritorioDetailSheet({
  open,
  onClose,
  cliente,
  grupoEmpresas = [],
  onClienteChange,
  inadimplencia,
  escopoGrupoInicial = false,
}: ClienteEscritorioDetailSheetProps) {
  const [periodo, setPeriodo] = useState(getDefaultPeriod)
  const [escopoGrupo, setEscopoGrupo] = useState(false)
  const grupoKeyRef = useRef<string | null>(null)

  const empresasDoGrupo = grupoEmpresas.length > 0 ? grupoEmpresas : cliente ? [cliente] : []
  const temVariasEmpresas = empresasDoGrupo.length > 1
  const grupoPessoaIds = empresasDoGrupo.map((e) => e.id)

  // Reseta filtros só ao abrir um grupo diferente — troca de empresa mantém o período
  useEffect(() => {
    if (!open || empresasDoGrupo.length === 0) {
      if (!open) grupoKeyRef.current = null
      return
    }
    const key = grupoKey(empresasDoGrupo)
    if (key !== grupoKeyRef.current) {
      setPeriodo(getDefaultPeriod())
      setEscopoGrupo(escopoGrupoInicial && temVariasEmpresas)
      grupoKeyRef.current = key
    }
  }, [open, empresasDoGrupo, escopoGrupoInicial, temVariasEmpresas])

  const pessoaIds = useMemo(() => {
    if (!cliente) return []
    if (escopoGrupo && grupoPessoaIds.length > 0) return grupoPessoaIds
    return [cliente.id]
  }, [cliente, escopoGrupo, grupoPessoaIds])

  const periodoValido = periodo.dataInicio && periodo.dataFim && periodo.dataInicio <= periodo.dataFim

  const { data: pagamentos, isLoading: loadingPagamentos, isFetching } = useQuery({
    queryKey: ['escritorio-pagamentos', pessoaIds.join(','), periodo.dataInicio, periodo.dataFim],
    queryFn: () =>
      fetchPagamentosPorPeriodo({
        pessoa_ids: pessoaIds,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        clienteNome: cliente?.nome,
      }),
    enabled: open && !!cliente && periodoValido,
  })

  const { data: parcelasAbertas, isLoading: loadingAbertas, isFetching: fetchingAbertas } = useQuery({
    queryKey: ['escritorio-titulos-abertos', pessoaIds.join(',')],
    queryFn: () =>
      fetchParcelasPorCliente({
        pessoa_id: pessoaIds.length === 1 ? pessoaIds[0] : null,
        pessoa_ids: pessoaIds,
        razao_social: cliente?.nome ?? '',
      }),
    enabled: open && !!cliente && pessoaIds.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  const { data: empresaDetalhe } = useQuery({
    queryKey: ['escritorio', 'empresa-detalhe', cliente?.id],
    queryFn: () => fetchEscritorioEmpresaDetalhe(cliente!.id),
    enabled: open && !!cliente?.id,
    staleTime: 5 * 60 * 1000,
  })

  if (!cliente) return null

  const processos = Number(cliente.qtd_processos) || 0
  const horas = Number(cliente.horas_total) || 0
  const grupo = cliente.grupo_cliente?.trim() || null
  const grupoLink = grupo ?? cliente.nome
  const horasPorAno = empresaDetalhe?.horas_por_ano ?? cliente.horas_por_ano ?? {}
  const hasInadimplencia = !!(inadimplencia?.ativa || inadimplencia?.resolvida)
  const totalPago = pagamentos?.totalPago ?? 0
  const parcelasPagas = pagamentos?.parcelas ?? []
  const emAtraso = parcelasAbertas?.emAtraso ?? []
  const aVencer = parcelasAbertas?.aVencer ?? []
  const totalAberto =
    emAtraso.reduce((s: number, p: ParcelaRow) => s + Number(p.valor ?? 0), 0) +
    aVencer.reduce((s: number, p: ParcelaRow) => s + Number(p.valor ?? 0), 0)
  const totalEmAtraso = emAtraso.reduce((s: number, p: ParcelaRow) => s + Number(p.valor ?? 0), 0)
  const hasTitulosAbertos = emAtraso.length > 0 || aVencer.length > 0

  const handleEmpresaChange = (id: string) => {
    const next = empresasDoGrupo.find((e) => e.id === id)
    if (next && next.id !== cliente.id) {
      onClienteChange?.(next)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl',
          inadimplencia?.ativa && 'border-l-red-200'
        )}
      >
        <SheetHeader className="border-b border-slate-200 px-6 py-4">
          {temVariasEmpresas ? (
            <div className="space-y-1.5 pr-8">
              <Label htmlFor="empresa-grupo-select" className="text-xs font-medium text-slate-500">
                Empresa do grupo
              </Label>
              <div className="relative">
                <select
                  id="empresa-grupo-select"
                  value={cliente.id}
                  onChange={(e) => handleEmpresaChange(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-base font-semibold text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {empresasDoGrupo.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          ) : (
            <SheetTitle className="pr-8 text-xl text-slate-900">{cliente.nome}</SheetTitle>
          )}
          <SheetDescription className={grupo ? 'mt-2 flex items-center gap-2 text-slate-500' : 'sr-only'}>
            {grupo ? (
              <>
                <Building2 className="h-4 w-4 shrink-0" />
                {grupo}
              </>
            ) : (
              'Detalhes do cliente'
            )}
          </SheetDescription>
          {hasInadimplencia && (
            <InadimplenciaGrupoBadges
              ativa={inadimplencia?.ativa}
              resolvida={inadimplencia?.resolvida}
              grupoNome={grupoLink}
              size="md"
              className="mt-3"
            />
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <section className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-slate-600" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Títulos em aberto
              </h4>
            </div>

            {temVariasEmpresas && (
              <div className="mb-3 flex gap-1.5">
                <Button
                  type="button"
                  variant={!escopoGrupo ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEscopoGrupo(false)}
                >
                  Empresa selecionada
                </Button>
                <Button
                  type="button"
                  variant={escopoGrupo ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEscopoGrupo(true)}
                >
                  Todo o grupo ({empresasDoGrupo.length})
                </Button>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {(loadingAbertas || fetchingAbertas) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-slate-500" />
                  )}
                  <span>
                    {emAtraso.length} em atraso · {aVencer.length} a vencer
                    {escopoGrupo && temVariasEmpresas && (
                      <span className="text-slate-400"> · grupo inteiro</span>
                    )}
                  </span>
                </div>
                <p className="text-xl font-bold tabular-nums text-slate-800">
                  {formatCurrency(totalAberto)}
                </p>
              </div>
              {totalEmAtraso > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  {formatCurrency(totalEmAtraso)} em atraso
                </p>
              )}
            </div>

            {!loadingAbertas && !hasTitulosAbertos && (
              <p className="mt-3 text-sm text-slate-500">Nenhum título em aberto para o escopo selecionado.</p>
            )}

            {hasTitulosAbertos && (
              <div className="mt-3 space-y-3">
                {emAtraso.length > 0 && (
                  <CollapsibleTitulos icon={AlertTriangle} title="Em atraso" count={emAtraso.length} variant="danger">
                    <ul className="max-h-56 space-y-2 overflow-y-auto">
                      {emAtraso.map((p: ParcelaRow) => (
                        <TituloAbertoItem key={p.id} p={p} valueColor="text-red-700" />
                      ))}
                    </ul>
                  </CollapsibleTitulos>
                )}
                {aVencer.length > 0 && (
                  <CollapsibleTitulos icon={Clock} title="A vencer" count={aVencer.length} variant="warning" defaultOpen={emAtraso.length === 0}>
                    <ul className="max-h-56 space-y-2 overflow-y-auto">
                      {aVencer.map((p: ParcelaRow) => (
                        <TituloAbertoItem key={p.id} p={p} valueColor="text-amber-700" />
                      ))}
                    </ul>
                  </CollapsibleTitulos>
                )}
              </div>
            )}
          </section>

          <section className="mb-6 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Pagamentos no período
              </h4>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'mes_atual' as const, label: 'Este mês' },
                  { id: 'mes_anterior' as const, label: 'Mês anterior' },
                  { id: 'ultimos_30' as const, label: '30 dias' },
                  { id: 'ultimos_90' as const, label: '90 dias' },
                ] as const
              ).map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 bg-white text-xs"
                  onClick={() => setPeriodo(applyPreset(id))}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pagamento-de" className="text-xs text-slate-600">
                  De
                </Label>
                <Input
                  id="pagamento-de"
                  type="date"
                  value={periodo.dataInicio}
                  onChange={(e) => setPeriodo((p) => ({ ...p, dataInicio: e.target.value }))}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pagamento-ate" className="text-xs text-slate-600">
                  Até
                </Label>
                <Input
                  id="pagamento-ate"
                  type="date"
                  value={periodo.dataFim}
                  onChange={(e) => setPeriodo((p) => ({ ...p, dataFim: e.target.value }))}
                  className="bg-white"
                />
              </div>
            </div>

            {!periodoValido && (
              <p className="mt-3 text-xs text-red-600">Informe um período válido (data inicial ≤ final).</p>
            )}

            <div className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {(loadingPagamentos || isFetching) && periodoValido ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  ) : (
                    <CalendarRange className="h-4 w-4 text-emerald-600" />
                  )}
                  <span>
                    {formatDate(periodo.dataInicio)} — {formatDate(periodo.dataFim)}
                    {escopoGrupo && temVariasEmpresas && (
                      <span className="text-slate-400"> · grupo inteiro</span>
                    )}
                    {!escopoGrupo && temVariasEmpresas && (
                      <span className="text-slate-400"> · {cliente.nome.split(' ')[0]}</span>
                    )}
                  </span>
                </div>
                <p className="text-xl font-bold tabular-nums text-emerald-800">
                  {formatCurrency(totalPago)}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {parcelasPagas.length === 0
                  ? 'Nenhum pagamento no período'
                  : `${parcelasPagas.length} pagamento${parcelasPagas.length !== 1 ? 's' : ''} registrado${parcelasPagas.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {parcelasPagas.length > 0 && (
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {parcelasPagas.map((p: ParcelaRow) => (
                  <PagamentoItem key={p.id} p={p} />
                ))}
              </ul>
            )}
          </section>

          <section className="mb-6">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Processos e horas
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Briefcase className="h-4 w-4" />
                  <span className="text-xs font-medium">Processos</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">{processos}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Horas total</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatHorasDuracao(horas)}
                </p>
              </div>
            </div>
          </section>

          {cliente.cpf_cnpj && (
            <section className="mb-6">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                CNPJ/CPF
              </h4>
              <p className="font-mono text-sm text-slate-700">{formatCnpj(cliente.cpf_cnpj)}</p>
            </section>
          )}

          {Object.keys(horasPorAno).length > 0 && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Horas por ano (TimeSheets)
              </h4>
              <ul className="space-y-2">
                {Object.entries(horasPorAno)
                  .filter(([, h]) => Number(h) > 0)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([ano, h]) => (
                    <li key={ano} className="flex justify-between gap-2 text-sm">
                      <span className="text-slate-600">{ano}</span>
                      <strong className="text-slate-900">{formatHorasDuracao(Number(h))}</strong>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
