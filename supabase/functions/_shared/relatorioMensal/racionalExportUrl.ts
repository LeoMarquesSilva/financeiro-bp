/** Slugs dos racionais na tabela Indicadores operacionais (e-mail gestão à vista). */
export type RacionalIndicadorSlug =
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia_agendamentos'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'
  | 'desenvolvimento_equipe'
  | 'gestao_pdi'
  | 'retencao_talentos'

export const INDICADOR_OPERACIONAL_RACIONAL: Record<string, RacionalIndicadorSlug> = {
  'SLA Protocolo (D-1)': 'sla_protocolo',
  'Eficiência Protocolo': 'eficiencia_protocolo',
  'SLA Ciência Agendamentos': 'sla_ciencia_agendamentos',
  'SLA Vistagem Risco': 'sla_vistagem_risco',
  'SLA Vistagem Normal': 'sla_vistagem_normal',
  'Desenvolvimento Equipe': 'desenvolvimento_equipe',
  'Gestão de PDI': 'gestao_pdi',
  'Retenção de Talentos': 'retencao_talentos',
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

/** Deep link SIOE — abre Eficiência e baixa o Excel do racional. */
export function buildRacionalExportUrl(
  sioeBaseUrl: string,
  indicador: RacionalIndicadorSlug,
  ano: number,
  mes: number,
  areaKey: string | null = null,
): string {
  const u = new URL('/financeiro/eficiencia', resolveEficienciaDeepLinkOrigin(sioeBaseUrl))
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
