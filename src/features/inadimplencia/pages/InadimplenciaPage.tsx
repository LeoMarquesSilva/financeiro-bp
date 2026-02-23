import { useState, useEffect } from 'react'
import type { ClientInadimplenciaRow } from '../types/inadimplencia.types'
import type { TeamMember } from '@/lib/database.types'
import { useFiltros } from '../hooks/useFiltros'
import { useInadimplencia } from '../hooks/useInadimplencia'
import { useDashboard } from '../hooks/useDashboard'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { inadimplenciaService } from '../services/inadimplenciaService'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { getTeamMember } from '@/lib/teamAvatars'
import { FiltrosInadimplencia } from '../components/FiltrosInadimplencia'
import { KPIsHeader } from '../components/KPIsHeader'
import { InadimplenciaCard } from '../components/InadimplenciaCard'
import { InadimplenciaCardCompact } from '../components/InadimplenciaCardCompact'
import { ModalCadastro } from '../components/ModalCadastro'
import { ConfirmarResolverModal } from '../components/ConfirmarResolverModal'
import { ClienteDetailSheet } from '../components/ClienteDetailSheet'
import { EmptyState } from '../components/EmptyState'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Download, LayoutGrid, Columns3, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InadimplenciaClasse } from '@/lib/database.types'

const PAGE_SIZE = 20

type ViewMode = 'grid' | 'kanban-classe' | 'kanban-gestor'

const CLASSES_ORDER: InadimplenciaClasse[] = ['A', 'B', 'C']

function groupByClasse(clientes: ClientInadimplenciaRow[]): Record<InadimplenciaClasse, ClientInadimplenciaRow[]> {
  const groups: Record<InadimplenciaClasse, ClientInadimplenciaRow[]> = {
    A: [],
    B: [],
    C: [],
  }
  for (const c of clientes) {
    groups[c.status_classe].push(c)
  }
  return groups
}

function groupByGestor(
  clientes: ClientInadimplenciaRow[],
  teamMembers: TeamMember[]
): Array<{ label: string; member: TeamMember | null; clients: ClientInadimplenciaRow[] }> {
  const map = new Map<string, { member: TeamMember | null; clients: ClientInadimplenciaRow[] }>()
  for (const c of clientes) {
    const member = resolveTeamMember(c.gestor ?? null, teamMembers)
    const label = member ? member.full_name : (c.gestor?.trim() || 'Sem gestor')
    const entry = map.get(label)
    if (entry) {
      entry.clients.push(c)
    } else {
      map.set(label, { member, clients: [c] })
    }
  }
  return Array.from(map.entries())
    .map(([label, { member, clients }]) => ({ label, member, clients }))
    .sort((a, b) => {
      if (a.label === 'Sem gestor') return 1
      if (b.label === 'Sem gestor') return -1
      return a.label.localeCompare(b.label)
    })
}

