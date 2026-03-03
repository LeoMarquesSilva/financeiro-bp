import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { getTeamMember } from '@/lib/teamAvatars'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Eye, EyeOff, Lock, Shield, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function PerfilPage() {
  const { user, fullName, avatarUrl, role, markPasswordChanged } = useAuth()
  const localAvatar = user?.email ? getTeamMember(user.email)?.avatar : null
  const displayAvatar = localAvatar ?? avatarUrl

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem')
      return
    }
    if (!currentPassword.trim()) {
      toast.error('Informe a senha atual')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('change_user_password' as never, {
        current_password: currentPassword,
        new_password: newPassword,
      } as never)

      const result = data as { error?: string; success?: boolean } | null
      if (error) {
        toast.error('Erro ao alterar senha')
        setLoading(false)
        return
      }
      if (result?.error) {
        toast.error(result.error === 'Current password is incorrect' ? 'Senha atual incorreta' : result.error)
        setLoading(false)
        return
      }

      markPasswordChanged()
      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error('Erro inesperado ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    financeiro: 'Financeiro',
    comite: 'Comitê',
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meu Perfil</h1>
        <p className="mt-0.5 text-sm text-slate-500">Gerencie suas informações e credenciais</p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-slate-200">
              {displayAvatar && <AvatarImage src={displayAvatar} alt={fullName ?? ''} />}
              <AvatarFallback className="bg-primary-dark/10 text-lg font-bold text-primary-dark">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{fullName ?? 'Usuário'}</h2>
              <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user?.email}</span>
                <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />{roleLabels[role ?? ''] ?? role}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-bold text-slate-900">Alterar Senha</h2>
          </div>
          <p className="text-sm text-slate-500">Atualize sua senha de acesso ao sistema</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  className={cn('pr-10', confirmPassword && newPassword !== confirmPassword && 'border-red-300 focus-visible:ring-red-200')}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600">As senhas não conferem</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading} className="gap-2">
                <Lock className="h-4 w-4" />
                {loading ? 'Salvando…' : 'Alterar Senha'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
