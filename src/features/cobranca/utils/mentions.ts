import { normalizePhone, phoneLookupAliases } from './phone'
import { isUsableContactName, isPhoneFormattedLabel } from './contactDisplay'
import { formatPhoneDisplay } from './phoneMask'
import type { ResolvedParticipant } from './participants'
import { resolvedParticipantLookupKeys } from './participants'

export { isPhoneFormattedLabel }

export interface MentionTrigger {
  /** Índice do caractere `@` no texto. */
  atIndex: number
  /** Texto digitado após `@` (sem espaços). */
  query: string
}

/** Detecta se o cursor está em modo de menção (@). */
export function findMentionTrigger(text: string, cursorPos: number): MentionTrigger | null {
  const before = text.slice(0, cursorPos)
  const atIndex = before.lastIndexOf('@')
  if (atIndex < 0) return null

  const charBefore = atIndex > 0 ? before[atIndex - 1] : ' '
  if (charBefore !== ' ' && charBefore !== '\n' && atIndex !== 0) return null

  const query = before.slice(atIndex + 1)
  if (/\s/.test(query)) return null

  return { atIndex, query }
}

/** Token inserido ao selecionar membro no autocomplete. */
export function mentionDisplayToken(
  member: ResolvedParticipant,
  allMembers: ResolvedParticipant[] = [],
): string {
  if (!isPhoneFormattedLabel(member.name)) {
    const first = member.name.split(/\s+/)[0] ?? member.name
    const dupes = allMembers.filter((m) => {
      if (isPhoneFormattedLabel(m.name)) return false
      return (m.name.split(/\s+/)[0] ?? m.name) === first
    })
    if (dupes.length > 1) return member.name
    return first
  }
  return member.name
}

/** Nome amigável para exibir em @menções nas bolhas. */
export function mentionDisplayLabel(
  member: ResolvedParticipant,
  allMembers: ResolvedParticipant[] = [],
): string {
  return mentionDisplayToken(member, allMembers)
}

export function filterMembersForMention(
  members: ResolvedParticipant[],
  query: string,
): ResolvedParticipant[] {
  const q = query.trim().toLowerCase()
  const sorted = [...members].sort((a, b) => {
    const aReal = !isPhoneFormattedLabel(a.name) ? 0 : 1
    const bReal = !isPhoneFormattedLabel(b.name) ? 0 : 1
    if (aReal !== bReal) return aReal - bReal
    return a.name.localeCompare(b.name, 'pt-BR')
  })
  if (!q) return sorted
  return sorted.filter((m) => {
    const name = m.name.toLowerCase()
    const phone = (m.phoneLabel ?? m.phone_number ?? '').replace(/\D/g, '')
    return name.includes(q) || phone.includes(q)
  })
}

