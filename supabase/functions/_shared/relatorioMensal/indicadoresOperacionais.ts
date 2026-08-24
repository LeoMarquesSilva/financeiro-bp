import { MESES_NOME, areaLabel } from './constants.ts'
import { escapeHtml, formatCurrency, formatPercent } from './format.ts'
import {
  buildRacionalExportUrl,
  renderDetalheComLink,
  type RacionalIndicadorSlug,
} from './racionalExportUrl.ts'

const GREEN_SOFT = '#E8F5E9'
const RED_SOFT = '#FFEBEE'
const BRAND_SOFT = '#D6EAF5'
const BRAND = '#156082'
const BORDER = '#CBD5E1'
const TEXT = '#1F2937'
const MUTED = '#6B7280'

export type IndicadorOperacionalRow = {
  indicador: string
  resultado: string
  detalhe: string
  bgColor: string
  racionalSlug?: RacionalIndicadorSlug
}

export type IndicadoresOperacionaisInput = {
  ano: number
  mes: number
  slaProtocolo: { qtd_d1: number; qtd_fatal: number; qtd_excludente: number } | null
  eficienciaProtocolo: { qtd_eficiencia: number; qtd_inconsistencia: number } | null
  agendamento: { dentro: number; fora: number } | null
  vistagemRisco: { sim: number; nao: number } | null
  vistagemNormal: { sim: number; nao: number } | null
  desenvolvimentoEquipe: {
    minutos_lancados: number
    meta_minutos: number
    pct_atingimento: number
    pessoas_ativas: number
  } | null
  gestaoPdi: { aptas: number; desvios: number; elegiveis: number; pct_aptas: number | null } | null
  receitaBruta: { pct_meta: number | null; recebido: number | null; meta: number | null } | null
  indiceInadimplencia: {
    pct: number | null
    inadimplencia: number | null
    previsto: number | null
  } | null
  retencao: {
    pct_retencao: number
    funcionarios_ativos: number
    saidas_voluntarias: number
    meta_pct_retencao_minima: number
  } | null
}

function pctLabel(num: number, den: number): string {
  if (den <= 0) return '—'
  return `${((num / den) * 100).toFixed(2).replace('.', ',')}%`
}

