const BORDER = '#CBD5E1'
const BRAND = '#156082'
const MUTED = '#6B7280'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (value >= 1_000) {
    return `R$ ${Math.round(value / 1_000)} mil`
  }
  return formatCurrency(value)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0,00%'
  return `${value.toFixed(2).replace('.', ',')}%`
}

export function formatDateBr(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—'
  const [y, m, d] = iso.trim().slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function section(title: string, innerHtml: string): string {
  return `
<section style="margin:24px 0;font-family:Calibri,Arial,sans-serif;">
  <h2 style="margin:0 0 12px;padding:10px 14px;background:${BRAND};color:#fff;font-size:16px;border-radius:4px;">
    ${escapeHtml(title)}
  </h2>
  ${innerHtml}
</section>`
}

export function simpleTable(headers: string[], rows: string[][]): string {
  const th = headers
    .map(
      (h) =>
        `<th style="padding:8px 10px;border:1px solid ${BORDER};background:${BRAND};color:#fff;text-align:left;font-size:13px;">${escapeHtml(h)}</th>`,
    )
    .join('')
  const tr = rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 ? '#F5F7FA' : '#fff'};">${row
          .map(
            (c) =>
              `<td style="padding:8px 10px;border:1px solid ${BORDER};font-size:13px;color:#1F2937;">${c}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;">${th ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody></table>`
}

export function muted(text: string): string {
  return `<p style="margin:8px 0;font-size:12px;color:${MUTED};">${escapeHtml(text)}</p>`
}
