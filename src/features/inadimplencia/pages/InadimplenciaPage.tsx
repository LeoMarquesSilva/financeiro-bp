import { useState, useEffect } from 'react'
import { useFiltros } from '../hooks/useFiltros'
import { useInadimplencia } from '../hooks/useInadimplencia'
import { useDashboard } from '../hooks/useDashboard'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { inadimplenciaService } from '../services/inadimplenciaService'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { FiltrosInadimplencia } from '../components/FiltrosInadimplencia'
import { KPIsHeader } from '../components/KPIsHeader'
import { InadimplenciaCard } from '../components/InadimplenciaCard'
import { ModalCadastro } from '../components/ModalCadastro'
import { ConfirmarResolverModal } from '../components/ConfirmarResolverModal'
import { EmptyState } from '../components/EmptyState'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Plus, Download } from 'lucide-react'

const PAGE_SIZE = 20

export function InadimplenciaPage() {
  const [modalCadastroOpen, setModalCadastroOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

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
    listagemParams.valorMin,
    listagemParams.valorMax,
    listagemParams.diasMin,
    listagemParams.diasMax,
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Inadimplência
        </h1>
        <div className="flex gap-2">
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
            Novo Cliente Inadimplente
          </Button>
        </div>
      </div>

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

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar lista. Tente novamente.
        </p>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-slate-200" />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientes.map((client) => (
              <InadimplenciaCard
                key={client.id}
                client={client}
                onMarcarResolvido={handleMarcarResolvido}
                onRefresh={refetch}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
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
      <ConfirmarResolverModal
        open={!!resolvingId}
        clientName={resolvingId ? clientes.find((c) => c.id === resolvingId)?.razao_social : null}
        onClose={() => setResolvingId(null)}
        onConfirm={handleConfirmarResolver}
        loading={marcarResolvido.isPending}
      />
    </div>
  )
}
