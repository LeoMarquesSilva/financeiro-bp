/**
 * Avatares e dados de exibição da equipe (gestores).
 * Fotos hospedadas em https://www.bismarchipires.com.br/img/team/ ou URL completa.
 * E-mails @bismarchipires.com.br são normalizados para @bpplaw.com.br na busca.
 */

const BASE_URL = 'https://www.bismarchipires.com.br/img/team'

export interface TeamMemberAvatar {
  avatar: string
  tag: string
  name: string
}

/** Chave = e-mail @bpplaw; avatar = URL completa (BASE_URL + path ou URL absoluta) */
export const TEAM_BY_EMAIL: Record<string, TeamMemberAvatar> = {
  // Sócio
  'gustavo@bpplaw.com.br': {
    avatar: `${BASE_URL}/socios/gustavo-site.png`,
    tag: 'Sócio',
    name: 'Gustavo Bismarchi',
  },
  'ricardo@bpplaw.com.br': {
    avatar: `${BASE_URL}/socios/ricardo-pires.jpg`,
    tag: 'Sócio',
    name: 'Ricardo Viscardi Pires',
  },
  // Cível
  'gabriela.consul@bpplaw.com.br': {
    avatar: `${BASE_URL}/civel/gabriela-consul.jpg`,
    tag: 'Cível',
    name: 'Gabriela Consul',
  },
  'giancarlo@bpplaw.com.br': {
    avatar: `${BASE_URL}/civel/giancarlo.jpg`,
    tag: 'Cível',
    name: 'Giancarlo Zotini',
  },
  // Trabalhista
  'daniel@bpplaw.com.br': {
    avatar: `${BASE_URL}/trabalhista/daniel-pressato-fernandes.jpg`,
    tag: 'Trabalhista',
    name: 'Daniel Pressatto Fernandes',
  },
  'renato@bpplaw.com.br': {
    avatar: `${BASE_URL}/trabalhista/renato-rossetti.jpg`,
    tag: 'Trabalhista',
    name: 'Renato Vallim',
  },
  // Distressed Deals
  'michel.malaquias@bpplaw.com.br': {
    avatar: `${BASE_URL}/distressed-deals/michel.jpg`,
    tag: 'Distressed Deals',
    name: 'Michel Malaquias',
  },
  'emanueli.lourenco@bpplaw.com.br': {
    avatar: `${BASE_URL}/distressed-deals/emanueli-lourenco.png`,
    tag: 'Distressed Deals',
    name: 'Emanueli Lourenço',
  },
  'ariany.bispo@bpplaw.com.br': {
    avatar: `${BASE_URL}/distressed-deals/ariany-bispo.png`,
    tag: 'Distressed Deals',
    name: 'Ariany Bispo',
  },
  // Reestruturação
  'jorge@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jorge-pecht-souza.jpg`,
    tag: 'Reestruturação',
    name: 'Jorge Pecht Souza',
  },
  'leonardo@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/leo-loureiro.png`,
    tag: 'Reestruturação',
    name: 'Leonardo Loureiro Basso',
  },
  'ligia@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/ligia-gilberti-lopes.jpg`,
    tag: 'Reestruturação',
    name: 'Ligia Lopes',
  },
  'wagner.armani@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/wagner.jpg`,
    tag: 'Societário e Contratos',
    name: 'Wagner Armani',
  },
  'jansonn@bpplaw.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jansonn.jpg`,
    tag: 'Societário e Contratos',
    name: 'Jansonn Mendonça Batista',
  },
  'henrique.nascimento@bpplaw.com.br': {
    avatar: 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/02/Henrique-Franco-Nascimento.jpeg',
    tag: 'Societário e Contratos',
    name: 'Henrique Franco Nascimento',
  },
  // Operações Legais
  'felipe@bpplaw.com.br': {
    avatar: `${BASE_URL}/legal-ops/felipe-carmargo.jpg`,
    tag: 'Operações Legais',
    name: 'Felipe Camargo',
  },
  'lavinia.ferraz@bpplaw.com.br': {
    avatar: `${BASE_URL}/legal-ops/lavinia-ferraz-crispim.jpg`,
    tag: 'Operações Legais',
    name: 'Lavínia Ferraz Crispim',
  },
  // Tributário
  'francisco.zanin@bpplaw.com.br': {
    avatar: 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/01/Captura-de-tela-2026-01-27-180946.png',
    tag: 'Tributário',
    name: 'Francisco Zanin',
  },
}

/**
 * Normaliza e-mail para lookup: @bismarchipires.com.br → @bpplaw.com.br
 */
export function normalizeEmailForLookup(email: string): string {
  if (!email || typeof email !== 'string') return ''
  const trimmed = email.trim().toLowerCase()
  if (trimmed.endsWith('@bismarchipires.com.br')) {
    return trimmed.replace('@bismarchipires.com.br', '@bpplaw.com.br')
  }
  return trimmed
}

/**
 * Retorna { avatar, tag, name } para um e-mail (com normalização).
 */
export function getTeamMember(email: string | null | undefined): TeamMemberAvatar | null {
  const key = normalizeEmailForLookup(email ?? '')
  return key ? TEAM_BY_EMAIL[key] ?? null : null
}

/**
 * Lista todas as pessoas para dropdown/select: { value: email, label, avatar, tag }.
 */
export function getSolicitanteOptions(): Array<{
  value: string
  label: string
  avatar: string
  tag: string
  name: string
}> {
  return Object.entries(TEAM_BY_EMAIL).map(([email, m]) => ({
    value: email,
    label: `${m.name} (${m.tag})`,
    avatar: m.avatar,
    tag: m.tag,
    name: m.name,
  }))
}

/**
 * Retorna a área (tag) da pessoa.
 */
export function getAreaByEmail(email: string | null | undefined): string | null {
  const m = getTeamMember(email)
  return m?.tag ?? null
}

/**
 * Retorna a chave normalizada para agrupamento (e-mail @bpplaw).
 */
export function getSolicitanteKey(email: string | null | undefined): string {
  return normalizeEmailForLookup(email ?? '')
}
