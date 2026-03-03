/**
 * @deprecated Autenticação migrada para Supabase Auth (AuthContext.tsx).
 * Este arquivo será removido numa versão futura.
 */

const AUTH_STORAGE_KEY = 'crm_auth'

export function clearAuthenticated(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
