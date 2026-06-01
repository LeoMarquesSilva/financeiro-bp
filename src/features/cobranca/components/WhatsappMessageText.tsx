import { Fragment, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
      if (start > last) parts.push(text.slice(last, start))

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

    if (last < text.length) parts.push(text.slice(last))
    if (parts.length === 0) return [text]

    return parts.map((node, i) => (typeof node === 'string' ? <Fragment key={i}>{node}</Fragment> : node))
  }, [text, mentionMap, fromMe])

  return <p className={cn('whitespace-pre-wrap break-words', className)}>{nodes}</p>
}
