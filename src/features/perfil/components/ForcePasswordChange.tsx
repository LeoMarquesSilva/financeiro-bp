import { ShieldAlert, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordChangeBannerProps {
  onNavigateToProfile: () => void
  onDismiss: () => void
}

export function PasswordChangeBanner({ onNavigateToProfile, onDismiss }: PasswordChangeBannerProps) {
  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3',
      'shadow-sm animate-in slide-in-from-top-2 duration-300'
    )}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
        <ShieldAlert className="h-5 w-5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">Primeiro acesso detectado</p>
        <p className="text-xs text-amber-700">Por segurança, altere sua senha padrão.</p>
      </div>
      <button
        type="button"
        onClick={onNavigateToProfile}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-amber-700 hover:shadow"
      >
        Alterar senha <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-amber-400 hover:bg-amber-100 hover:text-amber-600"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
