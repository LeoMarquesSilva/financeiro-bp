import { cn } from '@/lib/utils'
import type { WhatsappMensagemRow } from '@/lib/database.types'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

interface Props {
  reactions: WhatsappMensagemRow['reactions']
  onReact?: (emoji: string) => void
  className?: string
}

export function WhatsappMessageReactions({ reactions, onReact, className }: Props) {
  const list = reactions ?? []
  if (list.length === 0 && !onReact) return null

  return (
    <div className={cn('mt-1 flex flex-wrap items-center gap-1', className)}>
      {list.map((r, i) => (
        <span
          key={`${r.emoji}-${r.fromMe}-${i}`}
          className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-xs shadow-sm"
          title={r.pushName ?? undefined}
        >
          {r.emoji}
        </span>
      ))}
      {onReact && (
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded px-0.5 text-sm hover:bg-slate-100"
              onClick={() => onReact(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export { QUICK_REACTIONS }
