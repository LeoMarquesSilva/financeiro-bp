import { supabase } from './supabaseClient'
import type { TeamMember, AppRole } from './database.types'

/** Slug do e-mail para nome de arquivo em public/team/ (ex.: gustavo@bismarchipires.com.br → gustavo) */
export function getLocalAvatarSlug(email: string): string {
  return email.split('@')[0]?.replace(/\./g, '-') ?? ''
}

/** Caminho local da foto em public/team/ (ex.: /team/gustavo.jpg) */
export function getLocalAvatarPath(email: string, ext: 'jpg' | 'png' = 'jpg'): string {
  return `/team/${getLocalAvatarSlug(email)}.${ext}`
}

export interface CreateTeamMemberInput {
  email: string
  full_name: string
  area: string
  avatar_url?: string | null
  role?: AppRole | null
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

  async create(input: CreateTeamMemberInput): Promise<TeamMember> {
    const insertData = {
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      area: input.area.trim(),
      avatar_url: input.avatar_url?.trim() || null,
      role: input.role ?? null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase client infers Insert as never for some schemas
    const { data, error } = await supabase.from('team_members').insert(insertData as any).select().single()
    if (error) throw error
    return data
  },

  async updateRole(id: string, role: AppRole | null): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .update({ role, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('team_members').delete().eq('id', id)
    if (error) throw error
  },
}

/**
 * Nomes da planilha / texto antigo → e-mail no Supabase (para casar com team_members).
 * Use para import e para resolver gestor em exibição quando o campo ainda for texto.
 */
export const GESTOR_PLANILHA_TO_EMAIL: Record<string, string> = {
  GIAN: 'giancarlo@bismarchipires.com.br',
  Giancarlo: 'giancarlo@bismarchipires.com.br',
  LEONARDO: 'leonardo@bismarchipires.com.br',
  Leonardo: 'leonardo@bismarchipires.com.br',
  Gustavo: 'gustavo@bismarchipires.com.br',
  Ricardo: 'ricardo@bismarchipires.com.br',
  Gabriela: 'gabriela.consul@bismarchipires.com.br',
  Daniel: 'daniel@bismarchipires.com.br',
  Renato: 'renato@bismarchipires.com.br',
  Michel: 'michel.malaquias@bismarchipires.com.br',
  Emanueli: 'emanueli.lourenco@bismarchipires.com.br',
  Ariany: 'ariany.bispo@bismarchipires.com.br',
  Jorge: 'jorge@bismarchipires.com.br',
  Ligia: 'ligia@bismarchipires.com.br',
  Wagner: 'wagner.armani@bismarchipires.com.br',
  Jansonn: 'jansonn@bismarchipires.com.br',
  Henrique: 'henrique.nascimento@bismarchipires.com.br',
  Felipe: 'felipe@bismarchipires.com.br',
  'Lavínia': 'lavinia.ferraz@bismarchipires.com.br',
  Lavinia: 'lavinia.ferraz@bismarchipires.com.br',
  Francisco: 'francisco.zanin@bismarchipires.com.br',
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
