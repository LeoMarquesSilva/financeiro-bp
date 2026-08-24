import { MESES_NOME } from './constants.ts'
import { areaLabel } from './constants.ts'
import { horizontalBar, receitaPanel, rowBetween } from './emailVisualHelpers.ts'
import { formatCurrency, formatDateBr, formatPercent, escapeHtml, muted } from './format.ts'
import type { RelatorioDadosBase } from './fetchData.ts'
import {
  COMPOSICAO_RECEBIDO_LINHAS,
  RECEITA_COLORS,
} from './receitaVisualConstants.ts'
import { buildResumoMensalSvgChart } from './svgResumoMensalChart.ts'

export function buildReceitaVisaoMesHtml(dados: RelatorioDadosBase, areaKey: string | null): string {
  const { fechamento, metaMes, inadMes, ano, mes, periodoLabel, periodoCurto, parcial } = dados
  const mesLabel = MESES_NOME[mes - 1] ?? String(mes)
  const contexto = `${periodoLabel} · ${areaLabel(areaKey)}`
  const subtituloPeriodo = parcial
    ? `Dia 1 ${periodoCurto} · previsto · recebido · inad.`
    : 'Previsto · Recebido · Inadimplência'
  const pctMeta =
    metaMes > 0 ? (fechamento.recebido_classificado / metaMes) * 100 : null
  const pctInadPrev =
    fechamento.previsto > 0 ? (inadMes / fechamento.previsto) * 100 : null

  const headerBg = RECEITA_COLORS.skyHeaderTo
  const kpiBg = RECEITA_COLORS.skyHeaderFrom
  const inadBg = '#7f1d1d'

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${headerBg}" style="margin:20px 0;background-color:${headerBg};border:1px solid ${headerBg};border-collapse:separate;border-radius:12px;">
  <tr>
    <td style="padding:14px 16px;font-family:Calibri,Arial,sans-serif;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">💰 Gestão à vista — ${escapeHtml(areaLabel(areaKey))} · ${mesLabel} / ${ano}</p>
      <p style="margin:4px 0 12px;font-size:12px;color:#e0f2fe;">${subtituloPeriodo}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="33%" valign="top" bgcolor="${kpiBg}" style="background-color:${kpiBg};padding:10px 12px;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#e0f2fe;">Previsto</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;">${formatCurrency(fechamento.previsto)}</p>
            <p style="margin:4px 0 0;font-size:10px;color:#e0f2fe;">Venc. do mês</p>
          </td>
          <td width="8" bgcolor="${headerBg}" style="background-color:${headerBg};font-size:0;line-height:0;">&nbsp;</td>
          <td width="33%" valign="top" bgcolor="${kpiBg}" style="background-color:${kpiBg};padding:10px 12px;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#e0f2fe;">Recebido</p>
            <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#ffffff;">${formatCurrency(fechamento.recebido_classificado)}</p>
            <p style="margin:4px 0 0;font-size:10px;font-weight:600;color:#e0f2fe;">${pctMeta != null ? `${formatPercent(pctMeta)} da meta` : '—'}</p>
          </td>
          <td width="8" bgcolor="${headerBg}" style="background-color:${headerBg};font-size:0;line-height:0;">&nbsp;</td>
          <td width="33%" valign="top" bgcolor="${inadBg}" style="background-color:${inadBg};padding:10px 12px;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#fecaca;">Inad. mês</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#fecaca;">${formatCurrency(inadMes)}</p>
            <p style="margin:4px 0 0;font-size:10px;font-weight:600;color:#fecaca;">${pctInadPrev != null ? `${formatPercent(pctInadPrev)} do previsto` : '—'}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td bgcolor="#f8fafc" style="background-color:#f8fafc;padding:8px 14px;font-family:Calibri,Arial,sans-serif;font-size:11px;color:#64748B;">${contexto}</td>
  </tr>
</table>`
}

export function buildReceitaComposicaoHtml(dados: RelatorioDadosBase, areaKey: string | null): string {
  const { fechamento, periodoLabel } = dados
  const contexto = `${periodoLabel} · ${areaLabel(areaKey)}`
  const total = fechamento.recebido_classificado
  const f = fechamento as Record<string, number>
  const pctPrevistoCaixa =
    fechamento.previsto > 0
      ? (fechamento.recebido_previsto_caixa / fechamento.previsto) * 100
      : null

  const linhas = COMPOSICAO_RECEBIDO_LINHAS.map((linha) => {
    const valor = f[linha.key] ?? 0
    if (Math.abs(valor) < 0.01) return ''
    const pct = total > 0 ? (valor / total) * 100 : 0
    return `
<div style="padding:8px 4px;border-bottom:1px solid #bae6fd;">
  ${rowBetween(
    `<p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${linha.label}</p><p style="margin:2px 0 0;font-size:10px;line-height:1.35;color:#64748B;">${linha.hint}</p>`,
    `<p style="margin:0;font-size:14px;font-weight:700;color:${linha.color};">${formatCurrency(valor)}</p><p style="margin:2px 0 0;font-size:10px;font-weight:600;color:#64748B;">${formatPercent(pct)}</p>`,
  )}
  ${horizontalBar(pct, linha.bar)}
</div>`
  }).join('')

  const inner = `
${linhas}
${rowBetween(
    '<span style="font-size:13px;font-weight:700;color:#0c4a6e;">= Total recebido classificado</span>',
    `<span style="font-size:13px;font-weight:700;color:#0284c7;">${formatCurrency(total)}</span>`,
    'margin-top:10px;border-top:2px solid #bae6fd;padding-top:10px;',
  )}`

  return receitaPanel(
    'Composição do recebido',
    contexto,
    pctPrevistoCaixa != null ? `${formatPercent(pctPrevistoCaixa)} do previsto (venc. mês)` : null,
    inner,
    'sky',
  )
}

export function buildReceitaInadGruposHtml(dados: RelatorioDadosBase, areaKey: string | null): string {
  const { topGruposInad, inadMes, fechamento, periodoLabel } = dados
  const contexto = `${periodoLabel} · ${areaLabel(areaKey)}`
  const pctInadPrev =
    fechamento.previsto > 0 ? (inadMes / fechamento.previsto) * 100 : null

  if (topGruposInad.length === 0) {
    return receitaPanel(
      'Inadimplência do mês — por grupo',
      contexto,
      pctInadPrev != null ? `${formatPercent(pctInadPrev)} do previsto` : null,
      muted('Nenhum grupo com inadimplência no mês.'),
      'red',
    )
  }

  const maxVal = Math.max(...topGruposInad.map((g) => g.valor), 1)
  const rows = topGruposInad.map((g, i) => {
    const pctBar = (g.valor / maxVal) * 100
    return `
<div style="padding:8px 0;${i < topGruposInad.length - 1 ? 'border-bottom:1px solid #fecaca;' : ''}">
  ${rowBetween(
    `<p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${escapeHtml(g.grupo)}</p><p style="margin:2px 0 0;font-size:11px;color:#64748B;">Venc. ${formatDateBr(g.data_vencimento)}</p>`,
    `<span style="font-size:14px;font-weight:700;color:#dc2626;white-space:nowrap;">${formatCurrency(g.valor)}</span>`,
  )}
  ${horizontalBar(pctBar, '#ef4444')}
</div>`
  }).join('')

  const inner = `
${rows}
${rowBetween(
    '<span style="font-size:13px;font-weight:700;color:#7f1d1d;">= Total inad. mês (top 5)</span>',
    `<span style="font-size:13px;font-weight:700;color:#7f1d1d;">${formatCurrency(topGruposInad.reduce((s, g) => s + g.valor, 0))}</span>`,
    'margin-top:10px;border-top:2px solid #fecaca;padding-top:10px;',
  )}
<p style="margin:8px 0 0;font-size:11px;color:#94A3B8;">Detalhe completo no SIOE → Receita → Inadimplência.</p>`

  return receitaPanel(
    'Inadimplência do mês — por grupo',
    contexto,
    pctInadPrev != null ? `${formatPercent(pctInadPrev)} do previsto` : null,
    inner,
    'red',
  )
}

export function buildReceitaGraficoResumoHtml(dados: RelatorioDadosBase, areaKey: string | null): string {
  const { resumoMensal, ano, periodoLabel } = dados
  const titulo = `Resumo mensal (gestão à vista) — ${ano} · ${areaLabel(areaKey)}`
  const chart = buildResumoMensalSvgChart(resumoMensal)

  return `
<div style="margin:20px 0;font-family:Calibri,Arial,sans-serif;border:1px solid #E2E8F0;border-radius:12px;background:#ffffff;padding:14px 16px;">
  <h2 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a;">${titulo}</h2>
  <p style="margin:0 0 12px;font-size:11px;color:#64748B;">${periodoLabel}</p>
  ${chart}
</div>`
}
