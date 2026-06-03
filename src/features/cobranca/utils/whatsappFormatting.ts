/**
 * Converte marcação de texto do WhatsApp (*negrito*, _itálico_, ~riscado~, `mono`) em árvore simples.
 * Regras aproximadas do cliente oficial (delimitador sem espaço após abertura; listas com "* " na linha).
 */

export type WhatsappFormatKind = 'bold' | 'italic' | 'strike' | 'mono'

export type WhatsappFormatNode =
  | { type: 'text'; value: string }
  | { type: WhatsappFormatKind; children: WhatsappFormatNode[] }

interface DelimiterHit {
  kind: WhatsappFormatKind
  openLen: number
  closeIndex: number
  closeLen: number
}

function isLineStart(text: string, index: number): boolean {
  return index === 0 || text[index - 1] === '\n'
}

function tryDelimiterAt(text: string, index: number): DelimiterHit | null {
  if (text.startsWith('```', index)) {
    const close = text.indexOf('```', index + 3)
    if (close > index + 3) {
      return { kind: 'mono', openLen: 3, closeIndex: close, closeLen: 3 }
    }
    return null
  }

  if (text[index] === '`' && !text.startsWith('```', index)) {
    let close = -1
    for (let j = index + 1; j < text.length; j++) {
      if (text[j] !== '`') continue
      if (text.startsWith('```', j)) {
        j += 2
        continue
      }
      close = j
      break
    }
    if (close > index + 1) {
      const inner = text.slice(index + 1, close)
      if (!inner.includes('\n')) {
        return { kind: 'mono', openLen: 1, closeIndex: close, closeLen: 1 }
      }
    }
    return null
  }

  if (text[index] === '*') {
    if (text.startsWith('**', index)) return null
    if (isLineStart(text, index) && text[index + 1] === ' ') return null
    if (text[index + 1] === ' ' || text[index + 1] === '\n') return null
    const close = text.indexOf('*', index + 1)
    if (close > index + 1) {
      const inner = text.slice(index + 1, close)
      if (!inner.includes('\n') && inner.length > 0) {
        return { kind: 'bold', openLen: 1, closeIndex: close, closeLen: 1 }
      }
    }
    return null
  }

  if (text[index] === '_') {
    if (text[index + 1] === ' ' || text[index + 1] === '\n') return null
    const close = text.indexOf('_', index + 1)
    if (close > index + 1) {
      const inner = text.slice(index + 1, close)
      if (!inner.includes('\n') && inner.length > 0) {
        return { kind: 'italic', openLen: 1, closeIndex: close, closeLen: 1 }
      }
    }
    return null
  }

  if (text[index] === '~') {
    if (text[index + 1] === ' ' || text[index + 1] === '\n') return null
    const close = text.indexOf('~', index + 1)
    if (close > index + 1) {
      const inner = text.slice(index + 1, close)
      if (!inner.includes('\n') && inner.length > 0) {
        return { kind: 'strike', openLen: 1, closeIndex: close, closeLen: 1 }
      }
    }
    return null
  }

  return null
}

function findEarliestDelimiter(text: string, from: number): { index: number; hit: DelimiterHit } | null {
  let best: { index: number; hit: DelimiterHit } | null = null
  for (let i = from; i < text.length; i++) {
    const hit = tryDelimiterAt(text, i)
    if (!hit) continue
    if (!best || i < best.index) best = { index: i, hit }
  }
  return best
}

export function parseWhatsappFormatting(text: string): WhatsappFormatNode[] {
  function parseSegment(segment: string): WhatsappFormatNode[] {
    if (!segment) return []

    const found = findEarliestDelimiter(segment, 0)
    if (!found) return [{ type: 'text', value: segment }]

    const { index, hit } = found
    const nodes: WhatsappFormatNode[] = []

    if (index > 0) {
      nodes.push({ type: 'text', value: segment.slice(0, index) })
    }

    const inner = segment.slice(index + hit.openLen, hit.closeIndex)
    const children = parseSegment(inner)
    nodes.push({
      type: hit.kind,
      children: children.length > 0 ? children : [{ type: 'text', value: inner }],
    })

    const tail = segment.slice(hit.closeIndex + hit.closeLen)
    nodes.push(...parseSegment(tail))

    return nodes
  }

  return parseSegment(text)
}
