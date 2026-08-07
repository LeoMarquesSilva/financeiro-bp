import type { AppRole } from '@/lib/database.types'
import type { ColaboradorNivelHierarquico } from '@/features/colaboradores/types'
import { AREAS_EFICIENCIA } from '../constants'

export type EficienciaAccessProfile = 'admin' | 'socio_area' | 'coordenador'

export type EficienciaAccess = {
  profile: EficienciaAccessProfile
  /** Indicadores Resultado + Amostra Chamados — só admin. */
  canUseIndicadoresAdmin: boolean
  /** Abas além do Overview. */
  canSeeAllTabs: boolean
  /** Pode escolher “Todas as áreas” e outras áreas. */
  canFilterAreas: boolean
  /** Área fixa do coordenador (canônica Eficiência), ou null. */
  lockedArea: string | null
}

type ResolveInput = {
  role: AppRole | null
  email: string | null | undefined
  teamMemberArea: string | null | undefined
  nivelHierarquico: ColaboradorNivelHierarquico | null | undefined
  colaboradorArea: string | null | undefined
}

/**
 * Coordenadores do Overview (lista explícita — alguns ainda constam como
 * “colaborador” no ORQESTRAI porque o cargo não é “Coordenador”).
 * Chave = local-part do e-mail (domínio bpplaw / bismarchipires pode variar).
 */
const COORDENADORES_EFICIENCIA_POR_EMAIL: Record<string, string> = {
  'ana.tavares': 'Reestruturação',
  ligia: 'Reestruturação',
  'lavinia.ferraz': 'Reestruturação',
  'caroline.thome': 'Cível',
  carolineabdalla: 'Trabalhista',
  'henrique.nascimento': 'Contratos',
  mariaponce: 'Operações Legais',
}

const AREAS_SET = new Set<string>(AREAS_EFICIENCIA)

const AREA_ALIASES: Record<string, string> = {
  Insolvência: 'Reestruturação',
  Insolvencia: 'Reestruturação',
}

function emailLocalPart(email: string | null | undefined): string | null {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null
  return normalized.split('@')[0] || null
}

/** Normaliza área do RH/Usuários para o nome canônico de `AREAS_EFICIENCIA`. */
export function normalizeAreaEficiencia(area: string | null | undefined): string | null {
  const trimmed = (area ?? '').trim()
  if (!trimmed) return null
  const aliased = AREA_ALIASES[trimmed] ?? trimmed
  return AREAS_SET.has(aliased) ? aliased : null
}

function resolveLockedArea(input: ResolveInput): string | null {
  const local = emailLocalPart(input.email)
  if (local && COORDENADORES_EFICIENCIA_POR_EMAIL[local]) {
    return COORDENADORES_EFICIENCIA_POR_EMAIL[local]
  }
  return (
    normalizeAreaEficiencia(input.colaboradorArea) ??
    normalizeAreaEficiencia(input.teamMemberArea)
  )
}

function isCoordenadorLista(email: string | null | undefined): boolean {
  const local = emailLocalPart(email)
  return local != null && local in COORDENADORES_EFICIENCIA_POR_EMAIL
}

/** Identifica coordenador para ACL / badge em Usuários. */
export function isCoordenadorUsuario(input: {
  role?: AppRole | null
  email?: string | null
  nivelHierarquico?: ColaboradorNivelHierarquico | null
}): boolean {
  if (input.role === 'coordenador') return true
  if (input.nivelHierarquico === 'coordenador') return true
  return isCoordenadorLista(input.email)
}

/**
 * Perfil de visão do dashboard Eficiência Operacional.
 *
 * - Admin: tudo (abas, áreas, Indicadores Resultado / Amostra Chamados).
 * - Sócio de área (sócio/gerente RH): todas as abas e áreas; sem ações admin.
 * - Coordenador: todas as abas, mas só a própria área; sem ações admin.
 */
export function resolveEficienciaAccess(input: ResolveInput): EficienciaAccess {
  if (input.role === 'admin') {
    return {
      profile: 'admin',
      canUseIndicadoresAdmin: true,
      canSeeAllTabs: true,
      canFilterAreas: true,
      lockedArea: null,
    }
  }

  const coordenador =
    input.role === 'coordenador' ||
    isCoordenadorLista(input.email) ||
    input.nivelHierarquico === 'coordenador'

  if (coordenador) {
    return {
      profile: 'coordenador',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: true,
      canFilterAreas: false,
      lockedArea: resolveLockedArea(input),
    }
  }

  // Sócio / gerente de área (e demais com moduleAccess eficiência): visão completa sem ações admin.
  return {
    profile: 'socio_area',
    canUseIndicadoresAdmin: false,
    canSeeAllTabs: true,
    canFilterAreas: true,
    lockedArea: null,
  }
}