/** Insere menção no texto substituindo `@query` parcial. */
export function insertMentionToken(
  text: string,
  trigger: MentionTrigger,
  member: ResolvedParticipant,
  cursorPos: number,
  allMembers: ResolvedParticipant[] = [],
): { text: string; cursorPos: number } {
  const token = `@${mentionDisplayToken(member, allMembers)} `
  const before = text.slice(0, trigger.atIndex)
  const after = text.slice(cursorPos)
  const newText = before + token + after
  const newCursor = before.length + token.length
  return { text: newText, cursorPos: newCursor }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Mapa id/telefone -> nome legível para renderizar @menções nas bolhas. */
export function buildMentionDisplayMap(
  participants: ResolvedParticipant[],
  senderNames: Map<string, string> = new Map(),
): Map<string, string> {
  const map = new Map<string, string>()

  const setLabel = (key: string, label: string) => {
    if (!key || !label) return
    const existing = map.get(key)
    if (!existing || isPhoneFormattedLabel(existing)) map.set(key, label)
  }

  for (const p of participants) {
    let label = mentionDisplayLabel(p, participants)
    if (isPhoneFormattedLabel(label)) {
      for (const id of resolvedParticipantLookupKeys(p)) {
        const push = senderNames.get(id)
        if (push && isUsableContactName(push) && !isPhoneFormattedLabel(push)) {
          label = push.split(/\s+/)[0] ?? push
          break
        }
      }
    }
    if (!label) continue

    if (p.lid_id) setLabel(p.lid_id, label)
    for (const alias of phoneLookupAliases(p.phone_number)) setLabel(alias, label)
    const jidUser = p.participant_jid.split('@')[0]
    if (jidUser) setLabel(jidUser, label)
  }

  for (const [id, pushName] of senderNames) {
    if (!isUsableContactName(pushName) || isPhoneFormattedLabel(pushName)) continue
    const label = pushName.split(/\s+/)[0] ?? pushName
    setLabel(id, label)
    for (const alias of phoneLookupAliases(id)) setLabel(alias, label)
  }

  return map
}

/** Rótulo final da menção na bolha. */
export function resolveMentionChipLabel(id: string, mentionMap: Map<string, string>): string {
  const mapped = mentionMap.get(id)
  if (mapped) return mapped

  const digits = id.replace(/\D/g, '')
  const e164 = normalizePhone(id) ?? normalizePhone(digits)
  if (e164) {
    const byE164 = mentionMap.get(e164)
    if (byE164) return byE164
    for (const alias of phoneLookupAliases(e164)) {
      const hit = mentionMap.get(alias)
      if (hit) return hit
    }
    const formatted = formatPhoneDisplay(e164)
    if (formatted) return formatted
  }

  const short = id.split('@')[0] ?? id
  const fromShort = mentionMap.get(short)
  if (fromShort) return fromShort

  if (digits.length >= 8) return formatPhoneDisplay(digits) ?? short
  return short
}

/** Dígitos E.164 completos para menção na Evolution API (ex.: 5535988754584). */
export function mentionPhoneDigits(
  member: Pick<ResolvedParticipant, 'phone_number'>,
): string | null {
  return normalizePhone(member.phone_number)
}

/** Alvo da menção no texto/API: telefone E.164 ou @lid. */
function mentionApiTarget(
  phoneDigits: string | null,
  lid: string | null,
  token: string,
): { text: string; mentionedId: string | null } {
  if (phoneDigits) return { text: `@${phoneDigits}`, mentionedId: phoneDigits }
  if (lid) return { text: `@${lid}`, mentionedId: `${lid}@lid` }
  return { text: `@${token}`, mentionedId: null }
}

export interface SendMentionPayload {
  /** Texto para a Evolution API (@telefone/@lid). */
  text: string
  /** Texto legível para exibir no sistema (@Nome). */
  displayText: string
  mentioned: string[]
}

/** Resolve `@Nome` visível para `@telefone`/`@lid` (API) e mantém `@Nome` para exibição. */
export function buildSendMentionPayload(
  text: string,
  members: ResolvedParticipant[],
): SendMentionPayload {
  const mentioned: string[] = []
  let apiText = text
  let displayText = text

  const tokens = members.map((m) => ({
    token: mentionDisplayToken(m, members),
    label: mentionDisplayLabel(m, members),
    phoneDigits: mentionPhoneDigits(m),
    lid: m.lid_id,
  }))

  tokens.sort((a, b) => b.token.length - a.token.length)

  for (const { token, label, phoneDigits, lid } of tokens) {
    const re = new RegExp(`@${escapeRegex(token)}(?=\\s|$|[.,!?;:])`, 'gi')
    const { text: apiMention, mentionedId } = mentionApiTarget(phoneDigits, lid, token)
    const displayReplacement = `@${label}`

    apiText = apiText.replace(re, () => {
      if (mentionedId && !mentioned.includes(mentionedId)) mentioned.push(mentionedId)
      return apiMention
    })

    displayText = displayText.replace(re, displayReplacement)
  }

  return { text: apiText, displayText, mentioned }
}
