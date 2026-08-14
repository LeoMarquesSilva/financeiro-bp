import { escapeHtml } from './format.ts'

export function atingiuMetaKpi(value: number, meta: number, lowerIsBetter = false): boolean {
  return lowerIsBetter ? value <= meta + 0.01 : value >= meta - 0.01
}

export function heatCellStyle(
  value: number | null,
  meta: number,
  bold: boolean,
  lowerIsBetter = false,
): string {
  if (value == null) {
    return `background:#FFFFFF;color:#6B7280;font-weight:${bold ? 700 : 600};`
  }
  const ok = atingiuMetaKpi(value, meta, lowerIsBetter)
  return ok
    ? `background:#ECFDF3;color:#059669;font-weight:${bold ? 700 : 600};`
    : `background:#FEE2E2;color:#DC2626;font-weight:${bold ? 700 : 600};`
}

export function receitaPanel(
  title: string,
  subtitle: string,
  badge: string | null,
  inner: string,
  variant: 'sky' | 'red',
): string {
  const styles =
    variant === 'sky'
      ? {
        bg: '#eff6ff',
        border: '#bae6fd',
        title: '#0c4a6e',
        sub: '#075985',
        badgeBg: 'rgba(255,255,255,0.7)',
        badgeColor: '#0c4a6e',
      }
      : {
        bg: '#fef2f2',
        border: '#fecaca',
        title: '#7f1d1d',
        sub: '#991b1b',
        badgeBg: 'rgba(255,255,255,0.7)',
        badgeColor: '#7f1d1d',
      }

  return `
<div style="margin:20px 0;font-family:Calibri,Arial,sans-serif;border:1px solid ${styles.border};border-radius:12px;background:${styles.bg};padding:12px 14px;">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <h3 style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${styles.title};">${escapeHtml(title)}</h3>
    ${badge ? `<span style="flex-shrink:0;border-radius:999px;background:${styles.badgeBg};padding:2px 8px;font-size:10px;font-weight:600;color:${styles.badgeColor};white-space:nowrap;">${escapeHtml(badge)}</span>` : ''}
  </div>
  <p style="margin:4px 0 12px;font-size:12px;font-weight:500;color:${styles.sub};">${escapeHtml(subtitle)}</p>
  ${inner}
</div>`
}

export function horizontalBar(pct: number, color: string, maxWidth = 100): string {
  const w = Math.min(Math.max(pct, 0), maxWidth)
  return `
<div style="margin-top:6px;height:6px;border-radius:999px;background:#e2e8f0;overflow:hidden;">
  <div style="height:6px;width:${w}%;background:${color};border-radius:999px;"></div>
</div>`
}

export function chartLegend(items: Array<{ label: string; color: string; dashed?: boolean }>): string {
  return `
<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:11px;color:#475569;">
${items
  .map(
    (it) => `
  <span style="display:inline-flex;align-items:center;gap:6px;">
    <span style="display:inline-block;width:14px;height:${it.dashed ? 0 : 10}px;border-bottom:${it.dashed ? `2px dashed ${it.color}` : 'none'};background:${it.dashed ? 'transparent' : it.color};border-radius:2px;"></span>
    ${escapeHtml(it.label)}
  </span>`,
  )
  .join('')}
</div>`
}
