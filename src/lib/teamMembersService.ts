import { supabase } from './supabaseClient'
import type { TeamMember } from './database.types'

/** Slug do e-mail para nome de arquivo em public/team/ (ex.: gustavo@bpplaw.com.br → gustavo) */
export function getLocalAvatarSlug(email: string): string {
  return email.split('@')[0]?.replace(/\./g, '-') ?? ''
}

/** Caminho local da foto em public/team/ (ex.: /team/gustavo.jpg) */
export function getLocalAvatarPath(email: string, ext: 'jpg' | 'png' = 'jpg'): string {
  return `/team/${getLocalAvatarSlug(email)}.${ext}`
}

export const teamMembersService = {
  async list(): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('full_name', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}

/**
 * Nomes da planilha / texto antigo → e-mail no Supabase (para casar com team_members).
 * Use para import e para resolver gestor em exibição quando o campo ainda for texto.
 */
export const GESTOR_PLANILHA_TO_EMAIL: Record<string, string> = {
  GIAN: 'giancarlo@bpplaw.com.br',
  Giancarlo: 'giancarlo@bpplaw.com.br',
  LEONARDO: 'leonardo@bpplaw.com.br',
  Leonardo: 'leonardo@bpplaw.com.br',
  Gustavo: 'gustavo@bpplaw.com.br',
  Ricardo: 'ricardo@bpplaw.com.br',
  Gabriela: 'gabriela.consul@bpplaw.com.br',
  Daniel: 'daniel@bpplaw.com.br',
  Renato: 'renato@bpplaw.com.br',
  Michel: 'michel.malaquias@bpplaw.com.br',
  Emanueli: 'emanueli.lourenco@bpplaw.com.br',
  Ariany: 'ariany.bispo@bpplaw.com.br',
  Jorge: 'jorge@bpplaw.com.br',
  Ligia: 'ligia@bpplaw.com.br',
  Wagner: 'wagner.armani@bpplaw.com.br',
  Jansonn: 'jansonn@bpplaw.com.br',
  Henrique: 'henrique.nascimento@bpplaw.com.br',
  Felipe: 'felipe@bpplaw.com.br',
  'Lavínia': 'lavinia.ferraz@bpplaw.com.br',
  Lavinia: 'lavinia.ferraz@bpplaw.com.br',
  Francisco: 'francisco.zanin@bpplaw.com.br',
}

/** Para um e-mail, retorna todos os valores de gestor que devem ser considerados (e-mail + nomes da planilha). */
export function getGestorFilterValues(email: string): string[] {
  const values = [email]
  for (const [name, em] of Object.entries(GESTOR_PLANILHA_TO_EMAIL)) {
    if (em.toLowerCase() === email.toLowerCase()) values.push(name)
  }
  return values
}

/**
 * Resolve o texto do gestor (e-mail ou nome da planilha) para o TeamMember correspondente.
 */
export function resolveTeamMember(
  gestorText: string | null | undefined,
  teamMembers: TeamMember[]
): TeamMember | null {
  if (!gestorText?.trim() || !teamMembers.length) return null
  const t = gestorText.trim()
  const byEmail = teamMembers.find((m) => m.email.toLowerCase() === t.toLowerCase())
  if (byEmail) return byEmail
  const emailFromPlanilha = GESTOR_PLANILHA_TO_EMAIL[t] ?? GESTOR_PLANILHA_TO_EMAIL[t.split(' ')[0]]
  if (emailFromPlanilha) {
    const m = teamMembers.find((x) => x.email.toLowerCase() === emailFromPlanilha.toLowerCase())
    if (m) return m
  }
  const firstName = t.split(/\s+/)[0]?.toLowerCase()
  if (firstName) {
    const byFirstName = teamMembers.find(
      (m) => m.full_name.split(/\s+/)[0]?.toLowerCase() === firstName
    )
    if (byFirstName) return byFirstName
    const byNameContains = teamMembers.find((m) =>
      m.full_name.toLowerCase().includes(firstName)
    )
    if (byNameContains) return byNameContains
  }
  return null
}
