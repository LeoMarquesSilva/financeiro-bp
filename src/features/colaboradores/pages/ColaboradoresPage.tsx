import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserCog,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Check,
  Users,
  UserX,
  Link2Off,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { colaboradoresService } from '../services/colaboradoresService'
import type { Colaborador, ColaboradorDivergencia, ColaboradorDivergenciaTipo } from '../types'

type StatusFilter = 'all' | 'active' | 'inactive'

const DIVERGENCIA_LABEL: Record<ColaboradorDivergenciaTipo, string> = {
  sem_conta_responsum: 'Sem conta RESPONSUM',
  sem_registro_orqestrai: 'Sem registro ORQESTRAI',
  area_diferente: 'Área diferente',
  status_diferente: 'Status diferente',
}

const DIVERGENCIA_BADGE_CLASS: Record<ColaboradorDivergenciaTipo, string> = {
  sem_conta_responsum: 'border-amber-200 bg-amber-50 text-amber-700',
  sem_registro_orqestrai: 'border-sky-200 bg-sky-50 text-sky-700',
  area_diferente: 'border-violet-200 bg-violet-50 text-violet-700',
  status_diferente: 'border-red-200 bg-red-50 text-red-700',
}

const NIVEL_LABEL: Record<Colaborador['nivel_hierarquico'], string> = {
  socio: 'Sócio',
  gerente: 'Gerente',
  coordenador: 'Coordenador',
  colaborador: 'Colaborador',
}

