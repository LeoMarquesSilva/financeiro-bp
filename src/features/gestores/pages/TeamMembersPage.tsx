import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teamMembersService, type CreateTeamMemberInput } from '@/lib/teamMembersService'
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
import { Users, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const initialForm = {
  email: '',
  full_name: '',
  area: '',
  avatar_url: '',
}

export function TeamMembersPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(initialForm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; full_name: string } | null>(null)

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => teamMembersService.list(),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateTeamMemberInput) => teamMembersService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setForm(initialForm)
      toast.success('Usuário incluído')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao incluir usuário')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamMembersService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      setDeleteTarget(null)
      toast.success('Usuário excluído')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao excluir usuário')
    },
  })

  const areasFromDb = [...new Set(teamMembers.map((m) => m.area).filter(Boolean))]
  const areasFromAvatars = getAreaTags()
  const areas = [...new Set([...areasFromDb, ...areasFromAvatars])].sort((a, b) =>
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
    if (teamMembers.some((m) => m.email.toLowerCase() === email)) {
      toast.error('Já existe um usuário com este e-mail.')
      return
    }
    createMutation.mutate({
      email,
      full_name,
      area,
      avatar_url: form.avatar_url.trim() || null,
    })
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
  }

  return (
    <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <Users className="h-7 w-7 shrink-0 text-slate-600" />
          Gestores / Equipe
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          Inclua e exclua usuários (gestores/sócios) que aparecem nos filtros e no cadastro de inadimplência.
        </p>
      </header>

      {/* Formulário de inclusão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Novo usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <div className="space-y-2">
              <Label htmlFor="tm-email">E-mail *</Label>
              <Input
                id="tm-email"
                type="email"
                placeholder="nome@bpplaw.com.br"
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
              <Label htmlFor="tm-avatar">URL da foto (opcional)</Label>
              <Input
                id="tm-avatar"
                type="url"
                placeholder="https://..."
                value={form.avatar_url}
                onChange={(e) => setForm((f) => ({ ...f, avatar_url: e.target.value }))}
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
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

      {/* Lista de usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários cadastrados ({teamMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Foto</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Nome</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">E-mail</th>
                    <th className="pb-3 pr-4 text-left font-medium text-slate-600">Área</th>
                    <th className="pb-3 text-right font-medium text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((m) => {
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
                                .map((p) => p[0])
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent showClose={true}>
          <DialogHeader>
            <DialogTitle>Excluir usuário?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `"${deleteTarget.full_name}" será removido da lista de gestores. Esta ação não pode ser desfeita.`
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
