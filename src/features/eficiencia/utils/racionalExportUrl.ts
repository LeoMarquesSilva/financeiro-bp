import type { RacionalIndicador } from '../types/eficiencia.types'

/** Nome exibido na tabela Indicadores operacionais → slug do racional. */
export const INDICADOR_OPERACIONAL_RACIONAL: Record<string, RacionalIndicador> = {
  'SLA Protocolo (D-1)': 'sla_protocolo',
  'Eficiência Protocolo': 'eficiencia_protocolo',
  'SLA Ciência Agendamentos': 'sla_ciencia_agendamentos',
  'SLA Vistagem Risco': 'sla_vistagem_risco',
  'SLA Vistagem Normal': 'sla_vistagem_normal',
  'Desenvolvimento Equipe': 'desenvolvimento_equipe',
  'Gestão de PDI': 'gestao_pdi',
  'Receita Bruta': 'receita_bruta',
  'Índice de Inadimplência': 'indice_inadimplencia',
  'Retenção de Talentos': 'retencao_talentos',
}

export const RACIONAL_EXPORT_TITULO: Record<RacionalIndicador, string> = {
  sla_protocolo: 'SLA Protocolo',
  eficiencia_protocolo: 'Eficiência Protocolo',
  sla_ciencia_agendamentos: 'SLA Ciência Agendamentos',
  sla_vistagem_risco: 'SLA Vistagem Risco',
  sla_vistagem_normal: 'SLA Vistagem Normal',
  desenvolvimento_equipe: 'Desenvolvimento Equipe',
  gestao_pdi: 'Gestão de PDI',
  retencao_talentos: 'Retenção de Talentos',
  receita_bruta: 'Receita Bruta',
  indice_inadimplencia: 'Índice de Inadimplência',
  ops_legais_sla_protocolo: 'Ops Legais SLA Protocolo',
  ops_legais_eficiencia_protocolo: 'Ops Legais Eficiência Protocolo',
  ops_legais_pub_analise: 'Ops Legais Publicações Análise',
  ops_legais_pub_agendamento: 'Ops Legais Publicações Agendamento',
  ops_legais_cadastro: 'Ops Legais Cadastro',
  ops_legais_iniciativas: 'Ops Legais Iniciativas',
  ops_legais_marketing: 'Ops Legais Marketing',
}

/** Chaves Receita (meta) → nomes canônicos das RPCs de Eficiência. */
const RECEITA_KEY_TO_EFICIENCIA_AREA: Record<string, string> = {
  insolvencia: 'Reestruturação',
  trabalhista: 'Trabalhista',
  civel: 'Cível',
  contratos: 'Contratos',
  recuperacao_de_credito: 'Recuperação de Crédito',
}

export function receitaAreaKeyToEficienciaArea(areaKey: string | null | undefined): string | null {
  if (!areaKey) return null
  return RECEITA_KEY_TO_EFICIENCIA_AREA[areaKey] ?? null
}

const LINK_COLOR = '#156082'

function resolveEficienciaDeepLinkOrigin(sioeBaseUrl: string): string {
  const trimmed = sioeBaseUrl.trim().replace(/\/$/, '')
  try {
    const withProtocol = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    return new URL(withProtocol).origin
  } catch {
    return trimmed
  }
}

/** Rota do deep link — mesma URL da aba Eficiência no SIOE. */
export const RACIONAL_EXPORT_PATH = '/financeiro/eficiencia'

/** Deep link SIOE — dispara download do Excel do racional. */
export function buildRacionalExportUrl(
  sioeBaseUrl: string,
  indicador: RacionalIndicador,
  ano: number,
  mes: number,
  areaKey: string | null = null,
): string {
  const u = new URL(RACIONAL_EXPORT_PATH, resolveEficienciaDeepLinkOrigin(sioeBaseUrl))
  u.searchParams.set('racionalExport', indicador)
  u.searchParams.set('ano', String(ano))
  u.searchParams.set('mes', String(mes))
  if (areaKey) u.searchParams.set('areaKey', areaKey)
  return u.toString()
}

export function renderDetalheComLink(
  detalheEscaped: string,
  href: string | null,
): string {
  if (!href) return detalheEscaped
  const safeHref = href
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
  return `<a href="${safeHref}" style="color:${LINK_COLOR};text-decoration:underline;" title="Baixar racional (Excel)">${detalheEscaped}</a>`
}
