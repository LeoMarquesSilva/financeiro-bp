import type { WhatsappChatRow } from '@/lib/database.types'
import { canonicalJid, normalizePhone, phoneKey, phonesMatch } from './phone'
import { formatPhoneFromWhatsappDigits, parsePhoneDigits } from './phoneMask'

export function escapeIlike(term: string): string {
  return term.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '')
}

/** Filtros PostgREST: nome ou telefone (com/sem máscara, DDI, 9º dígito). */
export function buildChatSearchOr(term: string): string {
  const safe = escapeIlike(term)
  const parts = new Set<string>([
    `push_name.ilike.%${safe}%`,
    `remote_jid.ilike.%${safe}%`,
    `phone_jid.ilike.%${safe}%`,
  ])

  const digits = parsePhoneDigits(term)
  if (digits.length >= 4) {
    for (const field of ['remote_jid', 'phone_jid'] as const) {
      parts.add(`${field}.ilike.%${digits}%`)
      if (digits.startsWith('55') && digits.length > 4) {
        parts.add(`${field}.ilike.%${digits.slice(2)}%`)
      } else if (digits.length >= 8) {
        parts.add(`${field}.ilike.%55${digits}%`)
      }
      if (digits.length >= 8) {
        parts.add(`${field}.ilike.%${digits.slice(-8)}%`)
      }
    }
  }

  return [...parts].join(',')
}

export function telefoneToRemoteJid(telefone: string): string | null {
  const n = normalizePhone(telefone)
  return n ? `${n}@s.whatsapp.net` : null
}

function phoneDigitsFromChat(chat: WhatsappChatRow): string[] {
  const out = new Set<string>()
  const add = (raw: string | null | undefined) => {
    const d = parsePhoneDigits(raw ?? '')
    if (d) out.add(d)
  }
  add(canonicalJid(chat.remote_jid).split('@')[0])
  if (chat.phone_jid) add(canonicalJid(chat.phone_jid).split('@')[0])
  return [...out]
}

/** Filtro client-side após deduplicação (@lid, variações de DDI/9º dígito). */
export function chatMatchesSearch(
  chat: WhatsappChatRow,
  term: string,
  lidToPhone?: Map<string, string>,
): boolean {
  const trimmed = term.trim()
  if (!trimmed) return true

  const lower = trimmed.toLowerCase()
  if (chat.push_name?.toLowerCase().includes(lower)) return true

  const termDigits = parsePhoneDigits(trimmed)
  const phones = phoneDigitsFromChat(chat)

  if (chat.remote_jid.includes('@lid') && lidToPhone) {
    const lid = chat.remote_jid.split('@')[0]
    const mapped = lid ? lidToPhone.get(lid) : undefined
    if (mapped) phones.push(mapped)
  }

  if (termDigits.length >= 4) {
    for (const p of phones) {
      if (p.includes(termDigits)) return true
      if (phonesMatch(p, termDigits)) return true
      const formatted = formatPhoneFromWhatsappDigits(p)
      if (formatted && parsePhoneDigits(formatted).includes(termDigits)) return true
    }
    const key = phoneKey(termDigits)
    if (key) {
      for (const p of phones) {
        if (phoneKey(p) === key) return true
      }
    }
    return false
  }

  return (
    chat.remote_jid.toLowerCase().includes(lower) ||
    (chat.phone_jid?.toLowerCase().includes(lower) ?? false)
  )
}
