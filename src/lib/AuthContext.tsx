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

interface AuthState {
  user: User | null
  session: Session | null
  role: AppRole | null
  fullName: string | null
  area: string | null
  avatarUrl: string | null
  passwordChanged: boolean
  moduleAccess: ModuleKey[]
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  markPasswordChanged: () => void
}

type TeamMemberProfile = Pick<TeamMemberRow, 'id' | 'role' | 'full_name' | 'avatar_url' | 'is_active' | 'area'> & { password_changed?: boolean }

async function fetchTeamMemberRole(email: string): Promise<TeamMemberProfile | null> {
  const { data } = await supabase
    .from('team_members')
    .select('id, role, full_name, area, avatar_url, password_changed, is_active')
    .eq('email', email)
    .returns<TeamMemberProfile>()
    .single()

  return data
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    fullName: null,
    area: null,
    avatarUrl: null,
    passwordChanged: true,
    moduleAccess: [],
    loading: true,
  })

  const hydrateRole = useCallback(async (user: User | null, session: Session | null) => {
    if (!user?.email) {
      setState({ user: null, session: null, role: null, fullName: null, area: null, avatarUrl: null, passwordChanged: true, moduleAccess: [], loading: false })
      return
    }

    const member = await fetchTeamMemberRole(user.email)

    if (member && member.is_active === false) {
      await supabase.auth.signOut()
      setState({ user: null, session: null, role: null, fullName: null, area: null, avatarUrl: null, passwordChanged: true, moduleAccess: [], loading: false })
      return
    }

    const moduleAccess = member?.id ? await fetchModuleAccess(member.id) : []

    setState({
      user,
      session,
      role: (member?.role as AppRole) ?? null,
      fullName: member?.full_name ?? user.user_metadata?.full_name ?? null,
      area: member?.area ?? null,
      avatarUrl: member?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      passwordChanged: member?.password_changed ?? false,
      moduleAccess,
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
    setState({ user: null, session: null, role: null, fullName: null, area: null, avatarUrl: null, passwordChanged: true, moduleAccess: [], loading: false })
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
