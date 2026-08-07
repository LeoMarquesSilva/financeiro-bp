import type { Colaborador, ColaboradorDivergencia } from '@/features/colaboradores/types'
import type { AppRole, TeamMember } from '@/lib/database.types'
import type { ModuleKey } from '@/lib/moduleAccess'

export type UsuariosTab = 'lista' | 'divergencias'

export interface AuthMeta {
  email: string
  has_auth: boolean
  last_sign_in_at: string | null
  created_at: string | null
  email_confirmed_at: string | null
}

/** Linha unificada: RH (colaborador) + acesso SIOE (team_member). */
export interface UsuarioListItem {
  key: string
  colaborador: Colaborador | null
  teamMember: TeamMember | null
  full_name: string
  email: string | null
  area: string
  avatar_url: string | null
  /** Status RH: ativo no ORQESTRAI / ex-colaborador / só SIOE */
  rhStatus: 'ativo' | 'ex_colaborador' | 'somente_sioe'
}

export interface AcessoDraft {
  email: string
  role: AppRole | null
  modules: ModuleKey[]
  is_active: boolean
}

export type { Colaborador, ColaboradorDivergencia, TeamMember, AppRole, ModuleKey }
