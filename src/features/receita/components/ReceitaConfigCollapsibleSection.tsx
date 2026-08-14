import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Conteúdo visível quando recolhido (ex.: resumo). */
  summary?: ReactNode
  defaultOpen?: boolean
  bordered?: boolean
  children: ReactNode
}

export function ReceitaConfigCollapsibleSection({
  title,
  description,
  icon,
  summary,
  defaultOpen = false,
  bordered = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={cn(
        'space-y-0',
        bordered && 'border-t border-slate-200 pt-6 first:border-t-0 first:pt-0',
      )}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 rounded-md text-left hover:bg-slate-50/80 -mx-1 px-1 py-0.5"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {icon}
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
          {!open && summary && (
            <p className="mt-1.5 truncate text-xs text-slate-400">{summary}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  )
}
