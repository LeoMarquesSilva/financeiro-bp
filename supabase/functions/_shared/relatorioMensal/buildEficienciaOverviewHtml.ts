import { areaLabel } from './constants.ts'
import { MESES_NOME } from './constants.ts'
import { heatCellStyle } from './emailVisualHelpers.ts'
import type { OverviewHeatRow, RelatorioDadosBase } from './fetchData.ts'
import { escapeHtml } from './format.ts'
import { MESES_EFICIENCIA_ABREV } from './receitaVisualConstants.ts'

function renderHeatCard(row: OverviewHeatRow, mesDestaque: number): string {
  const metaTexto = row.metaLabel ?? `Meta ${row.meta.toFixed(0).replace('.', ',')}%`
  const acumStyle = heatCellStyle(row.acumulado.value, row.metaAcumulado ?? row.meta, true, row.lowerIsBetter)

  if (row.modoAnual) {
    return `
<div style="margin:0 0 8px;background:#FFFFFF;border:1px solid #E6E8EB;border-radius:8px;padding:6px 8px;">
  <table style="width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;font-family:Calibri,Arial,sans-serif;font-size:11px;">
    <tr>
      <td style="padding:4px 6px;font-weight:600;color:#1F2937;width:55%;">${escapeHtml(row.title)}</td>
      <td style="padding:4px 6px;font-size:10px;color:#059669;width:20%;">${escapeHtml(metaTexto)}</td>
      <td style="padding:4px;text-align:center;font-weight:600;${acumStyle}">${row.acumulado.value == null ? '-' : escapeHtml(row.acumulado.label)}</td>
    </tr>
  </table>
</div>`
  }

  const mesesVisiveis = Array.from({ length: mesDestaque }, (_, i) => i + 1)
  const monthPct = `${Math.floor(52 / Math.max(mesesVisiveis.length, 1))}%`

  const headerMonths = mesesVisiveis.map((mes) => {
    const i = mes - 1
    return `
<th style="padding:3px 2px;text-align:center;font-size:10px;font-weight:600;color:#64748B;border-bottom:1px solid #E5E7EB;width:${monthPct};">${MESES_EFICIENCIA_ABREV[i]}</th>`
  }).join('')

  const monthCells = mesesVisiveis.map((mes) => {
    const cell = row.cells[mes - 1]!
    const style = heatCellStyle(cell.value, row.meta, false, row.lowerIsBetter)
    return `
<td style="padding:3px 2px;text-align:center;font-size:10px;${style}">${cell.value == null ? '-' : escapeHtml(cell.label)}</td>`
  }).join('')

  return `
<div style="margin:0 0 8px;background:#FFFFFF;border:1px solid #E6E8EB;border-radius:8px;padding:6px 8px;">
  <table style="width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;font-family:Calibri,Arial,sans-serif;">
    <thead>
      <tr>
        <th style="padding:4px 6px;text-align:left;font-size:10px;font-weight:600;color:#1F2937;border-bottom:1px solid #E5E7EB;width:28%;">${escapeHtml(row.title)}</th>
        ${headerMonths}
        <th style="padding:3px 2px;text-align:center;font-size:9px;font-weight:600;color:#1F2937;border-bottom:1px solid #E5E7EB;width:10%;">Acum.</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:4px 6px;text-align:left;font-size:9px;font-weight:500;color:#059669;">${escapeHtml(metaTexto)}</td>
        ${monthCells}
        <td style="padding:3px 2px;text-align:center;font-size:10px;border-left:1px solid #E5E7EB;${acumStyle}">${row.acumulado.value == null ? '-' : escapeHtml(row.acumulado.label)}</td>
      </tr>
    </tbody>
  </table>
</div>`
}

export function buildEficienciaOverviewHtml(
  rows: OverviewHeatRow[],
  dados: Pick<RelatorioDadosBase, 'ano' | 'mes' | 'periodoLabel'>,
  areaKey: string | null,
): string {
  if (rows.length === 0) return ''

  const { ano, mes } = dados
  const mesLabel = MESES_NOME[mes - 1] ?? String(mes)
  const cards = rows.map((r) => renderHeatCard(r, mes)).join('')

  return `
<div style="margin:20px 0;font-family:Calibri,Arial,sans-serif;max-width:100%;">
  <h2 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#0f172a;">Overview eficiência — ${mesLabel}/${ano} · ${escapeHtml(areaLabel(areaKey))}</h2>
  ${cards}
</div>`
}
