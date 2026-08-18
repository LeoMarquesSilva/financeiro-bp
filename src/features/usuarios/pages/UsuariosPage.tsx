import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  KeyRound,
  Loader2,
  Search,
  Settings2,
  UserCheck,
  UserX,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getTeamMember } from '@/lib/teamAvatars'
import { useOfficialPhotos } from '@/lib/OfficialPhotosProvider'
import { colaboradoresService } from '@/features/colaboradores/services/colaboradoresService'
import type { ModuleKey } from '@/lib/moduleAccess'
import {
  buildUsuarioList,
  teamMemberModuleAccessService,
  teamMembersService,
  usuariosAccessService,
} from '../services/usuariosService'
import type { AuthMeta, UsuarioListItem, UsuariosTab } from '../types'
import { AcessoUsuarioDialog } from '../components/AcessoUsuarioDialog'
import { UsuariosDivergenciasTab } from '../components/UsuariosDivergenciasTab'
import { PerfisPadraoDialog } from '../components/PerfisPadraoDialog'
import { formatRelativeAccess, getInitials } from '../utils/formatAccess'
import {
  buildAreaFiltroOptions,
  formatAreaUsuariosLabel,
  matchesAreaFiltro,
  normalizeAreaUsuarios,
} from '../utils/areaFiltro'
import { isCoordenadorUsuario } from '@/features/eficiencia/utils/eficienciaAccess'
import type { AppRole } from '@/lib/database.types'

type StatusFilter = 'all' | 'active' | 'inactive'
type AccessFilter = 'all' | 'with_access' | 'without_access'

const FILTER_CHIP =
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1'
const FILTER_CHIP_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const FILTER_CHIP_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(FILTER_CHIP, active ? FILTER_CHIP_ON : FILTER_CHIP_OFF)}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function rhStatusBadge(item: UsuarioListItem) {
  if (item.rhStatus === 'ativo') {
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        Ativo
      </Badge>
    )
  }
  if (item.rhStatus === 'ex_colaborador') {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        Ex-colaborador
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
      Só no sistema
    </Badge>
  )
}

function perfilBadges(item: UsuarioListItem) {
  const role = item.teamMember?.role as AppRole | null | undefined
  const coordenador = isCoordenadorUsuario({
    role,
    email: item.email,
    nivelHierarquico: item.colaborador?.nivel_hierarquico,
  })

  const badges: ReactNode[] = []

  if (role === 'admin') {
    badges.push(
      <Badge
        key="admin"
        variant="outline"
        className="border-slate-300 bg-slate-800 text-[10px] font-semibold uppercase tracking-wide text-white"
      >
        Admin
      </Badge>,
    )
  } else if (role === 'financeiro') {
    badges.push(
      <Badge
        key="fin"
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
      >
        Financeiro
      </Badge>,
    )
  } else if (role === 'comite') {
    badges.push(
      <Badge
        key="comite"
        variant="outline"
        className="border-indigo-200 bg-indigo-50 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
      >
        Comitê
      </Badge>,
    )
  }

  if (coordenador) {
    badges.push(
      <Badge
        key="coord"
        variant="outline"
        className="border-teal-200 bg-teal-50 text-[10px] font-semibold uppercase tracking-wide text-teal-800"
      >
        Coordenador
      </Badge>,
    )
  }

  return badges.length > 0 ? <div className="mt-1 flex flex-wrap gap-1">{badges}</div> : null
}

function hasSioeAccess(
  item: UsuarioListItem,
  modulesByMember: Map<string, Set<ModuleKey>>,
): boolean {
  if (item.rhStatus === 'ex_colaborador') return false
  const tm = item.teamMember
  if (!tm || tm.is_active === false) return false
  if (tm.role) return true
  return (modulesByMember.get(tm.id)?.size ?? 0) > 0
}

