import { cn } from '@/lib/utils'

interface Props {
  preview: string
  authorLabel?: string
  /** Autor citado foi você (estilo diferente do contato). */
  authorFromMe?: boolean
  /** Bolha enviada por nós (estilo sobre fundo verde). */
  inOutgoingBubble?: boolean
  compact?: boolean
  onClick?: () => void
}

export function WhatsappQuotedBlock({
  preview,
  authorLabel,
  authorFromMe = false,
  inOutgoingBubble = false,
  compact = false,
  onClick,
}: Props) {
  const interactive = !!onClick

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      title={interactive ? 'Ir para a mensagem citada' : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        'rounded-r border-l-[3px] px-2',
        compact ? 'py-0.5' : 'py-1',
        inOutgoingBubble
          ? authorFromMe
            ? 'border-sky-300/90 bg-white/25 text-emerald-50'
            : 'border-emerald-200 bg-white/20 text-emerald-50'
          : authorFromMe
            ? 'border-sky-500 bg-sky-50/90 text-slate-700'
            : 'border-emerald-500 bg-slate-100/90 text-slate-700',
        interactive && 'cursor-pointer transition-opacity hover:opacity-90 active:opacity-80',
      )}
    >
      {authorLabel && (
        <p
          className={cn(
            'truncate font-semibold',
            compact ? 'text-[10px]' : 'text-[11px]',
            inOutgoingBubble
              ? authorFromMe
                ? 'text-sky-100'
                : 'text-emerald-100/95'
              : authorFromMe
                ? 'text-sky-600'
                : 'text-emerald-700',
          )}
        >
          {authorLabel}
        </p>
      )}
      <p className={cn('line-clamp-2', compact ? 'text-[10px]' : 'text-xs', inOutgoingBubble && 'text-emerald-50/95')}>
        {preview}
      </p>
    </div>
  )
}
