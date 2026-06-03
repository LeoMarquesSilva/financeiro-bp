import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { parseWhatsappFormatting, type WhatsappFormatNode } from '../utils/whatsappFormatting'

function renderNode(node: WhatsappFormatNode, key: string, fromMe?: boolean): ReactNode {
  if (node.type === 'text') return node.value

  const className = cn(
    node.type === 'bold' && 'font-semibold',
    node.type === 'italic' && 'italic',
    node.type === 'strike' && 'line-through opacity-90',
    node.type === 'mono' &&
      cn(
        'rounded px-0.5 font-mono text-[0.92em]',
        fromMe ? 'bg-emerald-600/50' : 'bg-slate-100',
      ),
  )

  return (
    <span key={key} className={className}>
      {node.children.map((child, i) => (
        <Fragment key={i}>{renderNode(child, `${key}-${i}`, fromMe)}</Fragment>
      ))}
    </span>
  )
}

/** Texto com formatação WhatsApp (*negrito*, _itálico_, ~riscado~, `mono`). */
export function WhatsappFormattedText({
  text,
  fromMe,
}: {
  text: string
  fromMe?: boolean
}) {
  const tree = parseWhatsappFormatting(text)
  if (tree.length === 0) return null

  return (
    <>
      {tree.map((node, i) => (
        <Fragment key={i}>{renderNode(node, String(i), fromMe)}</Fragment>
      ))}
    </>
  )
}