export function UsuariosPage() {
  useOfficialPhotos()
  const [tab, setTab] = useState<UsuariosTab>('lista')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [selected, setSelected] = useState<UsuarioListItem | null>(null)
  const [perfisPadraoOpen, setPerfisPadraoOpen] = useState(false)

  const {
    data: colaboradores,
    isLoading: loadingColab,
    isError: errorColab,
  } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => colaboradoresService.list(),
  })

  const {
    data: teamMembers,
    isLoading: loadingMembers,
    isError: errorMembers,
  } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => teamMembersService.list(),
  })

  const { data: moduleAccessData } = useQuery({
    queryKey: ['team_member_module_access'],
    queryFn: () => teamMemberModuleAccessService.listAll(),
  })

  const {
    data: divergencias,
    isLoading: loadingDiv,
    isError: errorDiv,
  } = useQuery({
    queryKey: ['colaboradores_divergencias'],
    queryFn: () => colaboradoresService.listDivergencias(),
  })

  const modulesByMember = useMemo(() => {
    const map = new Map<string, Set<ModuleKey>>()
    for (const row of moduleAccessData ?? []) {
      if (!map.has(row.team_member_id)) map.set(row.team_member_id, new Set())
      map.get(row.team_member_id)!.add(row.module_key)
    }
    return map
  }, [moduleAccessData])

  const lista = useMemo(
    () => buildUsuarioList(colaboradores ?? [], teamMembers ?? []),
    [colaboradores, teamMembers],
  )

  const emails = useMemo(
    () => lista.map((u) => u.email).filter((e): e is string => Boolean(e)),
    [lista],
  )

  const { data: authMetaList } = useQuery({
    queryKey: ['usuarios_auth_meta', emails],
    queryFn: () => usuariosAccessService.listAuthMeta(emails),
    enabled: emails.length > 0 && tab === 'lista',
  })

  const authMetaByEmail = useMemo(() => {
    const map = new Map<string, AuthMeta>()
    for (const row of authMetaList ?? []) {
      map.set(row.email, row)
    }
    return map
  }, [authMetaList])

  const areas = useMemo(
    () =>
      buildAreaFiltroOptions(
        lista.map((u) => normalizeAreaUsuarios(u.area)).filter((a) => a && a !== '—'),
      ),
    [lista],
  )

  const divergenciasPendentes = (divergencias ?? []).filter(
    (d: { resolvido: boolean }) => !d.resolvido,
  ).length

  const stats = useMemo(() => {
    const comAcesso = lista.filter((u) => hasSioeAccess(u, modulesByMember))
    const ativosRh = lista.filter((u) => u.rhStatus === 'ativo')
    return {
      total: lista.length,
      ativosRh: ativosRh.length,
      comAcesso: comAcesso.length,
      semAcesso: lista.length - comAcesso.length,
    }
  }, [lista, modulesByMember])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return lista.filter((u) => {
      if (statusFilter === 'active' && u.rhStatus === 'ex_colaborador') return false
      if (statusFilter === 'inactive' && u.rhStatus !== 'ex_colaborador') return false
      if (areaFilter !== 'all' && !matchesAreaFiltro(u.area, areaFilter)) return false
      const access = hasSioeAccess(u, modulesByMember)
      if (accessFilter === 'with_access' && !access) return false
      if (accessFilter === 'without_access' && access) return false
      if (!q) return true
      const areaLabel = formatAreaUsuariosLabel(u.area).toLowerCase()
      return (
        u.full_name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        u.area.toLowerCase().includes(q) ||
        areaLabel.includes(q)
      )
    })
  }, [lista, search, statusFilter, areaFilter, accessFilter, modulesByMember])

  const isLoading = loadingColab || loadingMembers
  const isError = errorColab || errorMembers

  const selectedModules = selected?.teamMember
    ? (modulesByMember.get(selected.teamMember.id) ?? new Set<ModuleKey>())
    : new Set<ModuleKey>()

  const selectedAuth = selected?.email
    ? (authMetaByEmail.get(selected.email.toLowerCase()) ?? null)
    : null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <Users className="h-7 w-7 shrink-0 text-slate-600" />
          Usuários
        </h1>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as UsuariosTab)}>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="lista">
              <Users className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="divergencias">
              <AlertTriangle className="h-4 w-4" />
              Divergências
              {divergenciasPendentes > 0 && (
                <span className="ml-1 rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                  {divergenciasPendentes}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 border-teal-200 bg-teal-50/50 text-teal-800 hover:bg-teal-50"
            onClick={() => setPerfisPadraoOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
            Perfis padrão
          </Button>
        </div>

        <TabsContent value="lista" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total', value: stats.total, icon: Users, color: 'text-slate-600' },
              { label: 'Ativos (RH)', value: stats.ativosRh, icon: UserCheck, color: 'text-sky-600' },
              { label: 'Com acesso', value: stats.comAcesso, icon: KeyRound, color: 'text-teal-600' },
              { label: 'Sem acesso', value: stats.semAcesso, icon: UserX, color: 'text-amber-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="border-slate-200/60 shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('rounded-lg bg-slate-50 p-2', color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {filtered.length} de {lista.length} usuários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white px-4 py-3.5 shadow-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Buscar por nome, e-mail ou área..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 border-slate-200 bg-white pl-9 shadow-sm"
                  />
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      RH
                    </span>
                    <FilterChip
                      active={statusFilter === 'active'}
                      onClick={() => setStatusFilter('active')}
                    >
                      Ativos
                    </FilterChip>
                    <FilterChip
                      active={statusFilter === 'inactive'}
                      onClick={() => setStatusFilter('inactive')}
                    >
                      Ex-colaboradores
                    </FilterChip>
                    <FilterChip
                      active={statusFilter === 'all'}
                      onClick={() => setStatusFilter('all')}
                    >
                      Todos
                    </FilterChip>
                  </div>

                  <Separator orientation="vertical" className="hidden h-6 lg:block" />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Acesso
                    </span>
                    <FilterChip
                      active={accessFilter === 'all'}
                      onClick={() => setAccessFilter('all')}
                    >
                      Todos
                    </FilterChip>
                    <FilterChip
                      active={accessFilter === 'with_access'}
                      onClick={() => setAccessFilter('with_access')}
                    >
                      Com acesso
                    </FilterChip>
                    <FilterChip
                      active={accessFilter === 'without_access'}
                      onClick={() => setAccessFilter('without_access')}
                    >
                      Sem acesso
                    </FilterChip>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  <Building2 className="mr-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Área
                  </span>
                  <FilterChip
                    active={areaFilter === 'all'}
                    onClick={() => setAreaFilter('all')}
                  >
                    Todas
                  </FilterChip>
                  {areas.map((a) => (
                    <FilterChip
                      key={a}
                      active={areaFilter === a}
                      onClick={() => setAreaFilter(a)}
                    >
                      {a}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">
                  Erro ao carregar usuários.
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    Nenhum usuário encontrado com os filtros aplicados.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Usuário</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">E-mail</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">
                          Departamento
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">
                          Último acesso
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((u) => {
                        const avatarInfo = u.email ? getTeamMember(u.email) : null
                        const avatarUrl = u.avatar_url || avatarInfo?.avatar
                        const meta = u.email
                          ? authMetaByEmail.get(u.email.toLowerCase())
                          : undefined
                        const access = hasSioeAccess(u, modulesByMember)

                        return (
                          <tr
                            key={u.key}
                            className={cn(
                              'transition-colors hover:bg-slate-50/80',
                              u.rhStatus === 'ex_colaborador' && 'bg-slate-50/50',
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                                  <AvatarFallback className="bg-slate-100 text-xs font-medium text-slate-600">
                                    {getInitials(u.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-slate-900">{u.full_name}</p>
                                  {perfilBadges(u)}
                                  {u.rhStatus === 'ex_colaborador' ? (
                                    <p className="mt-0.5 text-xs text-amber-600">Login desativado</p>
                                  ) : access ? (
                                    <p className="mt-0.5 text-xs text-teal-600">Com acesso</p>
                                  ) : (
                                    <p className="mt-0.5 text-xs text-slate-400">Sem acesso</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{u.email ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                                {formatAreaUsuariosLabel(u.area)}
                              </span>
                            </td>
                            <td className="px-4 py-3">{rhStatusBadge(u)}</td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>
                                {formatRelativeAccess(meta?.last_sign_in_at)}
                                {meta?.has_auth && !meta.last_sign_in_at && (
                                  <p className="text-xs text-slate-400">Conta criada, sem login</p>
                                )}
                                {u.teamMember && u.teamMember.password_changed === false && (
                                  <p className="text-xs text-amber-600">Senha padrão pendente</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                                title="Gerenciar acesso"
                                disabled={!u.email}
                                onClick={() => setSelected(u)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divergencias" className="mt-4">
          <UsuariosDivergenciasTab
            divergencias={divergencias ?? []}
            isLoading={loadingDiv}
            isError={errorDiv}
          />
        </TabsContent>
      </Tabs>

      <AcessoUsuarioDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        usuario={selected}
        grantedModules={selectedModules}
        authMeta={selectedAuth}
      />

      <PerfisPadraoDialog open={perfisPadraoOpen} onOpenChange={setPerfisPadraoOpen} />
    </div>
  )
}
