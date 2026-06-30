import { canonicalJid } from './phone'
import { isGroupJid } from './jid'
import { displayMessageContent, extractMessageText } from './messageContent'
import type { WhatsappMensagemRow } from '@/lib/database.types'

/** Alvo de resposta no composer (citar mensagem). */
export interface ReplyTarget {
  messageId: string
  fromMe: boolean
  participant: string | null
  preview: string
  authorLabel?: string
  tipo: string | null
  conteudo: string | null
  raw: Record<string, unknown> | null
}

/** Citação exibida dentro de uma bolha (mensagem recebida/enviada com reply). */
export interface QuotedPreview {
  text: string
  stanzaId?: string
  /** JID de quem enviou a mensagem citada (grupos / 1:1). */
  participant?: string
  /** Autor da mensagem citada (quando conhecido no raw). */
  quotedFromMe?: boolean
}

export interface QuotedAuthorInfo {
  label: string
  fromMe: boolean
}

export interface QuoteSendPayload {
  messageId: string
  fromMe: boolean
  chatRemoteJid: string
  participant?: string | null
  tipo?: string | null
  conteudo?: string | null
  raw?: Record<string, unknown> | null
}

function contextInfoFromEnvelope(msg: Record<string, any> | null): Record<string, any> | null {
  if (!msg) return null
  return (
    msg.extendedTextMessage?.contextInfo ??
    msg.imageMessage?.contextInfo ??
    msg.videoMessage?.contextInfo ??
    msg.documentMessage?.contextInfo ??
    msg.audioMessage?.contextInfo ??
    msg.stickerMessage?.contextInfo ??
    msg.conversation?.contextInfo ??
    null
  )
}

/**
 * Evolution/Baileys: contextInfo pode vir na raiz do evento (webhook/send web)
 * ou aninhado em message.*.contextInfo.
 */
function extractContextInfo(raw: Record<string, unknown> | null | undefined): Record<string, any> | null {
  if (!raw) return null
  const r = raw as Record<string, any>
  if (r.contextInfo?.quotedMessage) return r.contextInfo
  const msg = r.message as Record<string, any> | undefined
  return contextInfoFromEnvelope(msg ?? null)
}

/** Participante autor da mensagem (grupos). */
export function extractMessageParticipant(
  raw: Record<string, unknown> | null | undefined,
): string | null {
  if (!raw) return null
  const r = raw as Record<string, any>
  const participant = r.key?.participant ?? r.message?.key?.participant
  if (!participant || typeof participant !== 'string') return null
  return canonicalJid(participant)
}

/** Lê preview da mensagem citada no raw (contextInfo). */
export function extractQuotedPreview(row: {
  tipo?: string | null
  raw?: Record<string, unknown> | null
}): QuotedPreview | null {
  const ctx = extractContextInfo(row.raw ?? null)
  const quoted = ctx?.quotedMessage as Record<string, unknown> | undefined
  if (!quoted) return null

  const text = extractMessageText(quoted, null)
  if (!text) return null

  const participant =
    typeof ctx?.participant === 'string' ? canonicalJid(ctx.participant) : undefined

  const quotedFromMe =
    typeof ctx?.quotedFromMe === 'boolean'
      ? ctx.quotedFromMe
      : typeof (ctx?.quotedMessage as Record<string, any> | undefined)?.key?.fromMe === 'boolean'
        ? ((ctx?.quotedMessage as Record<string, any>).key.fromMe as boolean)
        : undefined

  return {
    text,
    stanzaId: typeof ctx?.stanzaId === 'string' ? ctx.stanzaId : undefined,
    participant,
    quotedFromMe,
  }
}

export function replyTargetFromMessage(
  message: WhatsappMensagemRow,
  authorLabel?: string,
): ReplyTarget | null {
  if (!message.message_id) return null
  return {
    messageId: message.message_id,
    fromMe: message.from_me,
    participant: extractMessageParticipant(message.raw),
    preview: displayMessageContent(message),
    authorLabel,
    tipo: message.tipo ?? null,
    conteudo: message.conteudo,
    raw: (message.raw as Record<string, unknown> | null) ?? null,
  }
}

/** Nome do participante citado (grupos), sem fallback genérico. */
export function quotedAuthorLabel(
  quoted: QuotedPreview,
  mentionMap: Map<string, string>,
): string | undefined {
  if (!quoted.participant) return undefined
  const jid = quoted.participant
  const digits = jid.split('@')[0]
  return (
    mentionMap.get(jid) ??
    mentionMap.get(`${digits}@s.whatsapp.net`) ??
    mentionMap.get(digits) ??
    undefined
  )
}

/** Rótulo do autor na bolha citada: "Você" ou nome do contato/participante. */
export function resolveQuotedAuthorLabel(
  quoted: QuotedPreview,
  parentMessage: { from_me: boolean },
  mentionMap: Map<string, string>,
  contactLabel?: string,
  messagesById?: Map<string, { from_me: boolean }>,
): QuotedAuthorInfo {
  let fromMe: boolean | undefined

  if (quoted.stanzaId && messagesById?.has(quoted.stanzaId)) {
    fromMe = messagesById.get(quoted.stanzaId)!.from_me
  } else if (typeof quoted.quotedFromMe === 'boolean') {
    fromMe = quoted.quotedFromMe
  } else if (!quoted.participant) {
    // 1:1: quem respondeu costuma citar a outra parte
    fromMe = !parentMessage.from_me
  } else {
    fromMe = false
  }

  if (fromMe) return { label: 'Você', fromMe: true }

  return {
    label: quotedAuthorLabel(quoted, mentionMap) ?? contactLabel ?? 'Participante',
    fromMe: false,
  }
}

/** Payload enviado à edge function para montar `quoted` na Evolution API. */
export function buildQuoteSendPayload(
  reply: ReplyTarget,
  chatRemoteJid: string,
): QuoteSendPayload {
  const chat = canonicalJid(chatRemoteJid)
  let participant = reply.participant

  if (isGroupJid(chat) && !participant && !reply.fromMe) {
    const fromRaw = extractMessageParticipant(reply.raw)
    if (fromRaw) participant = fromRaw
  }

  return {
    messageId: reply.messageId,
    fromMe: reply.fromMe,
    chatRemoteJid: chat,
    participant,
    tipo: reply.tipo,
    conteudo: reply.conteudo,
    raw: reply.raw ?? undefined,
  }
}
