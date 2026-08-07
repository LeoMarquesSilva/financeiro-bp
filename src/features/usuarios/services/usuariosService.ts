import { supabase } from '@/lib/supabaseClient'
import {
  teamMembersService,
  teamMemberModuleAccessService,
  type CreateTeamMemberInput,
} from '@/lib/teamMembersService'
import type { TeamMember } from '@/lib/database.types'
import type { Colaborador } from '@/features/colaboradores/types'
import type { AuthMeta, UsuarioListItem } from '../types'
import { normalizeAreaUsuarios } from '../utils/areaFiltro'

export const USUARIOS_DEFAULT_PASSWORD = '123456'

function normEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/** Local-part do e-mail (antes do @) — bpplaw e bismarchipires são a mesma pessoa. */
function emailLocalPart(email: string | null | undefined): string | null {
  const normalized = normEmail(email)
  if (!normalized || !normalized.includes('@')) return null
  return normalized.split('@')[0] || null
}

/** Resolve team_member de um colaborador por FK, e-mail completo ou local-part. */
export function findTeamMemberForColaborador(
  colaborador: Colaborador,
  teamMembers: TeamMember[],
): TeamMember | null {
  const byFk = teamMembers.find((m) => m.colaborador_id === colaborador.id)
  if (byFk) return byFk

  const email = normEmail(colaborador.email)
  if (email) {
    const byEmail = teamMembers.find((m) => normEmail(m.email) === email)
    if (byEmail) return byEmail
  }

  const local = emailLocalPart(colaborador.email)
  if (!local) return null
  return (
    teamMembers.find((m) => emailLocalPart(m.email) === local) ?? null
  )
}

/**
 * Lista unificada: todos os colaboradores + team_members órfãos (sem match RH),
 * para não esconder gestores já cadastrados no SIOE.
 *
 * Match RH↔SIOE: colaborador_id, e-mail completo ou local-part (domínio pode
 * diferir: @bpplaw.com.br ↔ @bismarchipires.com.br).
 */
export function buildUsuarioList(
  colaboradores: Colaborador[],
  teamMembers: TeamMember[],
): UsuarioListItem[] {
  const usedMemberIds = new Set<string>()
  const rows: UsuarioListItem[] = []

  for (const c of colaboradores) {
    const tm = findTeamMemberForColaborador(c, teamMembers)
    if (tm) usedMemberIds.add(tm.id)
    rows.push({
      key: `c:${c.id}`,
      colaborador: c,
      teamMember: tm,
      full_name: c.full_name,
      // Preferir e-mail SIOE (login Auth) quando houver — domínio pode diferir do RH.
      email: tm?.email ?? c.email ?? null,
      // Preferir área do RH; normaliza legado SIOE (ex.: "Coordenadora Financeiro").
      area: normalizeAreaUsuarios(c.area || tm?.area || '—') || '—',
      avatar_url: c.avatar_url || tm?.avatar_url || null,
      rhStatus: c.is_active ? 'ativo' : 'ex_colaborador',
    })
  }

  for (const tm of teamMembers) {
    if (usedMemberIds.has(tm.id)) continue
    rows.push({
      key: `tm:${tm.id}`,
      colaborador: null,
      teamMember: tm,
      full_name: tm.full_name,
      email: tm.email,
      area: normalizeAreaUsuarios(tm.area) || '—',
      avatar_url: tm.avatar_url,
      rhStatus: 'somente_sioe',
    })
  }

  rows.sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'))
  return rows
}

export const usuariosAccessService = {
  async listAuthMeta(emails: string[]): Promise<AuthMeta[]> {
    const cleaned = [...new Set(emails.map(normEmail).filter(Boolean))]
    if (cleaned.length === 0) return []
    try {
      const { data, error } = await supabase.rpc('admin_list_auth_meta' as never, {
        p_emails: cleaned,
      } as never)
      if (error) {
        console.warn('[usuarios] admin_list_auth_meta:', error.message)
        return cleaned.map((email) => ({
          email,
          has_auth: false,
          last_sign_in_at: null,
          created_at: null,
          email_confirmed_at: null,
        }))
      }
      return ((data ?? []) as AuthMeta[]).map((row) => ({
        email: normEmail(row.email),
        has_auth: Boolean(row.has_auth),
        last_sign_in_at: row.last_sign_in_at ?? null,
        created_at: row.created_at ?? null,
        email_confirmed_at: row.email_confirmed_at ?? null,
      }))
    } catch (err) {
      console.warn('[usuarios] admin_list_auth_meta failed', err)
      return cleaned.map((email) => ({
        email,
        has_auth: false,
        last_sign_in_at: null,
        created_at: null,
        email_confirmed_at: null,
      }))
    }
  },

  async ensureAuthLogin(input: {
    email: string
    full_name?: string | null
    avatar_url?: string | null
  }): Promise<{ ok: boolean; action?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('admin-provision-acesso', {
      body: input,
    })
    if (error) throw error
    if (data?.error) throw new Error(String(data.error))
    return data as { ok: boolean; action?: string }
  },

  async resetPassword(email: string): Promise<{ success?: boolean; default_password?: string; error?: string }> {
    const { data, error } = await supabase.rpc('admin_reset_password_padrao' as never, {
      p_email: email.trim().toLowerCase(),
    } as never)
    if (error) throw error
    const result = (data ?? {}) as { success?: boolean; default_password?: string; error?: string }
    if (result.error) throw new Error(result.error)
    return result
  },

  /**
   * Garante team_members vinculado ao colaborador (ou cria a partir do e-mail),
   * sem sobrescrever role existente se já houver linha.
   */
  async ensureTeamMemberFromUsuario(input: {
    colaborador: Colaborador | null
    teamMember: TeamMember | null
    email: string
    full_name: string
    area: string
    avatar_url?: string | null
  }): Promise<TeamMember> {
    if (input.teamMember) {
      if (input.colaborador && !input.teamMember.colaborador_id) {
        await teamMembersService.updateColaborador(input.teamMember.id, input.colaborador.id)
        return { ...input.teamMember, colaborador_id: input.colaborador.id }
      }
      return input.teamMember
    }

    const createInput: CreateTeamMemberInput = {
      email: input.email,
      full_name: input.full_name,
      area: input.area,
      avatar_url: input.avatar_url ?? null,
      role: null,
      colaborador_id: input.colaborador?.id ?? null,
    }
    return teamMembersService.create(createInput)
  },
}

export { teamMembersService, teamMemberModuleAccessService }
