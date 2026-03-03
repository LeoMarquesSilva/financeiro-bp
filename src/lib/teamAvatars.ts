/**
 * Avatares e dados de exibição da equipe (gestores).
 * Fotos hospedadas em https://www.bismarchipires.com.br/img/team/ ou URL completa.
 * E-mails padronizados como @bismarchipires.com.br.
 */

const BASE_URL = 'https://www.bismarchipires.com.br/img/team'

export interface TeamMemberAvatar {
  avatar: string
  tag: string
  name: string
}

/** Chave = e-mail @bismarchipires; avatar = URL completa (BASE_URL + path ou URL absoluta) */
export const TEAM_BY_EMAIL: Record<string, TeamMemberAvatar> = {
  // Sócio
  'gustavo@bismarchipires.com.br': {
    avatar: `${BASE_URL}/socios/gustavo-site.png`,
    tag: 'Sócio',
    name: 'Gustavo Bismarchi',
  },
  'ricardo@bismarchipires.com.br': {
    avatar: `${BASE_URL}/ricardo-pires.jpg`,
    tag: 'Sócio',
    name: 'Ricardo Viscardi Pires',
  },
  // Cível
  'gabriela.consul@bismarchipires.com.br': {
    avatar: `${BASE_URL}/civel/gabriela-consul.jpg`,
    tag: 'Cível',
    name: 'Gabriela Consul',
  },
  'giancarlo@bismarchipires.com.br': {
    avatar: `${BASE_URL}/civel/giancarlo.jpg`,
    tag: 'Cível',
    name: 'Giancarlo Zotini',
  },
  // Trabalhista
  'daniel@bismarchipires.com.br': {
    avatar: `${BASE_URL}/trabalhista/daniel-pressato-fernandes.jpg`,
    tag: 'Trabalhista',
    name: 'Daniel Pressatto Fernandes',
  },
  'renato@bismarchipires.com.br': {
    avatar: `${BASE_URL}/trabalhista/renato-rossetti.jpg`,
    tag: 'Trabalhista',
    name: 'Renato Vallim',
  },
  // Distressed Deals
  'michel.malaquias@bismarchipires.com.br': {
    avatar: `${BASE_URL}/distressed-deals/michel.jpg`,
    tag: 'Distressed Deals',
    name: 'Michel Malaquias',
  },
  'emanueli.lourenco@bismarchipires.com.br': {
    avatar: `${BASE_URL}/distressed-deals/emanueli-lourenco.png`,
    tag: 'Distressed Deals',
    name: 'Emanueli Lourenço',
  },
  'ariany.bispo@bismarchipires.com.br': {
    avatar: `${BASE_URL}/distressed-deals/ariany-bispo.png`,
    tag: 'Distressed Deals',
    name: 'Ariany Bispo',
  },
  // Reestruturação
  'jorge@bismarchipires.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jorge-pecht-souza.jpg`,
    tag: 'Reestruturação',
    name: 'Jorge Pecht Souza',
  },
  'leonardo@bismarchipires.com.br': {
    avatar: `${BASE_URL}/reestruturacao/leo-loureiro.png`,
    tag: 'Reestruturação',
    name: 'Leonardo Loureiro Basso',
  },
  'ligia@bismarchipires.com.br': {
    avatar: `${BASE_URL}/reestruturacao/ligia-gilberti-lopes.jpg`,
    tag: 'Reestruturação',
    name: 'Ligia Lopes',
  },
  'wagner.armani@bismarchipires.com.br': {
    avatar: `${BASE_URL}/reestruturacao/wagner.jpg`,
    tag: 'Societário e Contratos',
    name: 'Wagner Armani',
  },
  'jansonn@bismarchipires.com.br': {
    avatar: `${BASE_URL}/reestruturacao/jansonn.jpg`,
    tag: 'Societário e Contratos',
    name: 'Jansonn Mendonça Batista',
  },
  'henrique.nascimento@bismarchipires.com.br': {
    avatar: 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/02/Henrique-Franco-Nascimento.jpeg',
    tag: 'Societário e Contratos',
    name: 'Henrique Franco Nascimento',
  },
  // Operações Legais
  'felipe@bismarchipires.com.br': {
    avatar: `${BASE_URL}/legal-ops/felipe-carmargo.jpg`,
    tag: 'Operações Legais',
    name: 'Felipe Camargo',
  },
  'lavinia.ferraz@bismarchipires.com.br': {
    avatar: 'https://www.bismarchipires.com.br/img/team/legal-ops/lavinia-ferraz-crispim.jpg',
    tag: 'Operações Legais',
    name: 'Lavínia Ferraz Crispim',
  },
  // Tributário
  'francisco.zanin@bismarchipires.com.br': {
    avatar: 'https://www.bismarchipires.com.br/blog/wp-content/uploads/2026/01/Captura-de-tela-2026-01-27-180946.png',
    tag: 'Tributário',
    name: 'Francisco Zanin',
  },
}

/**
 * Normaliza e-mail para lookup (lowercase + trim).
 */
export function normalizeEmailForLookup(email: string): string {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase()
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
 * Lista de áreas (tags) únicas, ordenada.
 */
export function getAreaTags(): string[] {
  const set = new Set<string>()
  Object.values(TEAM_BY_EMAIL).forEach((m) => {
    if (m.tag?.trim()) set.add(m.tag.trim())
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Retorna a chave normalizada para agrupamento.
 */
export function getSolicitanteKey(email: string | null | undefined): string {
  return normalizeEmailForLookup(email ?? '')
}
