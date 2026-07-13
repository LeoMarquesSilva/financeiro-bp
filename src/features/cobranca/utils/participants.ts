import { phoneKey, canonicalJid, normalizePhone, phoneLookupAliases, phoneToRemoteJid } from './phone'
import { isUsableContactName, isPhoneFormattedLabel } from './contactDisplay'
import { formatPhoneDisplay } from './phoneMask'
import type { LidContactEntry } from './lidIndex'

export interface ResolveGroupParticipantsOptions {
  lidIndex?: Map<string, LidContactEntry>
  lidToPhone?: Map<string, string>
  /** profile_pic_url de whatsapp_chats indexado por remote_jid / phone_jid. */
  profilePicByJid?: Map<string, string>
}

/** JID para buscar avatar (nunca @lid — só telefone @s.whatsapp.net). */
export function avatarRemoteJidForParticipant(
  p: Pick<ResolvedParticipant, 'phone_number' | 'participant_jid'>,
): string | null {
  if (p.phone_number) {
    const jid = phoneToRemoteJid(p.phone_number)
    if (jid) return canonicalJid(jid)
    const digits = p.phone_number.replace(/\D/g, '')
    if (digits.length >= 10) return `${digits}@s.whatsapp.net`
  }
  if (p.participant_jid.includes('@s.whatsapp.net')) {
    return canonicalJid(p.participant_jid)
  }
  return null
}

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
  /** Telefone formatado para subtítulo (quando houver). */
  phoneLabel: string | null
}

type RawMessage = Record<string, unknown> | null | undefined

function lidFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  return jid.split('@')[0] || null
}

function isNumericName(name: string): boolean {
  return !isUsableContactName(name) && /^\d+$/.test(name.trim())
}

/** Telefone E.164 (sem +) a partir de JID @s.whatsapp.net. */
export function phoneDigitsFromJid(jid: string | null | undefined): string | null {
  if (!jid?.includes('@s.whatsapp.net')) return null
  const user = canonicalJid(jid).split('@')[0]
  if (!user || !/^\d+$/.test(user)) return null
  return normalizePhone(user) ?? user
}

/** Mapeia @lid → telefone a partir de participant + participantAlt no histórico do grupo. */
export function buildLidToPhoneFromMessages(
  messages: { raw: RawMessage; from_me: boolean }[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of messages) {
    const raw = m.raw as Record<string, any> | null
    if (!raw) continue
    const key = raw.key as Record<string, string> | undefined
    const participant = key?.participant ?? raw.participant
    const alt = key?.participantAlt ?? key?.remoteJidAlt
    if (!participant?.includes('@lid')) continue
    const lid = participant.split('@')[0]
    if (!lid || map.has(lid)) continue
    const phone = phoneDigitsFromJid(alt)
    if (phone) map.set(lid, phone)
  }
  return map
}

function indexPushNameForParticipant(
  map: Map<string, string>,
  push: string,
  participant: string | null | undefined,
  participantAlt: string | null | undefined,
): void {
  const ids = new Set<string>()
  if (participant) {
    const user = participant.split('@')[0]
    if (user) ids.add(user)
    const pk = phoneKey(participant)
    if (pk) ids.add(pk)
  }
  const phoneDigits = phoneDigitsFromJid(participantAlt)
  if (phoneDigits) {
    ids.add(phoneDigits)
    const pk = phoneKey(phoneDigits)
    if (pk) ids.add(pk)
  }
  for (const id of ids) {
    if (!map.has(id)) map.set(id, push)
  }
}

/** Extrai nomes de remetentes a partir do histórico (pushName + participant/participantAlt). */
export function buildSenderNamesFromMessages(
  messages: { raw: RawMessage; from_me: boolean }[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of messages) {
    const raw = m.raw as Record<string, any> | null
    if (!raw) continue
    const push = (raw.pushName ?? raw.pushname ?? '')?.trim()
    if (!push || isNumericName(push) || !isUsableContactName(push) || isPhoneFormattedLabel(push)) continue

    const key = raw.key as Record<string, string> | undefined
    indexPushNameForParticipant(
      map,
      push,
      key?.participant ?? raw.participant,
      key?.participantAlt ?? key?.remoteJidAlt,
    )
  }
  return map
}

function formatPhoneBr(phone: string | null | undefined): string | null {
  return formatPhoneDisplay(phone)
}

