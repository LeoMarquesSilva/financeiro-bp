import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { AppRole, TeamMemberRow } from './database.types'
import type { ModuleKey } from './moduleAccess'
import type { ColaboradorNivelHierarquico } from '@/features/colaboradores/types'

interface AuthState {
  user: User | null
  session: Session | null
  role: AppRole | null
  fullName: string | null
  area: string | null
  avatarUrl: string | null
  passwordChanged: boolean
  moduleAccess: ModuleKey[]
  /** Nível RH (`colaboradores`), quando vinculado ao team_member / e-mail. */
  nivelHierarquico: ColaboradorNivelHierarquico | null
  /** Área canônica do colaborador no RH (pode diferir de `area` do cadastro SIOE em Usuários). */
  colaboradorArea: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  markPasswordChanged: () => void
}

type TeamMemberProfile = Pick<
  TeamMemberRow,
  'id' | 'role' | 'full_name' | 'avatar_url' | 'is_active' | 'area' | 'colaborador_id'
> & { password_changed?: boolean }

type ColaboradorPerfil = {
  nivel_hierarquico: ColaboradorNivelHierarquico
  area: string
}

async function fetchTeamMemberRole(email: string): Promise<TeamMemberProfile | null> {
  const { data } = await supabase
    .from('team_members')
    .select('id, role, full_name, area, avatar_url, password_changed, is_active, colaborador_id')
    .eq('email', email)
    .returns<TeamMemberProfile>()
    .single()

  return data
}

async function fetchColaboradorPerfil(
  colaboradorId: string | null | undefined,
  email: string,
): Promise<ColaboradorPerfil | null> {
  if (colaboradorId) {
    const { data } = await supabase
      .from('colaboradores' as never)
      .select('nivel_hierarquico, area')
      .eq('id', colaboradorId)
      .maybeSingle()
    if (data) return data as unknown as ColaboradorPerfil
  }

  // Fallback: match por local-part (domínio bpplaw ↔ bismarchipires).
  const local = email.trim().toLowerCase().split('@')[0]
  if (!local) return null
  const { data } = await supabase
    .from('colaboradores' as never)
    .select('nivel_hierarquico, area, email')
    .ilike('email', `${local}@%`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as unknown as ColaboradorPerfil
  return { nivel_hierarquico: row.nivel_hierarquico, area: row.area }
}

/**
 * team_member_module_access ainda não está em database.types.ts (tabela nova da Fase 2,
 * ver 20260806260000_team_members_colaborador_e_acesso_modulo.sql) — mesmo padrão `as never`
 * usado em colaboradoresService.ts para tabelas fora do schema gerado.
 */
async function fetchModuleAccess(teamMemberId: string): Promise<ModuleKey[]> {
  const { data } = await supabase
    .from('team_member_module_access' as never)
    .select('module_key')
    .eq('team_member_id', teamMemberId)
  return ((data ?? []) as unknown as { module_key: ModuleKey }[]).map((r) => r.module_key)
}

function emptyAuthState(): AuthState {
  return {
    user: null,
    session: null,
    role: null,
    fullName: null,
    area: null,
    avatarUrl: null,
    passwordChanged: true,
    moduleAccess: [],
    nivelHierarquico: null,
    colaboradorArea: null,
    loading: false,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...emptyAuthState(),
    loading: true,
  })

  const hydrateRole = useCallback(async (user: User | null, session: Session | null) => {
    if (!user?.email) {
      setState(emptyAuthState())
      return
    }

    const member = await fetchTeamMemberRole(user.email)

    if (member && member.is_active === false) {
      await supabase.auth.signOut()
      setState(emptyAuthState())
      return
    }

    const [moduleAccess, colaborador] = await Promise.all([
      member?.id ? fetchModuleAccess(member.id) : Promise.resolve([] as ModuleKey[]),
      fetchColaboradorPerfil(member?.colaborador_id, user.email),
    ])

    setState({
      user,
      session,
      role: (member?.role as AppRole) ?? null,
      fullName: member?.full_name ?? user.user_metadata?.full_name ?? null,
      area: member?.area ?? null,
      avatarUrl: member?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      passwordChanged: member?.password_changed ?? false,
      moduleAccess,
      nivelHierarquico: colaborador?.nivel_hierarquico ?? null,
      colaboradorArea: colaborador?.area ?? null,
      loading: false,
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session ?? null
      hydrateRole(session?.user ?? null, session)
    })

    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        hydrateRole(session?.user ?? null, session)
      },
    )
    
    const subscription = data?.subscription

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [hydrateRole])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('crm_auth')
    setState(emptyAuthState())
  }, [])

  const markPasswordChanged = useCallback(() => {
    setState((s) => ({ ...s, passwordChanged: true }))
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signOut, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
