import { useAuth } from '@/lib/AuthContext'
import { Login } from '@/app/Login'
import { useRacionalExportFromUrl } from '../hooks/useRacionalExportFromUrl'

/** Deep link do e-mail gestão à vista — dispara download do Excel do racional. */
export function RacionalExportPage() {
  const { user, loading } = useAuth()
  const authReady = !loading && Boolean(user)
  useRacionalExportFromUrl(authReady)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Carregando…</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      <p className="text-center text-slate-700">Gerando racional Excel…</p>
      <p className="text-center text-sm text-slate-500">
        O download deve iniciar em instantes. Você pode fechar esta aba depois.
      </p>
    </div>
  )
}