const NIVEL_BADGE_CLASS: Record<Colaborador['nivel_hierarquico'], string> = {
  socio: 'border-violet-200 bg-violet-50 text-violet-700',
  gerente: 'border-blue-200 bg-blue-50 text-blue-700',
  coordenador: 'border-teal-200 bg-teal-50 text-teal-700',
  colaborador: 'border-slate-200 bg-slate-50 text-slate-600',
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const [ano, mes, dia] = value.split('-')
  if (!ano || !mes || !dia) return value
  return `${dia}/${mes}/${ano}`
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ColaboradoresPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [mostrarDivergenciasResolvidas, setMostrarDivergenciasResolvidas] = useState(false)

  const {
    data: colaboradores,
    isLoading: isLoadingColaboradores,
    isError: isErrorColaboradores,
  } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => colaboradoresService.list(),
  })

  const {
    data: divergencias,
    isLoading: isLoadingDivergencias,
    isError: isErrorDivergencias,
  } = useQuery({
    queryKey: ['colaboradores_divergencias'],
    queryFn: () => colaboradoresService.listDivergencias(),
  })

  const resolverMutation = useMutation({
    mutationFn: ({ id, resolvido }: { id: string; resolvido: boolean }) =>
      colaboradoresService.resolverDivergencia(id, resolvido),
    onSuccess: (_data: void, { resolvido }: { id: string; resolvido: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores_divergencias'] })
      toast.success(resolvido ? 'Divergência marcada como resolvida' : 'Divergência reaberta')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao atualizar divergência')
    },
  })

  const lista: Colaborador[] = colaboradores ?? []
  const todasDivergencias: ColaboradorDivergencia[] = divergencias ?? []
  const divergenciasPendentes = todasDivergencias.filter((d) => !d.resolvido)
  const divergenciasVisiveis = mostrarDivergenciasResolvidas
    ? todasDivergencias
    : divergenciasPendentes

  const stats = useMemo(() => {
    const ativos = lista.filter((c) => c.is_active)
    const comResponsum = ativos.filter((c) => c.responsum_user_id)
    return {
      total: lista.length,
      ativos: ativos.length,
      comResponsum: comResponsum.length,
      semResponsum: ativos.length - comResponsum.length,
      divergenciasPendentes: divergenciasPendentes.length,
    }
  }, [lista, divergenciasPendentes.length])

  const areas = useMemo(
    () => [...new Set(lista.map((c) => c.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lista],
  )

  const filteredColaboradores = useMemo(() => {
    const q = search.trim().toLowerCase()
    return lista.filter((c) => {
      if (statusFilter === 'active' && !c.is_active) return false
      if (statusFilter === 'inactive' && c.is_active) return false
      if (areaFilter !== 'all' && c.area !== areaFilter) return false
      if (!q) return true
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        (c.cargo ?? '').toLowerCase().includes(q)
      )
    })
  }, [lista, search, statusFilter, areaFilter])

  const ultimaSync = lista.reduce<string | null>((acc, c) => {
    if (!acc || c.synced_at > acc) return c.synced_at
    return acc
  }, null)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <UserCog className="h-7 w-7 shrink-0 text-slate-600" />
          Colaboradores
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          Base de colaboradores do escritório sincronizada do ORQESTRAI (fonte de verdade), com
          diagnóstico de divergências em relação ao RESPONSUM. Somente leitura — nenhuma alteração
          é feita nos sistemas de origem por aqui.
          {ultimaSync && (
            <span className="ml-1 text-slate-400">
              Última sincronização: {formatDateTime(ultimaSync)}.
            </span>
          )}
        </p>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-slate-600' },
          { label: 'Ativos', value: stats.ativos, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Com conta RESPONSUM', value: stats.comResponsum, icon: Link2Off, color: 'text-sky-600' },
          { label: 'Ativos sem conta RESPONSUM', value: stats.semResponsum, icon: UserX, color: 'text-amber-600' },
          { label: 'Divergências pendentes', value: stats.divergenciasPendentes, icon: AlertTriangle, color: 'text-red-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-slate-200/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn('rounded-lg bg-slate-50 p-2', color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Divergências */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Divergências ORQESTRAI × RESPONSUM ({divergenciasVisiveis.length})
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMostrarDivergenciasResolvidas((v) => !v)}
            >
              {mostrarDivergenciasResolvidas ? 'Ver só pendentes' : 'Ver também resolvidas'}
            </Button>
          </div>
          <p className="text-sm font-normal text-slate-500">
            Gerado a cada execução de <code className="rounded bg-slate-100 px-1">npm run sync:colaboradores</code>.
            Marcar como resolvida só esconde o alerta aqui — não altera nada no ORQESTRAI nem no RESPONSUM.
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingDivergencias ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : isErrorDivergencias ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-600">
              Erro ao carregar divergências.
            </div>
          ) : divergenciasVisiveis.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <p className="mt-2 text-sm text-slate-500">Nenhuma divergência pendente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">E-mail</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Detalhe</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {divergenciasVisiveis.map((d) => (
                    <tr key={d.id} className={cn(d.resolvido && 'bg-slate-50/60 opacity-70')}>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={DIVERGENCIA_BADGE_CLASS[d.tipo]}>
                          {DIVERGENCIA_LABEL[d.tipo]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{d.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{d.email ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{d.detalhe ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={resolverMutation.isPending}
                          onClick={() =>
                            resolverMutation.mutate({ id: d.id, resolvido: !d.resolvido })
                          }
                        >
                          {d.resolvido ? (
                            <>Reabrir</>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span className="ml-1">Resolver</span>
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Colaboradores */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Colaboradores ({filteredColaboradores.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar por nome, e-mail, área ou cargo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-slate-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="all">Todos</option>
              </select>
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="all">Todas as áreas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoadingColaboradores ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : isErrorColaboradores ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">
              Erro ao carregar colaboradores.
            </div>
          ) : filteredColaboradores.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Nenhum colaborador encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">E-mail</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Área</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Cargo</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Nível</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Admissão</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-600">RESPONSUM</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredColaboradores.map((c) => (
                    <tr key={c.id} className={cn(!c.is_active && 'bg-slate-50/80')}>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                          {c.area}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.cargo ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={NIVEL_BADGE_CLASS[c.nivel_hierarquico]}>
                          {NIVEL_LABEL[c.nivel_hierarquico]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(c.admission_date)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.responsum_user_id ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.is_active ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-500">
                            Inativo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
