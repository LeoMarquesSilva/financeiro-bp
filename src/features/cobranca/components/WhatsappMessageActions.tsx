import { CornerDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QUICK_REACTIONS } from './WhatsappMessageReactions'
import type { WhatsappMensagemRow } from '@/lib/database.types'

interface Props {
  message: WhatsappMensagemRow
  reactions: WhatsappMensagemRow['reactions']
  onReact?: (emoji: string) => void
  onReply?: () => void
  className?: string
}

export function WhatsappMessageActions({
  message,
  reactions,
  onReact,
  onReply,
  className,
}: Props) {
  const list = reactions ?? []
  const showBar = onReply || onReact || list.length > 0
  if (!showBar) return null

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
      {(onReply || onReact) && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onReply && message.message_id && (
            <button
              type="button"
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
              title="Responder citando esta mensagem"
              onClick={onReply}
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              Responder
            </button>
          )}
          {onReact &&
            QUICK_REACTIONS.map((emoji) => (
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
