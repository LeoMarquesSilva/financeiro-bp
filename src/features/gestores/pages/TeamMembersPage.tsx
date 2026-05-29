import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamMembersService, type CreateTeamMemberInput } from '@/lib/teamMembersService'
import type { TeamMember, AppRole } from '@/lib/database.types'
import { getTeamMember, getAreaTags } from '@/lib/teamAvatars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  Shield,
  Search,
  UserX,
  UserCheck,
  UserPlus,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS: { value: AppRole; label: string; badgeClass: string }[] = [
  { value: 'admin', label: 'Admin', badgeClass: 'border-violet-200 bg-violet-50 text-violet-700' },
  { value: 'financeiro', label: 'Financeiro', badgeClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  { value: 'comite', label: 'Comitê', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
]

type StatusFilter = 'all' | 'active' | 'inactive'
type RoleFilter = 'all' | 'with_role' | 'without_role' | AppRole

type ConfirmAction =
  | { type: 'delete'; id: string; full_name: string }
  | { type: 'deactivate'; id: string; full_name: string }
  | { type: 'reactivate'; id: string; full_name: string }

const initialForm = {
  email: '',
  full_name: '',
  area: '',
  avatar_url: '',
  role: '' as '' | AppRole,
}

function getRoleLabel(role: AppRole | null): string {
  if (!role) return 'Sem acesso'
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role
}

function getRoleBadgeClass(role: AppRole | null): string {
  if (!role) return 'border-slate-200 bg-slate-50 text-slate-500'
  return ROLE_OPTIONS.find((r) => r.value === role)?.badgeClass ?? 'border-slate-200 bg-slate-50 text-slate-600'
}

export function TeamMembersPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(initialForm)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => teamMembersService.list(),
  })
  const teamMembers: TeamMember[] = data ?? []

  const stats = useMemo(() => {
    const active = teamMembers.filter((m) => m.is_active !== false)
    const inactive = teamMembers.filter((m) => m.is_active === false)
    const withRole = active.filter((m) => m.role)
    return {
      total: teamMembers.length,
      active: active.length,
      inactive: inactive.length,
      withRole: withRole.length,
      withoutRole: active.length - withRole.length,
    }
  }, [teamMembers])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teamMembers.filter((m) => {
      if (statusFilter === 'active' && m.is_active === false) return false
      if (statusFilter === 'inactive' && m.is_active !== false) return false

      if (roleFilter === 'with_role' && !m.role) return false
      if (roleFilter === 'without_role' && m.role) return false
      if (roleFilter !== 'all' && roleFilter !== 'with_role' && roleFilter !== 'without_role' && m.role !== roleFilter) {
        return false
      }

      if (!q) return true
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.area.toLowerCase().includes(q)
      )
    })
  }, [teamMembers, search, statusFilter, roleFilter])

  const createMutation = useMutation({
    mutationFn: (input: CreateTeamMemberInput) => teamMembersService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setForm(initialForm)
      setShowForm(false)
      toast.success('Usuário incluído')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao incluir usuário')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppRole | null }) =>
      teamMembersService.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setUpdatingRoleId(null)
      toast.success('Permissão atualizada')
    },
    onError: (err: Error) => {
      setUpdatingRoleId(null)
      toast.error(err.message ?? 'Erro ao atualizar permissão')
    },
  })

  const updateActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      teamMembersService.updateActive(id, isActive),
    onSuccess: (_data: void, { isActive }: { id: string; isActive: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setConfirmAction(null)
      toast.success(isActive ? 'Usuário reativado' : 'Usuário inativado')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao alterar status do usuário')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamMembersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setConfirmAction(null)
      toast.success('Usuário excluído')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao excluir usuário')
    },
  })

  const areasFromDb = [...new Set(teamMembers.map((m) => m.area).filter(Boolean))] as string[]
  const areasFromAvatars = getAreaTags()
  const areas: string[] = [...new Set([...areasFromDb, ...areasFromAvatars])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const email = form.email.trim().toLowerCase()
    const full_name = form.full_name.trim()
    const area = form.area.trim()
    if (!email || !full_name || !area) {
      toast.error('Preencha e-mail, nome e área.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('E-mail inválido.')
      return
    }

    const existing = teamMembers.find((m) => m.email.toLowerCase() === email)
    if (existing) {
      if (existing.is_active === false) {
        setConfirmAction({ type: 'reactivate', id: existing.id, full_name: existing.full_name })
        toast.info('Este e-mail pertence a um usuário inativo. Confirme a reativação.')
      } else {
        toast.error('Já existe um usuário ativo com este e-mail.')
      }
      return
    }

    createMutation.mutate({
      email,
      full_name,
      area,
      avatar_url: form.avatar_url.trim() || null,
      role: form.role || null,
    })
  }

  const handleConfirmAction = () => {
    if (!confirmAction) return
    if (confirmAction.type === 'delete') {
      deleteMutation.mutate(confirmAction.id)
    } else if (confirmAction.type === 'deactivate') {
      updateActiveMutation.mutate({ id: confirmAction.id, isActive: false })
    } else {
      updateActiveMutation.mutate({ id: confirmAction.id, isActive: true })
    }
  }

  const handleRoleChange = (memberId: string, newRole: string) => {
    const role = newRole === '' ? null : (newRole as AppRole)
    setUpdatingRoleId(memberId)
    updateRoleMutation.mutate({ id: memberId, role })
  }

  const isConfirmPending = deleteMutation.isPending || updateActiveMutation.isPending

  const renderMemberRow = (m: TeamMember) => {
    const avatarInfo = getTeamMember(m.email)
    const avatarUrl = m.avatar_url || avatarInfo?.avatar
    const isInactive = m.is_active === false
    const isUpdatingRole = updatingRoleId === m.id && updateRoleMutation.isPending

    return (
      <tr
        key={m.id}
        className={cn(
          'border-b border-slate-100 last:border-0 transition-colors',
          isInactive && 'bg-slate-50/80'
        )}
      >
        <td className="py-3 pr-4">
          <Avatar className={cn('h-9 w-9', isInactive && 'opacity-60')}>
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="text-xs">
              {m.full_name
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </td>
        <td className="py-3 pr-4">
          <div className="flex flex-col gap-1">
            <span className={cn('font-medium text-slate-900', isInactive && 'text-slate-500')}>
              {m.full_name}
            </span>
            {isInactive && (
              <Badge variant="outline" className="w-fit border-slate-300 bg-slate-100 text-slate-500">
                Inativo
              </Badge>
            )}
          </div>
        </td>
        <td className="py-3 pr-4 text-slate-600">{m.email}</td>
        <td className="py-3 pr-4">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {m.area}
          </span>
        </td>
        <td className="py-3 pr-4">
          {isInactive ? (
            <Badge variant="outline" className={getRoleBadgeClass(m.role)}>
              {getRoleLabel(m.role)}
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={m.role ?? ''}
                onChange={(e) => handleRoleChange(m.id, e.target.value)}
                disabled={isUpdatingRole}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
              >
                <option value="">Sem acesso</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {isUpdatingRole && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </div>
          )}
        </td>
        <td className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {isInactive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => setConfirmAction({ type: 'reactivate', id: m.id, full_name: m.full_name })}
                title="Reativar usuário"
              >
                <UserCheck className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Reativar</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => setConfirmAction({ type: 'deactivate', id: m.id, full_name: m.full_name })}
                title="Inativar usuário"
              >
                <UserX className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Inativar</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmAction({ type: 'delete', id: m.id, full_name: m.full_name })}
              title="Excluir usuário"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Excluir</span>
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  const confirmDialogContent = () => {
    if (!confirmAction) return { title: '', description: '', confirmLabel: '', variant: 'default' as const }
    switch (confirmAction.type) {
      case 'delete':
        return {
          title: 'Excluir usuário?',
          description: `"${confirmAction.full_name}" será removido permanentemente da equipe. Clientes vinculados a este gestor manterão o histórico, mas ele não poderá mais ser selecionado.`,
          confirmLabel: 'Excluir',
          variant: 'destructive' as const,
        }
      case 'deactivate':
        return {
          title: 'Inativar usuário?',
          description: `"${confirmAction.full_name}" perderá acesso ao sistema e não aparecerá mais nas listas de gestores. Você poderá reativá-lo depois.`,
          confirmLabel: 'Inativar',
          variant: 'destructive' as const,
        }
      case 'reactivate':
        return {
          title: 'Reativar usuário?',
          description: `"${confirmAction.full_name}" voltará a aparecer nas listas de gestores. Verifique se a permissão de acesso (role) está correta após a reativação.`,
          confirmLabel: 'Reativar',
          variant: 'default' as const,
        }
    }
  }

  const dialogContent = confirmDialogContent()

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            <Users className="h-7 w-7 shrink-0 text-slate-600" />
            Gestores / Equipe
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
            Gerencie usuários, permissões de acesso e status da equipe.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0"
        >
          {showForm ? (
            <>Fechar formulário</>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span className="ml-2">Novo usuário</span>
            </>
          )}
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-slate-600' },
          { label: 'Com acesso', value: stats.withRole, icon: Shield, color: 'text-violet-600' },
          { label: 'Sem acesso', value: stats.withoutRole, icon: Users, color: 'text-slate-500' },
          { label: 'Inativos', value: stats.inactive, icon: UserX, color: 'text-amber-600' },
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

      {/* Formulário de inclusão */}
      {showForm && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Novo usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
              <div className="space-y-2">
                <Label htmlFor="tm-email">E-mail *</Label>
                <Input
                  id="tm-email"
                  type="email"
                  placeholder="nome@bismarchipires.com.br"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tm-name">Nome completo *</Label>
                <Input
                  id="tm-name"
                  type="text"
                  placeholder="Nome do gestor"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tm-area">Área *</Label>
                <Input
                  id="tm-area"
                  type="text"
                  list="tm-areas"
                  placeholder="Ex: Cível, Trabalhista"
                  value={form.area}
                  onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                />
                <datalist id="tm-areas">
                  {areas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tm-role">Permissão</Label>
                <select
                  id="tm-role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as '' | AppRole }))}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Sem acesso (apenas gestor)</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="ml-2">Incluir</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtros + listagem */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Equipe ({filteredMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar por nome, e-mail ou área..."
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
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="all">Todas permissões</option>
                <option value="with_role">Com acesso ao sistema</option>
                <option value="without_role">Sem acesso ao sistema</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">
              Erro ao carregar equipe: {(error as Error)?.message ?? 'Tente novamente.'}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                {search || statusFilter !== 'active' || roleFilter !== 'all'
                  ? 'Nenhum usuário encontrado com os filtros aplicados.'
                  : 'Nenhum usuário cadastrado.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Foto</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">E-mail</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Área</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Permissão</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map(renderMemberRow)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && !isConfirmPending && setConfirmAction(null)}>
        <DialogContent showClose={!isConfirmPending}>
          <DialogHeader>
            <DialogTitle>{dialogContent.title}</DialogTitle>
            <DialogDescription>{dialogContent.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isConfirmPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={dialogContent.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={isConfirmPending}
            >
              {isConfirmPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmAction?.type === 'delete' ? (
                <Trash2 className="h-4 w-4" />
              ) : confirmAction?.type === 'deactivate' ? (
                <UserX className="h-4 w-4" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              <span className="ml-2">{dialogContent.confirmLabel}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
