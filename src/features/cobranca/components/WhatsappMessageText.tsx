import { useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { WhatsappFormattedText } from './WhatsappFormattedText'

const MENTION_RE = /@(\d{5,})/g

interface Props {
  text: string
  mentionMap: Map<string, string>
  fromMe?: boolean
  className?: string
}

/** Renderiza texto com menções @lid resolvidas para nomes. */
export function WhatsappMessageText({ text, mentionMap, fromMe, className }: Props) {
  const nodes = useMemo(() => {
    const parts: ReactNode[] = []
    let last = 0
    let match: RegExpExecArray | null
    MENTION_RE.lastIndex = 0

    while ((match = MENTION_RE.exec(text)) !== null) {
      const [full, lidId] = match
      const start = match.index
      if (start > last) {
        const chunk = text.slice(last, start)
        parts.push(
          <WhatsappFormattedText key={`fmt-${start}`} text={chunk} fromMe={fromMe} />,
        )
      }

      const name = mentionMap.get(lidId)
      parts.push(
        <span
          key={`${start}-${lidId}`}
          className={cn(
            'rounded px-0.5 font-medium',
            fromMe ? 'bg-emerald-400/30 text-emerald-50' : 'bg-sky-100 text-sky-800',
          )}
          title={name ? `@${lidId}` : undefined}
        >
          {name ? `@${name}` : full}
        </span>,
      )
      last = start + full.length
    }

    if (last < text.length) {
      parts.push(<WhatsappFormattedText key={`fmt-tail`} text={text.slice(last)} fromMe={fromMe} />)
    }
    if (parts.length === 0) {
      return [<WhatsappFormattedText key="fmt-all" text={text} fromMe={fromMe} />]
    }

    return parts
  }, [text, mentionMap, fromMe])

  return <p className={cn('whitespace-pre-wrap break-words', className)}>{nodes}</p>
}
