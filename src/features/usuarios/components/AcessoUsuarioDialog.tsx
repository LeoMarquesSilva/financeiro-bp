import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Clock,
  Eye,
  KeyRound,
  Loader2,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { MODULE_KEY_OPTIONS, type ModuleKey } from '@/lib/moduleAccess'
import type { AppRole, TeamMember } from '@/lib/database.types'
import {
  teamMembersService,
  teamMemberModuleAccessService,
  usuariosAccessService,
  USUARIOS_DEFAULT_PASSWORD,
} from '../services/usuariosService'
import type { AuthMeta, UsuarioListItem } from '../types'
import { formatDateTimePt } from '../utils/formatAccess'
import { cn } from '@/lib/utils'

const ROLE_OPTIONS: { value: '' | AppRole; label: string }[] = [
  { value: '', label: 'Sem perfil (só módulos)' },
  { value: 'admin', label: 'Admin' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'comite', label: 'Comitê' },
  { value: 'coordenador', label: 'Coordenador' },
]

export function AcessoUsuarioDialog({
  open,
  onOpenChange,
  usuario,
  grantedModules,
  authMeta,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario: UsuarioListItem | null
  grantedModules: Set<ModuleKey>
  authMeta: AuthMeta | null
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'' | AppRole>('')
  const [modules, setModules] = useState<Set<ModuleKey>>(new Set())
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!usuario || !open) return
    setEmail((usuario.email ?? '').toLowerCase())
    setRole((usuario.teamMember?.role as AppRole | null) ?? '')
    setModules(new Set(grantedModules))
    setIsActive(
      usuario.rhStatus !== 'ex_colaborador' && usuario.teamMember?.is_active !== false,
    )
  }, [usuario, open, grantedModules])

  const isExColaborador = usuario?.rhStatus === 'ex_colaborador'
  const hasLogin = Boolean(authMeta?.has_auth)
  const accessActive = Boolean(
    !isExColaborador &&
      usuario?.teamMember &&
      usuario.teamMember.is_active !== false &&
      (usuario.teamMember.role || grantedModules.size > 0),
  )

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['team_members'] })
    queryClient.invalidateQueries({ queryKey: ['team_member_module_access'] })
    queryClient.invalidateQueries({ queryKey: ['usuarios_auth_meta'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!usuario) throw new Error('Usuário inválido')
      const emailTrim = email.trim().toLowerCase()
      if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
        throw new Error('E-mail inválido')
      }

      const loginAtivo = usuario.rhStatus === 'ex_colaborador' ? false : isActive

      const member = await usuariosAccessService.ensureTeamMemberFromUsuario({
        colaborador: usuario.colaborador,
        teamMember: usuario.teamMember,
        email: emailTrim,
        full_name: usuario.full_name,
        area: usuario.area === '—' ? (usuario.colaborador?.area ?? 'Geral') : usuario.area,
        avatar_url: usuario.avatar_url,
        is_active: loginAtivo,
      })

      await teamMembersService.updateRole(member.id, role || null)
      await teamMembersService.updateActive(member.id, loginAtivo)

      // Coordenador sempre precisa do módulo Eficiência (visão Overview da área).
      const next = new Set(modules)
      if (role === 'coordenador') next.add('eficiencia')

      const current = new Set(grantedModules)
      for (const key of MODULE_KEY_OPTIONS.map((m) => m.value)) {
        const was = current.has(key)
        const now = next.has(key)
        if (was && !now) await teamMemberModuleAccessService.revoke(member.id, key)
        if (!was && now) await teamMemberModuleAccessService.grant(member.id, key)
      }

      if (loginAtivo && (role || next.size > 0)) {
        await usuariosAccessService.ensureAuthLogin({
          email: emailTrim,
          full_name: usuario.full_name,
          avatar_url: usuario.avatar_url,
        })
      }

      return member as TeamMember
    },
    onSuccess: () => {
      invalidateAll()
      toast.success('Acesso atualizado')
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao salvar acesso')
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (usuario?.rhStatus === 'ex_colaborador') {
        throw new Error('Ex-colaboradores não podem ter login no sistema.')
      }
      const emailTrim = email.trim().toLowerCase()
      if (!emailTrim) throw new Error('E-mail inválido')
      await usuariosAccessService.ensureAuthLogin({
        email: emailTrim,
        full_name: usuario?.full_name,
        avatar_url: usuario?.avatar_url,
      })
      if (!usuario?.teamMember) {
        await usuariosAccessService.ensureTeamMemberFromUsuario({
          colaborador: usuario?.colaborador ?? null,
          teamMember: null,
          email: emailTrim,
          full_name: usuario?.full_name ?? emailTrim,
          area: usuario?.area === '—' ? 'Geral' : (usuario?.area ?? 'Geral'),
          avatar_url: usuario?.avatar_url,
        })
      }
      return usuariosAccessService.resetPassword(emailTrim)
    },
    onSuccess: () => {
      invalidateAll()
      toast.success(`Senha redefinida para ${USUARIOS_DEFAULT_PASSWORD}`)
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Erro ao redefinir senha')
    },
  })

  const toggleModule = (key: ModuleKey, grant: boolean) => {
    setModules((prev) => {
      const next = new Set(prev)
      if (grant) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const pending = saveMutation.isPending || resetMutation.isPending

  const historyLines = useMemo(
    () => [
      {
        label: 'Último acesso',
        value: authMeta?.last_sign_in_at
          ? formatDateTimePt(authMeta.last_sign_in_at)
          : 'Ainda não acessou',
      },
      {
        label: 'Conta criada em',
        value: authMeta?.created_at ? formatDateTimePt(authMeta.created_at) : 'Ainda sem conta',
      },
      {
        label: 'E-mail confirmado',
        value: authMeta?.email_confirmed_at
          ? formatDateTimePt(authMeta.email_confirmed_at)
          : hasLogin
            ? '—'
            : 'Ainda sem conta',
      },
    ],
    [authMeta, hasLogin],
  )

  if (!usuario) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(92vh,880px)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0',
          'sm:w-full',
        )}
      >
        <DialogHeader className="shrink-0 px-5 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="pr-8 text-base sm:text-lg">
            Acesso de {usuario.full_name}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {isExColaborador
              ? 'Ex-colaboradores não podem acessar o sistema. O login permanece desativado.'
              : 'Ative o login com senha padrão e escolha o que este usuário pode ver no sistema.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div className="space-y-5">
            {/* Login */}
            <section className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  Login
                </h3>
                {accessActive ? (
                  <Badge
                    className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
                    variant="outline"
                  >
                    <Check className="mr-1 h-3 w-3" />
                    Acesso ativo
                  </Badge>
                ) : hasLogin ? (
                  <Badge
                    className="border-amber-200 bg-amber-50 font-medium text-amber-700"
                    variant="outline"
                  >
                    Conta sem permissão
                  </Badge>
                ) : (
                  <Badge
                    className="border-slate-200 bg-white font-medium text-slate-500"
                    variant="outline"
                  >
                    Sem acesso
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="acesso-email" className="text-slate-600">
                    E-mail (login)
                  </Label>
                  <Input
                    id="acesso-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={pending || Boolean(usuario.teamMember)}
                    className="h-10 border-slate-200 bg-white focus-visible:border-teal-500 focus-visible:ring-teal-500/25"
                  />
                  {usuario.teamMember && (
                    <p className="text-xs leading-relaxed text-slate-400">
                      E-mail de login — não alterável aqui.
                    </p>
                  )}
                </div>

                {isExColaborador && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                    Login desativado automaticamente porque o status no RH é{' '}
                    <strong className="font-semibold">Ex-colaborador</strong>.
                  </div>
                )}

                <div
                  role="button"
                  tabIndex={pending || isExColaborador ? -1 : 0}
                  aria-pressed={isActive}
                  aria-disabled={pending || isExColaborador || undefined}
                  onClick={() => {
                    if (!pending && !isExColaborador) setIsActive((v) => !v)
                  }}
                  onKeyDown={(e) => {
                    if (pending || isExColaborador) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setIsActive((v) => !v)
                    }
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:bg-slate-50/80',
                    (pending || isExColaborador) &&
                      'pointer-events-none cursor-not-allowed opacity-50',
                  )}
                >
                  <Checkbox
                    checked={isActive}
                    tabIndex={-1}
                    className="pointer-events-none mt-0.5"
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">
                      Conta ativa
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                      {isExColaborador
                        ? 'Indisponível para ex-colaboradores.'
                        : 'Desmarque para bloquear o login sem excluir o usuário.'}
                    </span>
                  </span>
                </div>

                <div className="space-y-2">
                  <Button
                    type="button"
                    className="h-10 w-full gap-2 bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                    disabled={pending || !email.trim() || isExColaborador}
                    onClick={() => resetMutation.mutate()}
                  >
                    {resetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    Redefinir senha para {USUARIOS_DEFAULT_PASSWORD}
                  </Button>
                  <p className="text-xs leading-relaxed text-slate-500">
                    A senha padrão é <strong className="font-medium text-slate-700">{USUARIOS_DEFAULT_PASSWORD}</strong> e
                    o usuário precisa trocá-la no primeiro acesso.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-dashed border-slate-300/80 bg-white/80 p-3.5 sm:p-4">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Histórico de acesso
                </h4>
                <dl className="space-y-2.5">
                  {historyLines.map((line) => (
                    <div
                      key={line.label}
                      className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                    >
                      <dt className="shrink-0 text-xs text-slate-500 sm:text-sm">{line.label}</dt>
                      <dd className="text-sm font-medium text-slate-800 sm:text-right">
                        {line.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            {/* Permissões */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
                  <Eye className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">O que pode ver</h3>
                  <p className="text-xs text-slate-500">Perfil base e módulos liberados</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acesso-role" className="text-slate-600">
                  Perfil
                </Label>
                <select
                  id="acesso-role"
                  value={role}
                  onChange={(e) => {
                    const nextRole = e.target.value as '' | AppRole
                    setRole(nextRole)
                    if (nextRole === 'coordenador') {
                      setModules((prev) => new Set(prev).add('eficiencia'))
                    }
                  }}
                  disabled={pending}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULE_KEY_OPTIONS.map((m) => {
                  const checked = modules.has(m.value)
                  return (
                    <div
                      key={m.value}
                      role="checkbox"
                      aria-checked={checked}
                      aria-disabled={pending || undefined}
                      tabIndex={pending ? -1 : 0}
                      onClick={() => {
                        if (!pending) toggleModule(m.value, !checked)
                      }}
                      onKeyDown={(e) => {
                        if (pending) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleModule(m.value, !checked)
                        }
                      }}
                      className={cn(
                        'flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                        pending && 'pointer-events-none cursor-not-allowed opacity-50',
                        checked
                          ? 'border-teal-300 bg-teal-50/70 text-slate-800 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        className="pointer-events-none"
                        aria-hidden
                      />
                      <span className="leading-snug">{m.label}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-10 bg-teal-600 hover:bg-teal-700"
            disabled={pending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              'Salvar acesso'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
