import { phoneKey } from './phone'
import { isUsableContactName } from './contactDisplay'

export interface GroupParticipantRow {
  group_jid: string
  participant_jid: string
  lid_id: string | null
  phone_number: string | null
  display_name: string | null
  profile_pic_url: string | null
  admin_role: string | null
  updated_at: string
}

export interface ResolvedParticipant {
  participant_jid: string
  lid_id: string | null
  phone_number: string | null
  profile_pic_url: string | null
  admin_role: string | null
  /** Nome exibido na UI e em menções. */
  name: string
}

type RawMessage = Record<string, unknown> | null | undefined

function lidFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  return jid.split('@')[0] || null
}

function isNumericName(name: string): boolean {
  return !isUsableContactName(name) && /^\d+$/.test(name.trim())
}

/** Extrai nomes de remetentes a partir do histórico (pushName + participant). */
export function buildSenderNamesFromMessages(
  messages: { raw: RawMessage; from_me: boolean }[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of messages) {
    if (m.from_me) continue
    const raw = m.raw as Record<string, any> | null
    if (!raw) continue
    const push = (raw.pushName ?? raw.pushname ?? '')?.trim()
    if (!push || isNumericName(push) || !isUsableContactName(push)) continue

    const key = raw.key as Record<string, string> | undefined
    const lids = [key?.participant, key?.participantAlt, raw.participant]
      .map(lidFromJid)
      .filter(Boolean) as string[]

    for (const lid of lids) {
      if (!map.has(lid)) map.set(lid, push)
    }
  }
  return map
}

function formatPhoneBr(phone: string | null | undefined): string | null {
  const key = phoneKey(phone)
  if (!key || key.length < 10) return null
  const ddd = key.slice(0, 2)
  const rest = key.slice(2)
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5)}`
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  return key
}

/** Resolve nomes: histórico > cadastro financeiro > API > telefone. */
export function resolveGroupParticipants(
  rows: GroupParticipantRow[],
  senderNames: Map<string, string>,
  contatosPorTelefone: Map<string, string>,
): ResolvedParticipant[] {
  return rows.map((row) => {
    const lid = row.lid_id
    let name: string | null = null

    if (lid && senderNames.has(lid)) name = senderNames.get(lid)!
    if (!name && row.display_name && isUsableContactName(row.display_name)) {
      name = row.display_name.trim()
    }
    if (!name && row.phone_number) {
      const k = phoneKey(row.phone_number)
      if (k && contatosPorTelefone.has(k)) name = contatosPorTelefone.get(k)!
    }
    if (!name) name = formatPhoneBr(row.phone_number) ?? (lid ? `…${lid.slice(-6)}` : 'Participante')

    return {
      participant_jid: row.participant_jid,
      lid_id: lid,
      phone_number: row.phone_number,
      profile_pic_url: row.profile_pic_url,
      admin_role: row.admin_role,
      name,
    }
  })
}

/** Mapa lid_id -> nome para resolver @menções no texto. */
export function buildMentionMap(participants: ResolvedParticipant[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of participants) {
    if (p.lid_id) map.set(p.lid_id, p.name)
  }
  return map
}

export function senderLabelFromMessage(
  m: { raw: RawMessage; from_me: boolean },
  mentionMap: Map<string, string>,
): string | null {
  if (m.from_me) return null
  const raw = m.raw as Record<string, any> | null
  if (!raw) return null

  const push = (raw.pushName ?? '')?.trim()
  if (push && isUsableContactName(push)) return push

  const participantLid = lidFromJid((raw.key as Record<string, string> | undefined)?.participant)
  if (participantLid && mentionMap.has(participantLid)) return mentionMap.get(participantLid)!

  if (push && mentionMap.has(push)) return mentionMap.get(push)!

  return null
}
