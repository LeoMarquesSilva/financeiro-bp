import { MESES_EFICIENCIA } from '../constants'
import {
  buildIndicadoresOperacionaisRows,
  type IndicadorOperacionalRow,
} from './indicadoresOperacionaisBuild'
import {
  buildRacionalExportUrl,
  INDICADOR_OPERACIONAL_RACIONAL,
  renderDetalheComLink,
} from './racionalExportUrl'

export { buildIndicadoresOperacionaisRows, type IndicadorOperacionalRow } from './indicadoresOperacionaisBuild'

const BRAND = '#156082'
const BORDER = '#CBD5E1'
const TEXT = '#1F2937'
const MUTED = '#6B7280'

function attachRacionalSlugs(rows: IndicadorOperacionalRow[]): IndicadorOperacionalRow[] {
  return rows.map((r) => ({
    ...r,
    racionalSlug: INDICADOR_OPERACIONAL_RACIONAL[r.indicador],
  }))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Tabela HTML para e-mail (formato do print/Excel Indicadores Resultado). */
export function renderIndicadoresOperacionaisHtml(
  rows: IndicadorOperacionalRow[],
  ano: number,
  mes: number,
  areaKey: string | null = null,
  sioeBaseUrl?: string,
): string {
  const mesLabel = MESES_EFICIENCIA[mes - 1] ?? String(mes)
  const rowsWithSlugs = attachRacionalSlugs(rows)
  const bodyRows = rowsWithSlugs
    .map((r, i) => {
      const href =
        r.racionalSlug && sioeBaseUrl
          ? buildRacionalExportUrl(sioeBaseUrl, r.racionalSlug, ano, mes, areaKey)
          : null
      const detalheInner = escapeHtml(r.detalhe)
      const detalheCell =
        href != null
          ? renderDetalheComLink(detalheInner, href)
          : detalheInner
      return `
    <tr style="background:${i % 2 === 1 ? '#F5F7FA' : '#FFFFFF'};">
      <td style="padding:8px 12px;border:1px solid ${BORDER};font-weight:600;color:${TEXT};">${escapeHtml(r.indicador)}</td>
      <td style="padding:8px 12px;border:1px solid ${BORDER};text-align:center;font-weight:700;background:${r.bgColor};">${escapeHtml(r.resultado)}</td>
      <td style="padding:8px 12px;border:1px solid ${BORDER};color:${MUTED};">${detalheCell}</td>
    </tr>`
    })
    .join('')

  return `
<section style="margin:24px 0;font-family:Calibri,Arial,sans-serif;">
  <h2 style="margin:0 0 12px;padding:12px 16px;background:${BRAND};color:#fff;font-size:18px;border-radius:4px 4px 0 0;">
    Indicadores operacionais — ${mesLabel}/${ano}
  </h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr>
        <th style="padding:10px 12px;border:1px solid ${BORDER};background:${BRAND};color:#fff;text-align:left;">Indicador</th>
        <th style="padding:10px 12px;border:1px solid ${BORDER};background:${BRAND};color:#fff;text-align:center;">Resultado</th>
        <th style="padding:10px 12px;border:1px solid ${BORDER};background:${BRAND};color:#fff;text-align:left;">Detalhe</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</section>`
}
