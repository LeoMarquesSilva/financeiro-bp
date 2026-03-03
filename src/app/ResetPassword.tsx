import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const LOGO_URL = '/team/logo-azul.png'

export function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      setReady(true)
    } else {
      const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true)
        }
      })
      return () => subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newPassword.trim() || newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem')
      return
    }

    setLoading(true)
    const { error: updateError } = await (supabase.auth as any).updateUser({ password: newPassword })
    if (updateError) {
      setError('Erro ao redefinir senha: ' + updateError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await (supabase.auth as any).getUser()
    if (user?.email) {
      await supabase
        .from('team_members')
        .update({ password_changed: true } as never)
        .eq('email', user.email)
    }

    toast.success('Senha redefinida com sucesso!')
    setLoading(false)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Senha Redefinida</h1>
            <p className="mt-2 text-sm text-slate-500">Sua senha foi alterada com sucesso.</p>
            <a
              href="/"
              className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Ir para o sistema
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
            <p className="text-slate-600">Verificando link de recuperação...</p>
            <p className="mt-2 text-sm text-slate-400">Se o link expirou, solicite um novo na tela de login.</p>
            <a href="/" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao login</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-6 flex justify-center">
            <img src={LOGO_URL} alt="Bismarchi Pires" className="h-12 w-auto object-contain" />
          </div>

          <h1 className="text-center text-xl font-bold text-slate-900">Redefinir Senha</h1>
          <p className="mt-1 text-center text-sm text-slate-500">Escolha sua nova senha</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="rp-new" className="mb-1 block text-sm font-medium text-slate-700">Nova senha</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="rp-new"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  className={cn(
                    'w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-slate-900',
                    'placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none'
                  )}
                  autoFocus
                />
                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="rp-confirm" className="mb-1 block text-sm font-medium text-slate-700">Confirmar nova senha</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="rp-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  className={cn(
                    'w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-slate-900',
                    'placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
                    confirmPassword && newPassword !== confirmPassword && 'border-red-300'
                  )}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">As senhas não conferem</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full rounded-lg py-3 font-semibold text-white transition',
                'bg-primary hover:bg-primary-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none',
                'disabled:opacity-70 disabled:cursor-not-allowed'
              )}
            >
              {loading ? 'Salvando…' : 'Redefinir Senha'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
