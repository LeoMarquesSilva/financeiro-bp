import { phoneKey, canonicalJid } from './phone'
import { isUsableContactName } from './contactDisplay'
import { normalizePhoneE164 } from './normalizePhoneE164'
import { formatPhoneDisplay } from './phoneMask'
import type { GroupParticipantRow } from './participants'

export interface LidContactEntry {
  lid_id: string
  lid_jid: string
  phone_number: string | null
  phone_jid: string | null
  whatsapp_name: string | null
  name: string | null
}

function pickWhatsappName(candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (isUsableContactName(c)) return c!.trim()
  }
  return null
}

/** Prioridade: cadastro vinculado → nome WhatsApp → telefone formatado. */
export function resolveContactLabel(
  phone: string | null | undefined,
  whatsappNames: (string | null | undefined)[],
  contatosPorTelefone: Map<string, string>,
): string {
  const k = phoneKey(phone)
  if (k && contatosPorTelefone.has(k)) {
    const cadastro = contatosPorTelefone.get(k)!
    if (isUsableContactName(cadastro)) return cadastro.trim()
  }
  for (const w of whatsappNames) {
    if (isUsableContactName(w)) return w!.trim()
  }
  const digits = (phone ?? '').replace(/\D/g, '')
  const formatted = formatPhoneDisplay(phone)
  if (formatted) return formatted
  if (digits.length >= 8) return `+${normalizePhoneE164(phone) ?? digits}`
  return 'Participante'
}

/** Extrai telefone canônico a partir de remoteJidAlt (Evolution/Baileys). */
export function phoneFromJidAlt(alt: string | null | undefined): string | null {
  if (!alt?.trim()) return null
  const canonical = canonicalJid(alt.trim())
  const user = canonical.split('@')[0]
  return user && /^\d+$/.test(user) ? user : null
}

/** Índice lid_id -> telefone/nome a partir dos participantes de grupos + push_name dos chats. */
export function buildLidContactIndex(
  participants: Pick<GroupParticipantRow, 'lid_id' | 'phone_number' | 'display_name'>[],
  chatsByPhoneJid: Map<string, string | null>,
  contatosPorTelefone: Map<string, string>,
  lidChatNames: Map<string, string> = new Map(),
  messageNames: Map<string, string> = new Map(),
  lidToPhoneDigits: Map<string, string> = new Map(),
): Map<string, LidContactEntry> {
  const index = new Map<string, LidContactEntry>()

  const upsert = (lid: string, phone: string | null | undefined, phoneJid: string | null, name: string | null) => {
    const phoneDigits = phone ? phoneFromJidAlt(phone) ?? phone.replace(/\D/g, '') : lidToPhoneDigits.get(lid) ?? null
    const resolvedPhoneJid = phoneJid ?? (phoneDigits ? `${phoneDigits}@s.whatsapp.net` : null)
    const chatPush = resolvedPhoneJid ? chatsByPhoneJid.get(resolvedPhoneJid) : null
    const whatsappName = pickWhatsappName([lidChatNames.get(lid), messageNames.get(lid), name, chatPush])
    const displayName = resolveContactLabel(phoneDigits ?? phone, [whatsappName], contatosPorTelefone)
    const existing = index.get(lid)
    if (existing) {
      if (!existing.whatsapp_name && whatsappName) existing.whatsapp_name = whatsappName
      if (!existing.name && displayName) existing.name = displayName
      if (!existing.phone_jid && resolvedPhoneJid) existing.phone_jid = resolvedPhoneJid
      if (!existing.phone_number && phoneDigits) existing.phone_number = phoneDigits
      return
    }
    index.set(lid, {
      lid_id: lid,
      lid_jid: `${lid}@lid`,
      phone_number: phoneDigits ?? null,
      phone_jid: resolvedPhoneJid,
      whatsapp_name: whatsappName,
      name: displayName,
    })
  }

  for (const [lid, phoneDigits] of lidToPhoneDigits) {
    upsert(lid, phoneDigits, `${phoneDigits}@s.whatsapp.net`, null)
  }

  for (const p of participants) {
    const lid = p.lid_id?.trim()
    if (!lid) continue
    const phoneJid = p.phone_number ? canonicalJid(p.phone_number) : null
    const chatPush = phoneJid ? chatsByPhoneJid.get(phoneJid) : null
    upsert(lid, p.phone_number, phoneJid, pickWhatsappName([chatPush, p.display_name]))
  }

  for (const [lid, nome] of lidChatNames) {
    if (!index.has(lid)) upsert(lid, lidToPhoneDigits.get(lid), null, nome)
    else {
      const e = index.get(lid)!
      if (!e.whatsapp_name) e.whatsapp_name = pickWhatsappName([nome])
      if (!e.name) e.name = resolveContactLabel(e.phone_number, [e.whatsapp_name, nome], contatosPorTelefone)
    }
  }

  for (const [lid, nome] of messageNames) {
    if (!index.has(lid)) upsert(lid, lidToPhoneDigits.get(lid), null, nome)
    else {
      const e = index.get(lid)!
      if (!e.whatsapp_name) e.whatsapp_name = pickWhatsappName([nome])
      if (!e.name) e.name = resolveContactLabel(e.phone_number, [e.whatsapp_name, nome], contatosPorTelefone)
    }
  }

  return index
}

export function lidFromJid(jid: string): string | null {
  if (!jid.includes('@lid')) return null
  return jid.split('@')[0] || null
}

/** Resolve nome de exibição para chat individual (inclui @lid). */
export function resolveChatDisplayName(
  remoteJid: string,
  pushName: string | null | undefined,
  contatosPorTelefone: Map<string, string>,
  lidIndex: Map<string, LidContactEntry>,
  isGroup: boolean,
  groupFallback: (jid: string) => string,
): string {
  if (isGroup) {
    if (isUsableContactName(pushName)) return pushName!.trim()
    return groupFallback(remoteJid)
  }

  const lid = lidFromJid(remoteJid)
  if (lid) {
    const entry = lidIndex.get(lid)
    const phoneRaw = entry?.phone_number ?? phoneFromJidAlt(entry?.phone_jid ?? undefined)
    return resolveContactLabel(
      phoneRaw,
      [pushName, entry?.whatsapp_name],
      contatosPorTelefone,
    )
  }

  const phoneRaw = remoteJid.split('@')[0]
  return resolveContactLabel(phoneRaw, [pushName], contatosPorTelefone)
}