/** Chaves para cruzar pushName do histórico com participante do grupo. */
export function participantLookupKeys(row: GroupParticipantRow): string[] {
  const keys = new Set<string>()
  if (row.lid_id) keys.add(row.lid_id)
  const pjUser = row.participant_jid.split('@')[0]
  if (pjUser) keys.add(pjUser)
  const fromPhone = phoneKey(row.phone_number)
  if (fromPhone) keys.add(fromPhone)
  const fromJid = phoneKey(row.participant_jid)
  if (fromJid) keys.add(fromJid)
  if (row.phone_number) {
    const digits = row.phone_number.replace(/\D/g, '')
    if (digits.length >= 10) keys.add(digits)
  }
  return [...keys]
}

export function resolvedParticipantLookupKeys(
  p: Pick<ResolvedParticipant, 'participant_jid' | 'lid_id' | 'phone_number'>,
): string[] {
  return participantLookupKeys({
    group_jid: '',
    participant_jid: p.participant_jid,
    lid_id: p.lid_id,
    phone_number: p.phone_number,
    display_name: null,
    profile_pic_url: null,
    admin_role: null,
    updated_at: '',
  })
}

function lookupPushName(row: GroupParticipantRow, senderNames: Map<string, string>): string | null {
  for (const key of participantLookupKeys(row)) {
    const push = senderNames.get(key)?.trim()
    if (push && isUsableContactName(push) && !isPhoneFormattedLabel(push)) return push
  }
  return null
}

function resolveEffectivePhone(
  row: GroupParticipantRow,
  lidToPhone: Map<string, string>,
  lidIndex?: Map<string, LidContactEntry>,
): string | null {
  if (row.phone_number) {
    return normalizePhone(row.phone_number) ?? row.phone_number.replace(/\D/g, '')
  }
  if (row.participant_jid.includes('@s.whatsapp.net')) {
    return phoneDigitsFromJid(row.participant_jid)
  }
  const lid = row.lid_id ?? (row.participant_jid.includes('@lid') ? row.participant_jid.split('@')[0] : null)
  if (!lid) return null
  return (
    lidToPhone.get(lid) ??
    lidIndex?.get(lid)?.phone_number ??
    phoneDigitsFromJid(lidIndex?.get(lid)?.phone_jid ?? undefined) ??
    null
  )
}

function resolvePhoneLabel(effectivePhone: string | null): string | null {
  if (!effectivePhone) return null
  return formatPhoneDisplay(effectivePhone)
}

/** Inclui remetentes do histórico que ainda não estão na tabela de membros. */
export function mergeParticipantsFromMessages(
  rows: GroupParticipantRow[],
  groupJid: string,
  messages: { raw: RawMessage; from_me: boolean }[],
): GroupParticipantRow[] {
  const canonical = groupJid
  const seen = new Set(rows.map((r) => r.participant_jid))
  const extra: GroupParticipantRow[] = []

  for (const m of messages) {
    if (m.from_me) continue
    const raw = m.raw as Record<string, any> | null
    if (!raw) continue
    const key = raw.key as Record<string, string> | undefined
    const participant = key?.participant ?? raw.participant
    if (!participant || seen.has(participant)) continue
    seen.add(participant)

    const push = (raw.pushName ?? raw.pushname ?? '')?.trim()
    const user = participant.split('@')[0]
    const phoneFromAlt = phoneDigitsFromJid(key?.participantAlt ?? key?.remoteJidAlt)
    extra.push({
      group_jid: canonical,
      participant_jid: participant,
      lid_id: participant.includes('@lid') ? user : null,
      phone_number:
        participant.includes('@s.whatsapp.net')
          ? (phoneDigitsFromJid(participant) ?? user)
          : phoneFromAlt,
      display_name: push && isUsableContactName(push) && !isPhoneFormattedLabel(push) ? push : null,
      profile_pic_url: null,
      admin_role: null,
      updated_at: new Date().toISOString(),
    })
  }

  return [...rows, ...extra]
}

function lookupCadastroName(
  effectivePhone: string | null,
  row: GroupParticipantRow,
  contatosPorTelefone: Map<string, string>,
): string | null {
  const keys = new Set<string>()
  if (effectivePhone) {
    for (const alias of phoneLookupAliases(effectivePhone)) keys.add(alias)
  }
  for (const key of participantLookupKeys(row)) {
    for (const alias of phoneLookupAliases(key)) keys.add(alias)
    keys.add(key)
  }
  for (const k of keys) {
    const cadastro = contatosPorTelefone.get(k)
    if (cadastro && isUsableContactName(cadastro) && !isPhoneFormattedLabel(cadastro)) return cadastro
  }
  return null
}