export function InadimplenciaPage() {
  const [modalCadastroOpen, setModalCadastroOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedClient, setSelectedClient] = useState<ClientInadimplenciaRow | null>(null)

  const { teamMembers } = useTeamMembers()
  const { listagemParams, orderBy, orderDesc, ...filtrosHandlers } = useFiltros(400)
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [
    listagemParams.busca,
    listagemParams.gestor,
    listagemParams.area,
    listagemParams.classe,
    listagemParams.prioridade,
    listagemParams.orderBy,
    listagemParams.orderDesc,
  ])
  const { data: clientes, total, loading, error, refetch } = useInadimplencia({
    ...listagemParams,
    page,
    pageSize: PAGE_SIZE,
  })
  const { data: dashboardData, loading: dashboardLoading } = useDashboard()
  const { marcarResolvido } = useInadimplenciaMutations()

  const handleExport = async () => {
    setExporting(true)
    try {
      const { page: _p, pageSize: _ps, ...exportParams } = listagemParams
      const { data: rows, error } = await inadimplenciaService.listForExport(exportParams)
      if (error) {
        toast.error('Erro ao exportar')
        return
      }
      const csv = inadimplenciaService.buildExportCsv(rows ?? [])
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inadimplencia-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exportados ${rows?.length ?? 0} clientes`)
    } finally {
      setExporting(false)
    }
  }

  const handleMarcarResolvido = (id: string) => setResolvingId(id)

  const handleConfirmarResolver = () => {
    if (!resolvingId) return
    marcarResolvido.mutate(resolvingId, {
      onSuccess: () => {
        toast.success('Cliente marcado como resolvido')
        setResolvingId(null)
        refetch()
      },
      onError: () => {
        toast.error('Erro ao marcar como resolvido')
        setResolvingId(null)
      },
    })
  }

  const totais = dashboardData?.totais
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  return (
    <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
      {/* Cabeçalho da página */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Inadimplência
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe e gerencie clientes inadimplentes
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || loading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>
          <Button
            type="button"
            onClick={() => setModalCadastroOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova inadimplência
          </Button>
        </div>
      </header>

      <KPIsHeader
        totalEmAberto={totais?.totalEmAberto ?? 0}
        totalClasseA={totais?.totalClasseA ?? 0}
        totalClasseB={totais?.totalClasseB ?? 0}
        totalClasseC={totais?.totalClasseC ?? 0}
        taxaRecuperacao={totais?.percentualRecuperacao ?? 0}
        followUpVencidos={dashboardData?.followUpAlerts?.vencidos}
        followUpAVencer={dashboardData?.followUpAlerts?.aVencerEm7Dias}
        loading={dashboardLoading}
      />

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <FiltrosInadimplencia
          filtros={filtrosHandlers.filtros}
          orderBy={orderBy}
          orderDesc={orderDesc}
          teamMembers={teamMembers}
          onBuscaChange={filtrosHandlers.setBusca}
          onGestorChange={filtrosHandlers.setGestor}
          onAreaChange={filtrosHandlers.setArea}
          onClasseChange={filtrosHandlers.setClasse}
          onPrioridadeChange={filtrosHandlers.setPrioridade}
          onOrderChange={filtrosHandlers.setOrderBy}
          onReset={filtrosHandlers.reset}
        />
      </section>

      {!loading && clientes.length > 0 && (
        <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 w-fit shadow-sm" role="group" aria-label="Visualização">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Grid"
            className={cn(
              'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-all',
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban-classe')}
            title="Kanban por Classe"
            className={cn(
              'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-all',
              viewMode === 'kanban-classe'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            )}
          >
            <Columns3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban-gestor')}
            title="Kanban por Gestor"
            className={cn(
              'flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-all',
              viewMode === 'kanban-gestor'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            )}
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar lista. Tente novamente.
        </p>
      )}

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      )}

      {!loading && clientes.length === 0 && (
        <EmptyState
          hasActiveFilters={
            !!(
              listagemParams.busca ||
              listagemParams.gestor ||
              listagemParams.area ||
              listagemParams.classe ||
              listagemParams.prioridade
            )
          }
          onNovoCliente={() => setModalCadastroOpen(true)}
          onLimparFiltros={filtrosHandlers.reset}
        />
      )}

      {!loading && clientes.length > 0 && (
        <>
          {viewMode === 'grid' && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {clientes.map((client: ClientInadimplenciaRow) => (
                <InadimplenciaCard
                  key={client.id}
                  client={client}
                  onMarcarResolvido={handleMarcarResolvido}
                  onRefresh={refetch}
                  onSelectClient={setSelectedClient}
                />
              ))}
            </div>
          )}

          {viewMode === 'kanban-classe' && (
            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CLASSES_ORDER.map((classe) => {
                const byClasse = groupByClasse(clientes)
                const items = byClasse[classe]
                return (
                  <div
                    key={classe}
                    className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <h3 className="mb-3 font-semibold text-slate-900">
                      Classe {classe}
                      <span className="ml-2 text-sm font-normal text-slate-500">({items.length})</span>
                    </h3>
                    <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0">
                      {items.map((client) => (
                        <InadimplenciaCardCompact
                          key={client.id}
                          client={client}
                          onMarcarResolvido={handleMarcarResolvido}
                          onRefresh={refetch}
                          onSelectClient={setSelectedClient}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {viewMode === 'kanban-gestor' && (
            <div className="-mx-2 flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden pb-2 px-2 sm:-mx-4 sm:px-4 md:gap-6">
              {groupByGestor(clientes, teamMembers).map(({ label, member, clients: items }) => {
                const avatarUrl = member
                  ? getTeamMember(member.email)?.avatar ?? member.avatar_url
                  : null
                const iniciais = member
                  ? member.full_name.trim().split(/\s+/).length >= 2
                    ? (member.full_name.trim().split(/\s+/)[0][0] + member.full_name.trim().split(/\s+/).pop()![0]).toUpperCase()
                    : member.full_name.slice(0, 2).toUpperCase()
                  : '–'
                return (
                <div
                  key={label}
                  className="flex min-w-[280px] w-[min(100%,320px)] sm:min-w-[300px] sm:w-80 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-4 snap-start"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={label} />}
                      <AvatarFallback className="text-sm">{iniciais}</AvatarFallback>
                    </Avatar>
                    <h3 className="min-w-0 truncate font-semibold text-slate-900" title={label}>
                      {label}
                      <span className="ml-2 text-sm font-normal text-slate-500">({items.length})</span>
                    </h3>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0">
                    {items.map((client) => (
                      <InadimplenciaCardCompact
                        key={client.id}
                        client={client}
                        onMarcarResolvido={handleMarcarResolvido}
                        onRefresh={refetch}
                        onSelectClient={setSelectedClient}
                      />
                    ))}
                  </div>
                </div>
                )
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-slate-600">
                Página {page} de {totalPages}
                {total > 0 && (
                  <span className="ml-1 text-slate-400">
                    ({total} {total === 1 ? 'cliente' : 'clientes'})
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <ModalCadastro
        open={modalCadastroOpen}
        onClose={() => setModalCadastroOpen(false)}
        onSuccess={() => {
          setModalCadastroOpen(false)
          refetch()
        }}
      />
      <ClienteDetailSheet
        open={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        client={selectedClient}
        onMarcarResolvido={handleMarcarResolvido}
        onRefresh={refetch}
      />
      <ConfirmarResolverModal
        open={!!resolvingId}
        clientName={resolvingId ? clientes.find((c: ClientInadimplenciaRow) => c.id === resolvingId)?.razao_social : null}
        onClose={() => setResolvingId(null)}
        onConfirm={handleConfirmarResolver}
        loading={marcarResolvido.isPending}
      />
    </div>
  )
}
