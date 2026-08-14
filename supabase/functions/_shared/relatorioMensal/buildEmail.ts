import {
  ESCRITORIO_GESTAO_VISTA_LABEL,
  META_AREAS,
  MESES_NOME,
  areaLabel,
  type RelatorioSecaoKey,
  type RelatorioSecoesConfig,
} from './constants.ts'
import { buildIndicadoresOperacionaisHtml } from './indicadoresOperacionais.ts'
import {
  buildReceitaComposicaoHtml,
  buildReceitaInadGruposHtml,
  buildReceitaVisaoMesHtml,
} from './buildReceitaHtml.ts'
import { buildEficienciaOverviewHtml } from './buildEficienciaOverviewHtml.ts'
import type { RelatorioDadosBase } from './fetchData.ts'
import { escapeHtml } from './format.ts'
import type { PeriodoGestaoVista } from './periodoGestaoVista.ts'

const SIOE_URL = Deno.env.get('SIOE_PUBLIC_URL') ?? 'https://financeiro-bp.vercel.app'

export function variantesParaDestinatario(areaKey: string | null): (string | null)[] {
  if (!areaKey) {
    return [null, ...META_AREAS.map((a) => a.key)]
  }
  return [null, areaKey]
}

function shouldRenderIndicadoresOperacionais(
  areaKey: string | null,
  focusAreaKey: string | null | undefined,
): boolean {
  if (focusAreaKey) return areaKey === focusAreaKey
  return areaKey == null
}

function buildSecaoHtml(
  key: RelatorioSecaoKey,
  dados: RelatorioDadosBase,
  areaKey: string | null,
  config: RelatorioSecoesConfig,
): string | null {
  switch (key) {
    case 'indicadores_operacionais':
      if (!shouldRenderIndicadoresOperacionais(areaKey, config.focusAreaKey)) return null
      return buildIndicadoresOperacionaisHtml(
        dados.indicadores,
        areaKey,
        dados.periodoLabel,
        SIOE_URL,
      )
    case 'receita_visao_mes':
      return buildReceitaVisaoMesHtml(dados, areaKey)
    case 'receita_composicao':
      return buildReceitaComposicaoHtml(dados, areaKey)
    case 'receita_inad_grupos':
      return buildReceitaInadGruposHtml(dados, areaKey)
    case 'receita_grafico_resumo':
      return null
    case 'eficiencia_overview':
      if (config.focusAreaKey) {
        if (areaKey !== config.focusAreaKey) return null
      } else if (!areaKey && config.secoes.indicadores_operacionais) {
        return null
      }
      return buildEficienciaOverviewHtml(dados.overviewHeatRows, dados, areaKey)
    default:
      return null
  }
}

export function buildEmailHtmlForVariant(
  dadosMap: Map<string | null, RelatorioDadosBase>,
  areaKey: string | null,
  config: RelatorioSecoesConfig,
): string {
  const dados = dadosMap.get(areaKey)
  if (!dados) return ''

  const parts: string[] = []
  parts.push(
    `<div style="font-family:Calibri,Arial,sans-serif;color:#1F2937;max-width:900px;margin:0 auto;">`,
  )

  for (const key of config.ordem) {
    if (!config.secoes[key]) continue
    const html = buildSecaoHtml(key, dados, areaKey, config)
    if (html) parts.push(html)
  }

  parts.push(`</div>`)
  return parts.join('\n')
}

function digestTitle(
  periodo: PeriodoGestaoVista,
  areaKeys: (string | null)[],
): string {
  const mesLabel = MESES_NOME[periodo.mes - 1] ?? String(periodo.mes)
  if (areaKeys.includes(null)) {
    return `Gestão à vista — ${ESCRITORIO_GESTAO_VISTA_LABEL} · ${mesLabel}/${periodo.ano}`
  }
  if (areaKeys.length === 1) {
    return `Gestão à vista — ${areaLabel(areaKeys[0] ?? null)} · ${mesLabel}/${periodo.ano}`
  }
  return `Gestão à vista SIOE — ${mesLabel}/${periodo.ano}`
}

export function buildDigestEmail(
  dadosMap: Map<string | null, RelatorioDadosBase>,
  periodo: PeriodoGestaoVista,
  areaKeys: (string | null)[],
  config: RelatorioSecoesConfig,
  focusAreaKey: string | null = null,
): string {
  const emailConfig: RelatorioSecoesConfig = { ...config, focusAreaKey }
  const sections = areaKeys
    .map((k, index) => {
      const html = buildEmailHtmlForVariant(dadosMap, k, emailConfig)
      if (!html) return ''
      const divider = index > 0
        ? 'margin-top:28px;padding-top:24px;border-top:1px solid #E2E8F0;'
        : ''
      const heading =
        areaKeys.length > 1 && k != null
          ? `<p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#64748B;text-align:center;">${escapeHtml(areaLabel(k))}</p>`
          : ''
      return `<div style="${divider}">${heading}${html}</div>`
    })
    .filter(Boolean)
    .join('\n')

  const titulo = digestTitle(periodo, areaKeys)

  return `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#F1F5F9;">
<div style="max-width:920px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;">
<h1 style="font-size:22px;color:#156082;margin:0 0 8px;">${escapeHtml(titulo)}</h1>
<p style="color:#64748B;font-size:13px;margin:0 0 20px;">${escapeHtml(periodo.periodoLabel)} · <a href="${SIOE_URL}">Abrir no SIOE</a></p>
${sections}
</div></body></html>`
}
