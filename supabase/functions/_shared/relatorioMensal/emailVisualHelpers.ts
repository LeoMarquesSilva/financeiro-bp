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
        badgeColor: '#0c4a6e',
      }
      : {
        bg: '#fef2f2',
        border: '#fecaca',
        title: '#7f1d1d',
        sub: '#991b1b',
        badgeColor: '#7f1d1d',
      }

  const badgeHtml = badge
    ? `<td align="right" valign="top" style="padding:0 0 0 12px;white-space:nowrap;">
         <span style="background-color:#ffffff;border:1px solid ${styles.border};border-radius:999px;padding:2px 8px;font-size:10px;font-weight:600;color:${styles.badgeColor};">${escapeHtml(badge)}</span>
       </td>`
    : ''

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${styles.bg}" style="margin:20px 0;background-color:${styles.bg};border:1px solid ${styles.border};border-collapse:separate;border-radius:12px;">
  <tr>
    <td style="padding:12px 14px;font-family:Calibri,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top" style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${styles.title};">${escapeHtml(title)}</td>
          ${badgeHtml}
        </tr>
      </table>
      <p style="margin:4px 0 12px;font-size:12px;font-weight:500;color:${styles.sub};">${escapeHtml(subtitle)}</p>
      ${inner}
    </td>
  </tr>
</table>`
}

export function horizontalBar(pct: number, color: string, maxWidth = 100): string {
  const w = Math.round(Math.min(Math.max(pct, 0), maxWidth))
  if (w <= 0) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e2e8f0" style="margin-top:6px;background-color:#e2e8f0;height:6px;"><tr><td height="6" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`
  }
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e2e8f0" style="margin-top:6px;background-color:#e2e8f0;height:6px;">
  <tr>
    <td width="${w}%" height="6" bgcolor="${color}" style="background-color:${color};font-size:0;line-height:0;">&nbsp;</td>
    <td height="6" style="font-size:0;line-height:0;">&nbsp;</td>
  </tr>
</table>`
}

export function rowBetween(left: string, right: string, extra = ''): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${extra}">
  <tr>
    <td valign="top" style="font-family:Calibri,Arial,sans-serif;">${left}</td>
    <td valign="top" align="right" style="font-family:Calibri,Arial,sans-serif;white-space:nowrap;padding-left:12px;">${right}</td>
  </tr>
</table>`
}

export function brandBar(titleHtml: string, bg = '#156082'): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${bg}" style="background-color:${bg};border-collapse:collapse;">
  <tr>
    <td style="padding:12px 16px;font-family:Calibri,Arial,sans-serif;font-size:16px;font-weight:700;color:#ffffff;">
      ${titleHtml}
    </td>
  </tr>
</table>`
}

export function chartLegend(items: Array<{ label: string; color: string; dashed?: boolean }>): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;font-size:11px;color:#475569;">
  <tr>
${items
  .map(
    (it) => `
    <td style="padding:0 12px 0 0;white-space:nowrap;">
      <span style="display:inline-block;width:14px;height:${it.dashed ? 0 : 10}px;border-bottom:${it.dashed ? `2px dashed ${it.color}` : 'none'};background:${it.dashed ? '#ffffff' : it.color};border-radius:2px;"></span>
      ${escapeHtml(it.label)}
    </td>`,
  )
  .join('')}
  </tr>
</table>`
}
