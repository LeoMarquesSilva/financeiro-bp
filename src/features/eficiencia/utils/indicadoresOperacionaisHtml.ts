import { formatPercent } from '@/shared/utils/format'
import { MESES_EFICIENCIA } from '../constants'
import type { IndicadoresResultadoMes } from '../types/indicadoresResultado.types'
import type { RacionalIndicador, RacionalResumo } from '../types/eficiencia.types'
import { countVistagemD1 } from './racionalFormat'
import {
  buildRacionalExportUrl,
  INDICADOR_OPERACIONAL_RACIONAL,
  renderDetalheComLink,
} from './racionalExportUrl'

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
  racionalSlug?: RacionalIndicador
}

function vistagemCounts(
  resumo: RacionalResumo | undefined,
  linhas: Array<Record<string, unknown>>,
): { sim: number; nao: number } {
  if (resumo?.qtd_vistado_sim != null && resumo?.qtd_vistado_nao != null) {
    return { sim: resumo.qtd_vistado_sim, nao: resumo.qtd_vistado_nao }
  }
  return countVistagemD1(linhas)
}

function pctLabel(num: number, den: number): string {
  if (den <= 0) return '—'
  return `${((num / den) * 100).toFixed(2).replace('.', ',')}%`
}

/** Linhas da tabela Indicadores Resultado (mesma lógica de writeResultadoSheet). */
export function buildIndicadoresOperacionaisRows(data: IndicadoresResultadoMes): IndicadorOperacionalRow[] {
  const rows: IndicadorOperacionalRow[] = []
  const r = data.slaProtocolo.resumo
  const e = data.eficienciaProtocolo.resumo

  if (r?.qtd_d1 != null && r.qtd_fatal != null) {
    const den = r.qtd_d1 + r.qtd_fatal
    rows.push({
      indicador: 'SLA Protocolo (D-1)',
      resultado: pctLabel(r.qtd_d1, den),
      detalhe: `${r.qtd_d1} D-1 · ${r.qtd_fatal} FATAL · ${r.qtd_excludente ?? 0} excludentes`,
      bgColor: den > 0 && r.qtd_d1 / den >= 0.9 ? GREEN_SOFT : RED_SOFT,
    })
  }

  if (e?.qtd_eficiencia != null && e.qtd_inconsistencia != null) {
    const den = e.qtd_eficiencia + e.qtd_inconsistencia
    rows.push({
      indicador: 'Eficiência Protocolo',
      resultado: pctLabel(e.qtd_eficiencia, den),
      detalhe: `${e.qtd_eficiencia} eficiência · ${e.qtd_inconsistencia} inconsistência`,
      bgColor: den > 0 && e.qtd_eficiencia / den >= 0.95 ? GREEN_SOFT : RED_SOFT,
    })
  }

  let dentro = 0
  let fora = 0
  for (const row of data.agendamento.linhas) {
    if (String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) fora += 1
    else dentro += 1
  }
  const denAg = dentro + fora
  rows.push({
    indicador: 'SLA Ciência Agendamentos',
    resultado: denAg ? pctLabel(dentro, denAg) : '—',
    detalhe: `${dentro} dentro · ${fora} fora`,
    bgColor: denAg && dentro / denAg >= 0.95 ? GREEN_SOFT : RED_SOFT,
  })

  const vr = vistagemCounts(data.vistagemRisco.resumo, data.vistagemRisco.linhas)
  const vn = vistagemCounts(data.vistagemNormal.resumo, data.vistagemNormal.linhas)
  const denVr = vr.sim + vr.nao
  const denVn = vn.sim + vn.nao
  rows.push({
    indicador: 'SLA Vistagem Risco',
    resultado: denVr ? pctLabel(vr.sim, denVr) : '—',
    detalhe: `${vr.sim} Sim · ${vr.nao} Não`,
    bgColor: denVr && vr.sim / denVr >= 0.98 ? GREEN_SOFT : RED_SOFT,
  })
  rows.push({
    indicador: 'SLA Vistagem Normal',
    resultado: denVn ? pctLabel(vn.sim, denVn) : '—',
    detalhe: `${vn.sim} Sim · ${vn.nao} Não`,
    bgColor: denVn && vn.sim / denVn >= 0.98 ? GREEN_SOFT : RED_SOFT,
  })
  rows.push({
    indicador: 'Desenvolvimento Equipe',
    resultado: `${data.desenvolvimento.linhas.length} lançamentos`,
    detalhe: 'Baixar racional (Excel)',
    bgColor: BRAND_SOFT,
  })

  const gp = data.gestaoPdiMensal
  const gpPct =
    gp?.pct_aptas != null
      ? `${gp.pct_aptas.toFixed(2).replace('.', ',')}%`
      : gp && gp.elegiveis > 0
        ? formatPercent(Math.round((gp.aptas / gp.elegiveis) * 10000) / 100)
        : '—'
  rows.push({
    indicador: 'Gestão de PDI',
    resultado: gpPct,
    detalhe: gp
      ? `${gp.aptas} aptas · ${gp.desvios} desvios · ${gp.elegiveis} elegíveis`
      : 'Baixar racional (Excel)',
    bgColor: gp && gp.pct_aptas != null && gp.pct_aptas >= 100 ? GREEN_SOFT : gp ? RED_SOFT : BRAND_SOFT,
  })

  const rt = data.retencaoAnual
  const rtPct = rt != null ? `${rt.pct_retencao.toFixed(2).replace('.', ',')}%` : '—'
  rows.push({
    indicador: 'Retenção de Talentos',
    resultado: rtPct,
    detalhe: rt
      ? `${rt.funcionarios_ativos} ativos · ${rt.saidas_voluntarias} saídas voluntárias`
      : 'Baixar racional (Excel)',
    bgColor: rt && rt.pct_retencao >= rt.meta_pct_retencao_minima ? GREEN_SOFT : rt ? RED_SOFT : BRAND_SOFT,
  })

  return rows
}

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
