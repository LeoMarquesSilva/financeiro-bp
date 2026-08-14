import { MESES_ABREV } from './constants.ts'
import { RECEITA_COLORS } from './receitaVisualConstants.ts'
import type { ReceitaMesResumo } from './fetchData.ts'

const W = 860
const H = 260
const PAD = { top: 24, right: 16, bottom: 36, left: 72 }

function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`
  return String(Math.round(v))
}

export function buildResumoMensalSvgChart(rows: ReceitaMesResumo[]): string {
  if (rows.length === 0) {
    return `<p style="font-size:12px;color:#64748B;margin:0;">Sem dados para o gráfico.</p>`
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const maxY = Math.max(
    ...rows.flatMap((r) => [r.meta, r.previsto, r.recebido, 1]),
  )
  const yScale = (v: number) => PAD.top + plotH - (v / maxY) * plotH
  const slot = plotW / rows.length
  const barW = Math.min(18, slot * 0.22)

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = PAD.top + plotH * (1 - t)
    const val = maxY * t
    return `
<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>
<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748B">${compact(val)}</text>`
  }).join('')

  const bars = rows.map((r, i) => {
    const cx = PAD.left + slot * i + slot / 2
    const prevH = plotH - (yScale(r.previsto) - PAD.top)
    const recH = plotH - (yScale(r.recebido) - PAD.top)
    const prevY = yScale(r.previsto)
    const recY = yScale(r.recebido)
    const label = MESES_ABREV[r.mes - 1] ?? String(r.mes)
    return `
<rect x="${cx - barW - 2}" y="${prevY}" width="${barW}" height="${Math.max(prevH, 0)}" fill="${RECEITA_COLORS.previsto}" rx="2"/>
<rect x="${cx + 2}" y="${recY}" width="${barW}" height="${Math.max(recH, 0)}" fill="${RECEITA_COLORS.recebido}" rx="2"/>
<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#475569">${label}</text>`
  }).join('')

  const metaPoints = rows
    .filter((r) => r.meta > 0)
    .map((r, _, arr) => {
      const idx = rows.indexOf(r)
      const x = PAD.left + slot * idx + slot / 2
      const y = yScale(r.meta)
      return { x, y }
    })

  let metaLine = ''
  if (metaPoints.length > 0) {
    metaLine = `
<polyline points="${metaPoints.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${RECEITA_COLORS.meta}" stroke-width="2.5" stroke-dasharray="6 4"/>
${metaPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${RECEITA_COLORS.meta}"/>`).join('')}`
  }

  return `
<div style="overflow-x:auto;">
<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="max-width:${W}px;display:block;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Resumo mensal meta previsto recebido">
  ${gridLines}
  ${bars}
  ${metaLine}
</svg>
</div>`
}
