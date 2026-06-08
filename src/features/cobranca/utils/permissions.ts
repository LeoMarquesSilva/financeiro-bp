import type { AppRole } from '@/lib/database.types'

/** Financeiro sem permissão de arquivar títulos no painel de cobrança. */
const COBRANCA_ARQUIVAR_EMAILS_BLOQUEADOS = new Set(['graziane.brito@bismarchipires.com.br'])

export function canArquivarCobranca(role: AppRole | null, email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase()
  if (normalized && COBRANCA_ARQUIVAR_EMAILS_BLOQUEADOS.has(normalized)) {
    return false
  }
  return role === 'admin' || role === 'financeiro'
}