function lookupLidIndexName(
  lid: string | null,
  lidIndex?: Map<string, LidContactEntry>,
): string | null {
  if (!lid || !lidIndex) return null
  const entry = lidIndex.get(lid)
  for (const candidate of [entry?.name, entry?.whatsapp_name]) {
    if (candidate && isUsableContactName(candidate) && !isPhoneFormattedLabel(candidate)) {
      return candidate.trim()
    }
  }
  return null
}

/** Nome legível para UI: nome real ou telefone formatado. */
function resolveParticipantName(
  row: GroupParticipantRow,
  senderNames: Map<string, string>,
  contatosPorTelefone: Map<string, string>,
  phoneLabel: string | null,
  effectivePhone: string | null,
  lidIndex?: Map<string, LidContactEntry>,
): string {
  const lid = row.lid_id ?? (row.participant_jid.includes('@lid') ? row.participant_jid.split('@')[0] : null)
  let name: string | null = lookupPushName(row, senderNames)

  if (!name && row.display_name?.trim()) {
    const dn = row.display_name.trim()
    if (isUsableContactName(dn) && !isPhoneFormattedLabel(dn)) name = dn
  }

  if (!name) name = lookupLidIndexName(lid, lidIndex)
  if (!name) name = lookupCadastroName(effectivePhone, row, contatosPorTelefone)

  if (!name && phoneLabel) return phoneLabel
  if (!name || isPhoneFormattedLabel(name)) return phoneLabel ?? 'Participante'

  return name
}

/** Resolve nomes: histórico > display_name > lidIndex > cadastro > telefone formatado. */
export function resolveGroupParticipants(
  rows: GroupParticipantRow[],
  senderNames: Map<string, string>,
  contatosPorTelefone: Map<string, string>,
  options: ResolveGroupParticipantsOptions = {},
): ResolvedParticipant[] {
  const lidToPhone = options.lidToPhone ?? new Map<string, string>()

  return rows.map((row) => {
    const effectivePhone = resolveEffectivePhone(row, lidToPhone, options.lidIndex)
    const phoneLabel = resolvePhoneLabel(effectivePhone)
    const name = resolveParticipantName(
      row,
      senderNames,
      contatosPorTelefone,
      phoneLabel,
      effectivePhone,
      options.lidIndex,
    )

    const phoneJid = effectivePhone ? phoneToRemoteJid(effectivePhone) : null
    let profilePic = row.profile_pic_url
    if (!profilePic && phoneJid && options.profilePicByJid) {
      profilePic = options.profilePicByJid.get(canonicalJid(phoneJid)) ?? null
    }

    return {
      participant_jid: row.participant_jid,
      lid_id: row.lid_id,
      phone_number:
        effectivePhone ??
        (row.participant_jid.includes('@s.whatsapp.net')
          ? row.participant_jid.split('@')[0]
          : null),
      profile_pic_url: profilePic,
      admin_role: row.admin_role,
      name,
      phoneLabel,
    }
  })
}

/** Mapa lid_id / telefone / jid -> nome para resolver remetentes. */
export function buildMentionMap(participants: ResolvedParticipant[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of participants) {
    if (p.lid_id) map.set(p.lid_id, p.name)
    const phone = phoneKey(p.phone_number)
    if (phone) map.set(phone, p.name)
    const jidUser = p.participant_jid.split('@')[0]
    if (jidUser) map.set(jidUser, p.name)
  }
  return map
}

function participantIdsFromRaw(raw: Record<string, any> | null): string[] {
  if (!raw) return []
  const key = raw.key as Record<string, string> | undefined
  return [key?.participant, key?.participantAlt, raw.participant]
    .map(lidFromJid)
    .filter(Boolean) as string[]
}

export function senderLabelFromMessage(
  m: { raw: RawMessage; from_me: boolean },
  lookup: Map<string, string>,
): string | null {
  if (m.from_me) return null
  const raw = m.raw as Record<string, any> | null

  const push = (raw?.pushName ?? raw?.pushname ?? '')?.trim()
  if (push && isUsableContactName(push) && !isPhoneFormattedLabel(push)) return push

  const key = raw?.key as Record<string, string> | undefined
  const altPhone = phoneDigitsFromJid(key?.participantAlt ?? key?.remoteJidAlt)

  for (const id of participantIdsFromRaw(raw)) {
    if (lookup.has(id)) return lookup.get(id)!
    const formatted = formatPhoneBr(id)
    if (formatted) return formatted
  }

  if (altPhone) {
    const pk = phoneKey(altPhone)
    if (pk && lookup.has(pk)) return lookup.get(pk)!
    const formatted = formatPhoneBr(altPhone)
    if (formatted) return formatted
  }

  if (push) {
    const formatted = formatPhoneBr(push)
    if (formatted) return formatted
  }

  return null
}