function formatMinutosHoras(minutos: number): string {
  const total = Math.max(0, Math.round(minutos))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function isMesCorrenteIndicadores(ano: number, mes: number, ref = new Date()): boolean {
  return ano === ref.getFullYear() && mes === ref.getMonth() + 1
}

function buildGestaoPdiRow(
  gp: IndicadoresOperacionaisInput['gestaoPdi'],
  ano: number,
  mes: number,
): IndicadorOperacionalRow {
  if (isMesCorrenteIndicadores(ano, mes)) {
    return {
      indicador: 'Gestão de PDI',
      resultado: 'Ciclo não fechado',
      detalhe: '',
      bgColor: BRAND_SOFT,
    }
  }

  if (gp?.pct_aptas != null) {
    return {
      indicador: 'Gestão de PDI',
      resultado: formatPercent(gp.pct_aptas),
      detalhe: `${gp.aptas} aptas · ${gp.desvios} desvios · ${gp.elegiveis} elegíveis`,
      bgColor: gp.pct_aptas >= 100 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'gestao_pdi',
    }
  }

  if (gp && gp.elegiveis > 0) {
    const pct = (gp.aptas / gp.elegiveis) * 100
    return {
      indicador: 'Gestão de PDI',
      resultado: formatPercent(pct),
      detalhe: `${gp.aptas} aptas · ${gp.desvios} desvios · ${gp.elegiveis} elegíveis`,
      bgColor: pct >= 100 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'gestao_pdi',
    }
  }

  return {
    indicador: 'Gestão de PDI',
    resultado: '—',
    detalhe: 'Baixar racional (Excel)',
    bgColor: BRAND_SOFT,
    racionalSlug: 'gestao_pdi',
  }
}

export function buildIndicadoresOperacionaisRows(data: IndicadoresOperacionaisInput): IndicadorOperacionalRow[] {
  const rows: IndicadorOperacionalRow[] = []
  const r = data.slaProtocolo
  const e = data.eficienciaProtocolo

  if (r) {
    const den = r.qtd_d1 + r.qtd_fatal
    rows.push({
      indicador: 'SLA Protocolo (D-1)',
      resultado: pctLabel(r.qtd_d1, den),
      detalhe: `${r.qtd_d1} D-1 · ${r.qtd_fatal} FATAL · ${r.qtd_excludente} excludentes`,
      bgColor: den > 0 && r.qtd_d1 / den >= 0.9 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'sla_protocolo',
    })
  }

  if (e) {
    const den = e.qtd_eficiencia + e.qtd_inconsistencia
    rows.push({
      indicador: 'Eficiência Protocolo',
      resultado: pctLabel(e.qtd_eficiencia, den),
      detalhe: `${e.qtd_eficiencia} eficiência · ${e.qtd_inconsistencia} inconsistência`,
      bgColor: den > 0 && e.qtd_eficiencia / den >= 0.95 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'eficiencia_protocolo',
    })
  }

  const ag = data.agendamento
  if (ag) {
    const denAg = ag.dentro + ag.fora
    rows.push({
      indicador: 'SLA Ciência Agendamentos',
      resultado: denAg ? pctLabel(ag.dentro, denAg) : '—',
      detalhe: `${ag.dentro} dentro · ${ag.fora} fora`,
      bgColor: denAg && ag.dentro / denAg >= 0.95 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'sla_ciencia_agendamentos',
    })
  }

  const vr = data.vistagemRisco
  if (vr) {
    const denVr = vr.sim + vr.nao
    rows.push({
      indicador: 'SLA Vistagem Risco',
      resultado: denVr ? pctLabel(vr.sim, denVr) : '—',
      detalhe: `${vr.sim} Sim · ${vr.nao} Não`,
      bgColor: denVr && vr.sim / denVr >= 0.98 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'sla_vistagem_risco',
    })
  }

  const vn = data.vistagemNormal
  if (vn) {
    const denVn = vn.sim + vn.nao
    rows.push({
      indicador: 'SLA Vistagem Normal',
      resultado: denVn ? pctLabel(vn.sim, denVn) : '—',
      detalhe: `${vn.sim} Sim · ${vn.nao} Não`,
      bgColor: denVn && vn.sim / denVn >= 0.98 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'sla_vistagem_normal',
    })
  }

  const dev = data.desenvolvimentoEquipe
  const devResultado =
    dev && dev.meta_minutos > 0
      ? `${formatMinutosHoras(dev.minutos_lancados)}h / ${formatMinutosHoras(dev.meta_minutos)}h (${formatPercent(dev.pct_atingimento)})`
      : dev
        ? `${formatMinutosHoras(dev.minutos_lancados)}h`
        : '—'
  rows.push({
    indicador: 'Desenvolvimento Equipe',
    resultado: devResultado,
    detalhe:
      dev && dev.pessoas_ativas > 0
        ? `Meta ${dev.pessoas_ativas} × 14h · Baixar racional (Excel)`
        : 'Baixar racional (Excel)',
    bgColor:
      dev && dev.meta_minutos > 0
        ? dev.pct_atingimento >= 100
          ? GREEN_SOFT
          : RED_SOFT
        : BRAND_SOFT,
    racionalSlug: 'desenvolvimento_equipe',
  })

  rows.push(buildGestaoPdiRow(data.gestaoPdi, data.ano, data.mes))

  const rb = data.receitaBruta
  if (rb?.pct_meta != null) {
    rows.push({
      indicador: 'Receita Bruta',
      resultado: formatPercent(rb.pct_meta),
      detalhe:
        rb.recebido != null && rb.meta != null
          ? `${formatCurrency(rb.recebido)} recebido · meta ${formatCurrency(rb.meta)}`
          : 'Baixar racional (Excel)',
      bgColor: rb.pct_meta >= 100 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'receita_bruta',
    })
  }

  const inad = data.indiceInadimplencia
  if (inad?.pct != null) {
    rows.push({
      indicador: 'Índice de Inadimplência',
      resultado: formatPercent(inad.pct),
      detalhe:
        inad.inadimplencia != null && inad.previsto != null
          ? `${formatCurrency(inad.inadimplencia)} inad. · previsto ${formatCurrency(inad.previsto)}`
          : 'Baixar racional (Excel)',
      bgColor: inad.pct <= 14 ? GREEN_SOFT : RED_SOFT,
      racionalSlug: 'indice_inadimplencia',
    })
  }

  const rt = data.retencao
  rows.push({
    indicador: 'Retenção de Talentos',
    resultado: rt != null ? `${rt.pct_retencao.toFixed(2).replace('.', ',')}%` : '—',
    detalhe: rt
      ? `${rt.funcionarios_ativos} ativos · ${rt.saidas_voluntarias} saídas voluntárias`
      : 'Baixar racional (Excel)',
    bgColor: rt && rt.pct_retencao >= rt.meta_pct_retencao_minima ? GREEN_SOFT : rt ? RED_SOFT : BRAND_SOFT,
    racionalSlug: 'retencao_talentos',
  })

  return rows
}

export function renderIndicadoresOperacionaisHtml(
  rows: IndicadorOperacionalRow[],
  ano: number,
  mes: number,
  areaKey: string | null = null,
  periodoLabel?: string,
  sioeBaseUrl?: string,
): string {
  const mesLabel = MESES_NOME[mes - 1] ?? String(mes)
  const tituloArea = areaKey ? ` · ${areaLabel(areaKey)}` : ''
  const periodoHtml = periodoLabel
    ? `<p style="margin:0 0 12px;padding:0 16px;font-size:12px;color:${MUTED};">${escapeHtml(periodoLabel)}</p>`
    : ''
  const bodyRows = rows
    .map((r, i) => {
      const href =
        r.racionalSlug && sioeBaseUrl
          ? buildRacionalExportUrl(sioeBaseUrl, r.racionalSlug, ano, mes, areaKey)
          : null
      const detalheHtml = renderDetalheComLink(escapeHtml(r.detalhe), href)
      return `
    <tr style="background:${i % 2 === 1 ? '#F5F7FA' : '#FFFFFF'};">
      <td style="padding:8px 12px;border:1px solid ${BORDER};font-weight:600;color:${TEXT};">${escapeHtml(r.indicador)}</td>
      <td style="padding:8px 12px;border:1px solid ${BORDER};text-align:center;font-weight:700;background:${r.bgColor};">${escapeHtml(r.resultado)}</td>
      <td style="padding:8px 12px;border:1px solid ${BORDER};color:${MUTED};">${detalheHtml}</td>
    </tr>`
    })
    .join('')

  return `
<section style="margin:24px 0;font-family:Calibri,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND}" style="margin:0 0 12px;background-color:${BRAND};border-collapse:collapse;">
    <tr>
      <td style="padding:12px 16px;font-family:Calibri,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;">
        Indicadores operacionais — ${mesLabel}/${ano}${tituloArea}
      </td>
    </tr>
  </table>
  ${periodoHtml}
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr>
        <th bgcolor="${BRAND}" style="padding:10px 12px;border:1px solid ${BORDER};background-color:${BRAND};color:#ffffff;text-align:left;">Indicador</th>
        <th bgcolor="${BRAND}" style="padding:10px 12px;border:1px solid ${BORDER};background-color:${BRAND};color:#ffffff;text-align:center;">Valor</th>
        <th bgcolor="${BRAND}" style="padding:10px 12px;border:1px solid ${BORDER};background-color:${BRAND};color:#ffffff;text-align:left;">Detalhe</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</section>`
}

export function buildIndicadoresOperacionaisHtml(
  data: IndicadoresOperacionaisInput,
  areaKey: string | null = null,
  periodoLabel?: string,
  sioeBaseUrl?: string,
): string {
  return renderIndicadoresOperacionaisHtml(
    buildIndicadoresOperacionaisRows(data),
    data.ano,
    data.mes,
    areaKey,
    periodoLabel,
    sioeBaseUrl,
  )
}
