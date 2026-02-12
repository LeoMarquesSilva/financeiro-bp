import { useState } from 'react'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { getExpectedLogin, getExpectedPassword, setAuthenticated } from '@/lib/auth'
import { cn } from '@/lib/utils'

const BACKGROUND_IMAGE = '/escritorio dia.png'
const LOGO_URL = '/team/logo-azul.png'

interface LoginProps {
  onSuccess: () => void
}

export function Login({ onSuccess }: LoginProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expectedLogin = getExpectedLogin()
  const expectedPassword = getExpectedPassword()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const loginTrim = login.trim()
    const passwordTrim = password.trim()

    if (!loginTrim || !passwordTrim) {
      setError('Preencha usuário e senha.')
      return
    }

    setLoading(true)
    if (loginTrim === expectedLogin && passwordTrim === expectedPassword) {
      setAuthenticated()
      onSuccess()
    } else {
      setError('Usuário ou senha incorretos.')
      setLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-primary-dark p-4"
      style={{
        backgroundImage: `url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Overlay escuro */}
      <div
        className="absolute inset-0 bg-primary-dark/75"
        aria-hidden
      />

      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div
          className={cn(
            'rounded-2xl border border-white/10 bg-white p-8 shadow-2xl',
            'transition duration-300'
          )}
        >
          <div className="mb-6 flex justify-center">
            <img
              src={LOGO_URL}
              alt="Bismarchi Pires"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-center text-xl font-bold tracking-tight text-slate-900">
            Financeiro BP
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500">
            Entre com suas credenciais para acessar o sistema.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-user" className="sr-only">
                Usuário
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="h-5 w-5" />
                </span>
                <input
                  id="login-user"
                  type="text"
                  autoComplete="username"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Usuário"
                  disabled={loading}
                  className={cn(
                    'w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-900',
                    'placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
                    'disabled:opacity-60'
                  )}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                Senha
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  disabled={loading}
                  className={cn(
                    'w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 text-slate-900',
                    'placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none',
                    'disabled:opacity-60'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded p-1"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
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
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
