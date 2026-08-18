import { supabase } from './supabaseClient'

export type LoginBlockReason = 'ex_colaborador' | 'conta_inativa'

type TeamMemberLoginRow = {
  is_active: boolean
  colaborador_id: string | null
}

type ColaboradorLoginRow = {
  id: string
  is_active: boolean
  email: string | null
}

function emailLocalPart(email: string): string {
  return email.trim().toLowerCase().split('@')[0] ?? ''
}

async function findColaboradorForLogin(
  email: string,
  colaboradorId: string | null | undefined,
): Promise<ColaboradorLoginRow | null> {
  if (colaboradorId) {
    const { data } = await supabase
      .from('colaboradores' as never)
      .select('id, is_active, email')
      .eq('id', colaboradorId)
      .maybeSingle()
    if (data) return data as unknown as ColaboradorLoginRow
  }

  const local = emailLocalPart(email)
  if (!local) return null

  const { data } = await supabase
    .from('colaboradores' as never)
    .select('id, is_active, email')
    .ilike('email', `${local}@%`)
    .limit(5)

  const rows = (data ?? []) as unknown as ColaboradorLoginRow[]
  const normalized = email.trim().toLowerCase()
  return (
    rows.find((c) => (c.email ?? '').trim().toLowerCase() === normalized) ??
    rows[0] ??
    null
  )
}

/**
 * Motivo para recusar o acesso: ex-colaborador no RH ou conta SIOE desativada.
 * Usado no login e no hydrate da sessão.
 */
export async function resolveLoginBlockReason(
  email: string,
): Promise<LoginBlockReason | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const { data: member } = await supabase
    .from('team_members')
    .select('is_active, colaborador_id')
    .eq('email', normalized)
    .maybeSingle()

  const teamMember = member as TeamMemberLoginRow | null
  const colaborador = await findColaboradorForLogin(
    normalized,
    teamMember?.colaborador_id,
  )

  if (colaborador && colaborador.is_active === false) return 'ex_colaborador'
  if (teamMember && teamMember.is_active === false) return 'conta_inativa'
  return null
}

export function loginBlockMessage(reason: LoginBlockReason): string {
  if (reason === 'ex_colaborador') {
    return 'Acesso desativado: este usuário é ex-colaborador.'
  }
  return 'Sua conta está desativada. Procure o administrador.'
}
