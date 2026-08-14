import { MESES_NOME } from './constants.ts'
import { areaLabel } from './constants.ts'
import { horizontalBar, receitaPanel } from './emailVisualHelpers.ts'
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

  return `
<div style="margin:20px 0;font-family:Calibri,Arial,sans-serif;border-radius:12px;overflow:hidden;border:1px solid #0369a1;box-shadow:0 2px 8px rgba(2,132,199,0.15);">
  <div style="background:linear-gradient(135deg,${RECEITA_COLORS.skyHeaderFrom},${RECEITA_COLORS.skyHeaderTo});padding:14px 16px;color:#fff;">
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;">💰</div>
      <div>
        <h2 style="margin:0;font-size:16px;font-weight:700;">Gestão à vista — ${escapeHtml(areaLabel(areaKey))} · ${mesLabel} / ${ano}</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#e0f2fe;">${subtituloPeriodo}</p>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
      <div style="flex:1;min-width:140px;border-radius:8px;background:rgba(255,255,255,0.1);padding:10px 12px;">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:rgba(224,242,254,0.9);">Previsto</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#fff;">${formatCurrency(fechamento.previsto)}</p>
        <p style="margin:4px 0 0;font-size:10px;color:rgba(224,242,254,0.85);">Venc. do mês</p>
      </div>
      <div style="flex:1;min-width:140px;border-radius:8px;background:rgba(255,255,255,0.15);padding:10px 12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.2);">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#e0f2fe;">Recebido</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#fff;">${formatCurrency(fechamento.recebido_classificado)}</p>
        <p style="margin:4px 0 0;font-size:10px;font-weight:600;color:#e0f2fe;">${pctMeta != null ? `${formatPercent(pctMeta)} da meta${metaMes > 0 ? '' : ''}` : '—'}</p>
      </div>
      <div style="flex:1;min-width:140px;border-radius:8px;background:rgba(69,10,10,0.35);padding:10px 12px;box-shadow:inset 0 0 0 1px rgba(252,165,165,0.25);">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:rgba(254,226,226,0.95);">Inad. mês</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#fca5a5;">${formatCurrency(inadMes)}</p>
        <p style="margin:4px 0 0;font-size:10px;font-weight:600;color:rgba(254,226,226,0.9);">${pctInadPrev != null ? `${formatPercent(pctInadPrev)} do previsto` : '—'}</p>
      </div>
    </div>
  </div>
  <p style="margin:0;padding:8px 14px;font-size:11px;color:#64748B;background:#f8fafc;">${contexto}</p>
</div>`
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
<div style="padding:8px 4px;border-bottom:1px solid rgba(186,230,253,0.6);">
  <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
    <div style="min-width:0;flex:1;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${linha.label}</p>
      <p style="margin:2px 0 0;font-size:10px;line-height:1.35;color:#64748B;">${linha.hint}</p>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <p style="margin:0;font-size:14px;font-weight:700;color:${linha.color};">${formatCurrency(valor)}</p>
      <p style="margin:2px 0 0;font-size:10px;font-weight:600;color:#64748B;">${formatPercent(pct)}</p>
    </div>
  </div>
  ${horizontalBar(pct, linha.bar)}
</div>`
  }).join('')

  const inner = `
${linhas}
<div style="margin-top:10px;display:flex;justify-content:space-between;border-top:2px solid #bae6fd;padding-top:10px;font-size:13px;font-weight:700;color:#0c4a6e;">
  <span>= Total recebido classificado</span>
  <span style="color:#0284c7;">${formatCurrency(total)}</span>
</div>`

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
<div style="padding:8px 0;${i < topGruposInad.length - 1 ? 'border-bottom:1px solid rgba(254,202,202,0.7);' : ''}">
  <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
    <div style="min-width:0;">
      <p style="margin:0;font-size:13px;font-weight:600;color:#1e293b;">${escapeHtml(g.grupo)}</p>
      <p style="margin:2px 0 0;font-size:11px;color:#64748B;">Venc. ${formatDateBr(g.data_vencimento)}</p>
    </div>
    <span style="font-size:14px;font-weight:700;color:#dc2626;white-space:nowrap;">${formatCurrency(g.valor)}</span>
  </div>
  ${horizontalBar(pctBar, '#ef4444')}
</div>`
  }).join('')

  const inner = `
${rows}
<div style="margin-top:10px;display:flex;justify-content:space-between;border-top:2px solid #fecaca;padding-top:10px;font-size:13px;font-weight:700;color:#7f1d1d;">
  <span>= Total inad. mês (top 5)</span>
  <span>${formatCurrency(topGruposInad.reduce((s, g) => s + g.valor, 0))}</span>
</div>
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
<div style="margin:20px 0;font-family:Calibri,Arial,sans-serif;border:1px solid #E2E8F0;border-radius:12px;background:#fff;padding:14px 16px;box-shadow:0 2px 4px rgba(15,23,42,0.06);">
  <h2 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a;">${titulo}</h2>
  <p style="margin:0 0 12px;font-size:11px;color:#64748B;">${periodoLabel}</p>
  ${chart}
</div>`
}
