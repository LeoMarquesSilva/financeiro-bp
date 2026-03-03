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

interface AuthState {
  user: User | null
  session: Session | null
  role: AppRole | null
  fullName: string | null
  avatarUrl: string | null
  passwordChanged: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  markPasswordChanged: () => void
}

type TeamMemberProfile = Pick<TeamMemberRow, 'role' | 'full_name' | 'avatar_url'> & { password_changed?: boolean }

async function fetchTeamMemberRole(email: string): Promise<TeamMemberProfile | null> {
  const { data } = await supabase
    .from('team_members')
    .select('role, full_name, avatar_url, password_changed')
    .eq('email', email)
    .returns<TeamMemberProfile>()
    .single()

  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    fullName: null,
    avatarUrl: null,
    passwordChanged: true,
    loading: true,
  })

  const hydrateRole = useCallback(async (user: User | null, session: Session | null) => {
    if (!user?.email) {
      setState({ user: null, session: null, role: null, fullName: null, avatarUrl: null, passwordChanged: true, loading: false })
      return
    }

    const member = await fetchTeamMemberRole(user.email)

    setState({
      user,
      session,
      role: (member?.role as AppRole) ?? null,
      fullName: member?.full_name ?? user.user_metadata?.full_name ?? null,
      avatarUrl: member?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      passwordChanged: member?.password_changed ?? false,
      loading: false,
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateRole(session?.user ?? null, session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        hydrateRole(session?.user ?? null, session)
      },
    )

    return () => subscription.unsubscribe()
  }, [hydrateRole])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('crm_auth')
    setState({ user: null, session: null, role: null, fullName: null, avatarUrl: null, passwordChanged: true, loading: false })
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
