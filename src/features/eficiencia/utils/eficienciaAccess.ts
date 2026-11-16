import type { AppRole } from '@/lib/database.types'
import type { ColaboradorNivelHierarquico } from '@/features/colaboradores/types'
import { isEficienciaSomenteArea, isEficienciaSomenteProtocolos } from '@/lib/moduleAccess'
import { AREAS_EFICIENCIA, EFICIENCIA_AREA_OPS_LEGAIS } from '../constants'

export type EficienciaAccessProfile = 'admin' | 'socio_area' | 'coordenador' | 'somente_area'

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
  /** Overview também travado na área (sem “Todas as áreas”). */
  overviewSomenteArea: boolean
}

type ResolveInput = {
  role: AppRole | null
  email: string | null | undefined
  teamMemberArea: string | null | undefined
  nivelHierarquico: ColaboradorNivelHierarquico | null | undefined
  colaboradorArea: string | null | undefined
  moduleAccess?: readonly string[]
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
  // Maria Heloiza (Ops Legais) usa o módulo próprio `/operacoes-legais` — não trava Eficiência.
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

/**
 * Área do jurídico usada para travar o dashboard da pessoa.
 * Ordem: lista de coordenadores por e-mail → área do colaborador (RH) → área do usuário.
 * Operações Legais volta null (tem dashboard próprio).
 */
export function resolveAreaEficienciaPessoa(input: {
  email: string | null | undefined
  colaboradorArea: string | null | undefined
  teamMemberArea: string | null | undefined
}): string | null {
  return resolveLockedArea(input)
}

function resolveLockedArea(
  input: Pick<ResolveInput, 'email' | 'colaboradorArea' | 'teamMemberArea'>,
): string | null {
  const local = emailLocalPart(input.email)
  const fromEmail =
    local && COORDENADORES_EFICIENCIA_POR_EMAIL[local]
      ? COORDENADORES_EFICIENCIA_POR_EMAIL[local]
      : null
  const area =
    fromEmail ??
    normalizeAreaEficiencia(input.colaboradorArea) ??
    normalizeAreaEficiencia(input.teamMemberArea)
  // Operações Legais tem dashboard próprio — não trava o slicer jurídico nela.
  if (area === EFICIENCIA_AREA_OPS_LEGAIS) return null
  return area
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
 * - Coordenador: Overview com “Todas as áreas” + área dele; abas de detalhe
 *   só da própria área; sem ações admin.
 * - Somente área: todas as abas e o Overview, travados na área da pessoa.
 * - Somente protocolos: indicadores de protocolo, travados na área da pessoa.
 */
export function resolveEficienciaAccess(input: ResolveInput): EficienciaAccess {
  if (
    isEficienciaSomenteProtocolos(input.role, input.moduleAccess ?? [])
  ) {
    return {
      profile: 'coordenador',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: false,
      canFilterAreas: false,
      lockedArea: resolveLockedArea(input),
      overviewSomenteArea: true,
    }
  }

  if (isEficienciaSomenteArea(input.role, input.moduleAccess ?? [])) {
    return {
      profile: 'somente_area',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: true,
      canFilterAreas: false,
      lockedArea: resolveLockedArea(input),
      overviewSomenteArea: true,
    }
  }

  if (input.role === 'admin') {
    return {
      profile: 'admin',
      canUseIndicadoresAdmin: true,
      canSeeAllTabs: true,
      canFilterAreas: true,
      lockedArea: null,
      overviewSomenteArea: false,
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
      overviewSomenteArea: false,
    }
  }

  // Sócio / gerente de área (e demais com moduleAccess eficiência): visão completa sem ações admin.
  return {
    profile: 'socio_area',
    canUseIndicadoresAdmin: false,
    canSeeAllTabs: true,
    canFilterAreas: true,
    lockedArea: null,
    overviewSomenteArea: false,
  }
}
