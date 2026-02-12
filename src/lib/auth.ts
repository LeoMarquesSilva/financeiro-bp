const AUTH_STORAGE_KEY = 'crm_auth'

/** Usuário esperado: variável de ambiente ou padrão "gestor". */
export function getExpectedLogin(): string {
  return (import.meta.env.VITE_CRM_LOGIN_USER as string) || 'gestor'
}

/** Senha esperada: variável de ambiente ou padrão "gestor123". */
export function getExpectedPassword(): string {
  return (import.meta.env.VITE_CRM_LOGIN_PASSWORD as string) || 'gestor123'
}

export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_STORAGE_KEY) === '1'
}

export function setAuthenticated(): void {
  localStorage.setItem(AUTH_STORAGE_KEY, '1')
}

export function clearAuthenticated(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
