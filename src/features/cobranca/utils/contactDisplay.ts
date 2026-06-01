import { isInternalContactName } from './contactNames'

/** Nome inválido: só dígitos (ID @lid do WhatsApp). */
export function isNumericContactName(name: string | null | undefined): boolean {
  return /^\d+$/.test((name ?? '').trim())
}

/** Rótulos genéricos do próprio perfil — não identificam o contato. */
export function isWeakPushName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase()
  return n === 'você' || n === 'voce' || n === 'you'
}

/** Nome utilizável para exibir contato. */
export function isUsableContactName(name: string | null | undefined): boolean {
  const raw = (name ?? '').trim()
  if (!raw) return false
  if (isNumericContactName(raw)) return false
  if (isWeakPushName(raw)) return false
  if (isInternalContactName(raw)) return false
  return true
}
