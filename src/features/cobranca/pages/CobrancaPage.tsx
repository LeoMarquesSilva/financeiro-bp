import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useAuth } from '@/lib/AuthContext'
import {
  useCobrancaPainel,
  useCobrancaResumo,
  useCobrancaArquivados,
  usePlanoContasOpcoes,
} from '../hooks/useCobrancaPainel'
import { useCobrancaTemplates } from '../hooks/useCobrancaTemplates'
import { cobrancaService, type ArquivadoRow, type FaixaAtrasoFiltro, type StatusCobrancaFiltro } from '../services/cobrancaService'
import { useWhatsappNotifications } from '../notifications/WhatsappNotificationsProvider'
import type { PendingWhatsappCobranca } from '../types/cobranca.types'
import { CobrancaKPIs } from '../components/CobrancaKPIs'
import { CobrancaFiltros } from '../components/CobrancaFiltros'
import { CobrancaTable } from '../components/CobrancaTable'
import { CobrancaDashboard } from '../components/CobrancaDashboard'
import { EditarContatoModal } from '../components/EditarContatoModal'
import { ConfirmarCobrancaModal } from '../components/ConfirmarCobrancaModal'
import { CobrarGrupoModal } from '../components/CobrarGrupoModal'
import { WhatsappInbox } from '../components/WhatsappInbox'
import {
  BellRing,
  MessageCircle,
  Send,
  Inbox,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import type { CobrancaPainelRow } from '@/lib/database.types'
import { canArquivarCobranca } from '../utils/permissions'

const PAGE_SIZE = 50

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

const ANO_ATUAL = new Date().getFullYear()
const ANOS = Array.from({ length: ANO_ATUAL - 2019 + 1 }, (_, i) => ANO_ATUAL - i)

export function CobrancaPage() {
  const { fullName, role, user } = useAuth()
  const canArquivar = canArquivarCobranca(role, user?.email)
  const { templates } = useCobrancaTemplates()
  const { unreadTotal, unreadChats } = useWhatsappNotifications()

  const [tab, setTab] = useState('painel')
  const [buscaInput, setBuscaInput] = useState('')
  const busca = useDebounce(buscaInput, 400)
  const [incluirConcluidos, setIncluirConcluidos] = useState(false)
  const [verArquivados, setVerArquivados] = useState(false)
  const [mes, setMes] = useState<number | null>(null)
  const [ano, setAno] = useState<number | null>(null)
  const [planoContas, setPlanoContas] = useState<string | null>(null)
  const [statusCobranca, setStatusCobranca] = useState<StatusCobrancaFiltro | null>(null)
  const [faixaAtraso, setFaixaAtraso] = useState<FaixaAtrasoFiltro | null>(null)
  const [rotinaVencidosOntem, setRotinaVencidosOntem] = useState(true)
  const [page, setPage] = useState(1)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editRow, setEditRow] = useState<CobrancaPainelRow | null>(null)
  const [canalEnvio, setCanalEnvio] = useState<'whatsapp' | 'email' | null>(null)
  const [pendingWhatsapp, setPendingWhatsapp] = useState<PendingWhatsappCobranca | null>(null)
  const [grupoParaCobrar, setGrupoParaCobrar] = useState<CobrancaPainelRow[]>([])

  const filtrosBase = {
    busca,
    incluirConcluidos,
    mes,
    ano,
    planoContas,
    statusCobranca,
    faixaAtraso,
    rotinaVencidosOntem,
  }

  const { data: rows, total, loading, refetch } = useCobrancaPainel({
    ...filtrosBase,
    page,
    pageSize: PAGE_SIZE,
  })
  const { resumo, loading: loadingResumo } = useCobrancaResumo(filtrosBase)

  const queryClient = useQueryClient()
  // Atualiza tanto a lista paginada quanto o resumo agregado (KPIs) após mutações.
  const refreshPainel = useCallback(() => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['cobranca', 'painel-resumo'] })
    queryClient.invalidateQueries({ queryKey: ['cobranca', 'kpi-rows'] })
  }, [refetch, queryClient])

  useEffect(() => {
    if (tab !== 'painel' && tab !== 'indicadores') return
    queryClient.invalidateQueries({ queryKey: ['cobranca', 'painel'] })
    queryClient.invalidateQueries({ queryKey: ['cobranca', 'painel-resumo'] })
    queryClient.invalidateQueries({ queryKey: ['cobranca', 'kpi-rows'] })
  }, [tab, queryClient])
  const { opcoes: planoContasOpcoes } = usePlanoContasOpcoes()
  const { data: arquivados, loading: loadingArquivados, refetch: refetchArquivados } =
    useCobrancaArquivados(verArquivados)

  const selectedRows = useMemo(
    () => rows.filter((r: CobrancaPainelRow) => selectedIds.has(r.parcela_id)),
    [rows, selectedIds],
  )

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allSelected =
        rows.length > 0 && rows.every((r: CobrancaPainelRow) => prev.has(r.parcela_id))
      if (allSelected) return new Set()
      return new Set(rows.map((r: CobrancaPainelRow) => r.parcela_id))
    })
  }

  const handleArquivar = async (row: CobrancaPainelRow) => {
    if (!canArquivar) {
      toast.error('Sem permissão para remover títulos do painel.')
      return
    }
    try {
      await cobrancaService.arquivar(row.parcela_id, null, fullName)
      toast.success('Título removido do painel', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await cobrancaService.desarquivar(row.parcela_id)
            refreshPainel()
          },
        },
      })
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.parcela_id)
        return next
      })
      refreshPainel()
    } catch {
      toast.error('Erro ao remover título')
    }
  }

  const handleDesarquivar = async (parcela_id: string) => {
    if (!canArquivar) {
      toast.error('Sem permissão para reativar títulos arquivados.')
      return
    }
    try {
      await cobrancaService.desarquivar(parcela_id)
      toast.success('Título reativado no painel')
      refetchArquivados()
      refreshPainel()
    } catch {
      toast.error('Erro ao reativar título')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  const resetPage = () => setPage(1)

  const limparFiltros = () => {
    setMes(null)
    setAno(null)
    setPlanoContas(null)
    setStatusCobranca(null)
    setFaixaAtraso(null)
    setRotinaVencidosOntem(true)
    resetPage()
  }

  const iniciarCobrancaWhatsapp = () => {
    const rows = selectedRows.filter(
      (r: CobrancaPainelRow) => r.pessoa_id || r.pessoa_telefone?.trim(),
    )
    if (rows.length === 0) {
      toast.error('Nenhum cliente selecionado possui telefone cadastrado.')
      return
    }
    if (rows.length === 1) {
      setGrupoParaCobrar(rows)
      return
    }
    setCanalEnvio('whatsapp')
  }

  const handleWhatsappEnviado = () => {
    setPendingWhatsapp(null)
    setSelectedIds(new Set())
    refreshPainel()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <BellRing className="h-6 w-6 text-slate-600" />
            Cobrança
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Rotina diária D+1: cobrar por WhatsApp os títulos cuja data-alvo é hoje
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="painel">
            <Inbox className="h-4 w-4" />
            Painel de cobrança
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
            {unreadTotal > 0 && (
              <span
                className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white"
                title={
                  unreadChats === 1
                    ? `1 conversa não lida · ${unreadTotal} mensagem${unreadTotal === 1 ? '' : 'ns'}`
                    : `${unreadChats} conversas não lidas · ${unreadTotal} mensagens`
                }
              >
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="indicadores">
            <Target className="h-4 w-4" />
            Indicadores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-6 space-y-5">
          <CobrancaKPIs resumo={resumo} loading={loadingResumo} />

          <CobrancaFiltros
            totalTitulos={total}
            filtros={{
              buscaInput,
              mes,
              ano,
              planoContas,
              statusCobranca,
              faixaAtraso,
              rotinaVencidosOntem,
              incluirConcluidos,
              verArquivados,
            }}
            meses={MESES}
            anos={ANOS}
            planoContasOpcoes={planoContasOpcoes}
            onBuscaChange={(v) => {
              setBuscaInput(v)
              resetPage()
            }}
            onMesChange={(v) => {
              setMes(v)
              resetPage()
            }}
            onAnoChange={(v) => {
              setAno(v)
              resetPage()
            }}
            onPlanoContasChange={(v) => {
              setPlanoContas(v)
              resetPage()
            }}
            onStatusCobrancaChange={(v) => {
              setStatusCobranca(v)
              resetPage()
            }}
            onFaixaAtrasoChange={(v) => {
              setFaixaAtraso(v)
              resetPage()
            }}
            onToggleConcluidos={() => {
              setIncluirConcluidos((v) => !v)
              resetPage()
            }}
            onToggleRotinaVencidosOntem={() => {
              setRotinaVencidosOntem((v) => {
                const next = !v
                if (next) {
                  setMes(null)
                  setAno(null)
                }
                return next
              })
              resetPage()
            }}
            onToggleArquivados={
              canArquivar ? () => setVerArquivados((v) => !v) : undefined
            }
            onLimpar={limparFiltros}
          />

          <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2 shadow-sm">
            <span className="mr-auto text-sm text-slate-500">
              {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : `${total} título(s)`}
            </span>
            <Button
              size="sm"
              onClick={iniciarCobrancaWhatsapp}
              disabled={selectedIds.size === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              Cobrar por WhatsApp
            </Button>
          </div>

          {/* Lista de arquivados */}
          {verArquivados && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-amber-900">Títulos arquivados (fora do painel)</h3>
              <p className="mb-3 text-xs text-amber-800">
                Estes títulos não entram no valor pendente nem na fila de cobrança ativa.
              </p>
              {loadingArquivados ? (
                <p className="text-sm text-slate-400">Carregando…</p>
              ) : arquivados.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum título arquivado.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {arquivados.map((a: ArquivadoRow) => (
                    <li key={a.parcela_id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{a.cliente}</p>
                        <p className="text-xs text-slate-400">
                          Título {a.nro_titulo ?? '-'} · {formatCurrency(Number(a.valor ?? 0))} ·
                          venc. {formatDate(a.data_vencimento)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleDesarquivar(a.parcela_id)}>
                        Reativar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Tabela */}
          {loading ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-slate-400">
              <Send className="h-8 w-8" />
              <p className="text-sm text-center max-w-md">
                {rotinaVencidosOntem
                  ? incluirConcluidos
                    ? 'Nenhum título com cobrança prevista para hoje.'
                    : 'Nenhum título pendente na fila D+1 de hoje. Rotina em dia!'
                  : incluirConcluidos
                    ? 'Nenhum título no backlog.'
                    : 'Nenhum título vencido pendente de WhatsApp no backlog.'}
              </p>
            </div>
          ) : (
            <>
              <CobrancaTable
                rows={rows}
                selectedIds={selectedIds}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onCobrarGrupo={setGrupoParaCobrar}
                onEditContato={setEditRow}
                onArquivar={handleArquivar}
                canArquivar={canArquivar}
              />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-600">
                    Página {page} de {totalPages}
                  </span>
                  <Button
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
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-6">
          <WhatsappInbox pendingCobranca={pendingWhatsapp} onPendingSent={handleWhatsappEnviado} />
        </TabsContent>

        <TabsContent value="indicadores" className="mt-6">
          <CobrancaDashboard />
        </TabsContent>
      </Tabs>

      <EditarContatoModal
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={refreshPainel}
      />
      <ConfirmarCobrancaModal
        open={!!canalEnvio}
        canal={canalEnvio}
        rows={selectedRows}
        templates={templates}
        onClose={() => setCanalEnvio(null)}
        onSent={() => {
          setSelectedIds(new Set())
          refreshPainel()
        }}
        onSentWhatsapp={(pending) => {
          setPendingWhatsapp(pending)
          setTab('whatsapp')
        }}
      />
      <CobrarGrupoModal
        open={grupoParaCobrar.length > 0}
        rows={grupoParaCobrar}
        onClose={() => setGrupoParaCobrar([])}
        onSent={() => {
          setSelectedIds(new Set())
          refreshPainel()
        }}
      />
    </div>
  )
}
