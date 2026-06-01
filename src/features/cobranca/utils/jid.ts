import { canonicalJid } from './phone'

/** Conversa de grupo WhatsApp (ex.: 120363402671222218@g.us). */
export function isGroupJid(jid: string | null | undefined): boolean {
  return !!jid && jid.endsWith('@g.us')
}

/** JID @lid — número oculto pelo WhatsApp. */
export function isLidJid(jid: string | null | undefined): boolean {
  return !!jid && jid.includes('@lid')
}

/** ID numérico do grupo (sem @g.us). */
export function groupIdFromJid(jid: string): string {
  return canonicalJid(jid).split('@')[0]
}

/** Rótulo curto quando o nome do grupo ainda não foi sincronizado. */
export function groupFallbackLabel(jid: string): string {
  const id = groupIdFromJid(jid)
  return id.length > 8 ? `Grupo · …${id.slice(-8)}` : `Grupo · ${id}`
}

/** Subtítulo da conversa (telefone, grupo ou privacidade). */
export function chatSubtitle(jid: string): string {
  if (isGroupJid(jid)) return 'Grupo WhatsApp'
  if (isLidJid(jid)) return 'Número oculto'
  return canonicalJid(jid).split('@')[0]
}
