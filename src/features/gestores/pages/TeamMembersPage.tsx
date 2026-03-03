import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamMembersService, type CreateTeamMemberInput } from '@/lib/teamMembersService'
import type { TeamMember, AppRole } from '@/lib/database.types'
import { getTeamMember, getAreaTags } from '@/lib/teamAvatars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Users, Plus, Trash2, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'comite', label: 'Comite' },
]

const initialForm = {
  email: '',
  full_name: '',
  area: '',
  avatar_url: '',
  role: '' as '' | AppRole,
}

export function TeamMembersPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(initialForm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; full_name: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => teamMembersService.list(),
  })
  const teamMembers: TeamMember[] = data ?? []

  const membersWithRole = teamMembers.filter((m) => m.role)
  const membersWithoutRole = teamMembers.filter((m) => !m.role)

  const createMutation = useMutation({
    mutationFn: (input: CreateTeamMemberInput) => teamMembersService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setForm(initialForm)
      toast.success('Usuario incluido')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao incluir usuario')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AppRole | null }) =>
      teamMembersService.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      toast.success('Role atualizado')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao atualizar role')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamMembersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setDeleteTarget(null)
      toast.success('Usuario excluido')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao excluir usuario')
    },
  })

  const areasFromDb = [...new Set(teamMembers.map((m: TeamMember) => m.area).filter(Boolean))] as string[]
  const areasFromAvatars = getAreaTags()
  const areas: string[] = [...new Set([...areasFromDb, ...areasFromAvatars])].sort((a: string, b: string) =>
    a.localeCompare(b, 'pt-BR')
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const email = form.email.trim().toLowerCase()
    const full_name = form.full_name.trim()
    const area = form.area.trim()
    if (!email || !full_name || !area) {
      toast.error('Preencha e-mail, nome e area.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('E-mail invalido.')
      return
    }
    if (teamMembers.some((m: TeamMember) => m.email.toLowerCase() === email)) {
      toast.error('Ja existe um usuario com este e-mail.')
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

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
  }

  const handleRoleChange = (memberId: string, newRole: string) => {
    const role = newRole === '' ? null : (newRole as AppRole)
    updateRoleMutation.mutate({ id: memberId, role })
  }

  const renderMemberRow = (m: TeamMember) => {
    const avatarInfo = getTeamMember(m.email)
    const avatarUrl = m.avatar_url || avatarInfo?.avatar
    return (
      <tr key={m.id} className="border-b border-slate-100 last:border-0">
        <td className="py-3 pr-4">
          <Avatar className="h-8 w-8">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : null}
            <AvatarFallback className="text-xs">
              {m.full_name
                .split(/\s+/)
                .map((p: string) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </td>
        <td className="py-3 pr-4 font-medium text-slate-900">{m.full_name}</td>
        <td className="py-3 pr-4 text-slate-600">{m.email}</td>
        <td className="py-3 pr-4">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {m.area}
          </span>
        </td>
        <td className="py-3 pr-4">
          <select
            value={m.role ?? ''}
            onChange={(e) => handleRoleChange(m.id, e.target.value)}
            disabled={updateRoleMutation.isPending}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          >
            <option value="">Sem acesso</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </td>
        <td className="py-3 text-right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setDeleteTarget({ id: m.id, full_name: m.full_name })}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Excluir</span>
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <Users className="h-7 w-7 shrink-0 text-slate-600" />
          Gestores / Equipe
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          Gerencie usuarios, roles e permissoes de acesso ao sistema.
        </p>
      </header>

      {/* Formulario de inclusao */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Novo usuario
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
              <Label htmlFor="tm-area">Area *</Label>
              <Input
                id="tm-area"
                type="text"
                list="tm-areas"
                placeholder="Ex: Civel, Trabalhista"
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              />
              <datalist id="tm-areas">
                {areas.map((a: string) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-role">Role</Label>
              <select
                id="tm-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as '' | AppRole }))}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Sem acesso</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createMutation.isPending}>
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

      {/* Usuarios com acesso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Usuarios com acesso ({membersWithRole.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : membersWithRole.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum usuario com acesso.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Foto</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Nome</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">E-mail</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Area</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Role</th>
                    <th className="pb-3 text-right font-medium text-slate-600">Acoes</th>
                  </tr>
                </thead>
                <tbody>{membersWithRole.map(renderMemberRow)}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membros sem acesso ao sistema */}
      {membersWithoutRole.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">
              Membros sem acesso ao sistema ({membersWithoutRole.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Foto</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Nome</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">E-mail</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Area</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Role</th>
                    <th className="pb-3 text-right font-medium text-slate-600">Acoes</th>
                  </tr>
                </thead>
                <tbody>{membersWithoutRole.map(renderMemberRow)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de confirmacao de exclusao */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Excluir usuario?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.full_name}" sera removido da lista de gestores. Esta acao nao pode ser desfeita.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-2">Excluir</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
