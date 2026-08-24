import { formatCurrency, formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_PDI,
  EFICIENCIA_META_RECEITA_BRUTA,
} from '../constants'
import type {
  GestaoPdiMesRow,
  RacionalIndicador,
  RacionalResumo,
  TreinamentosAnualRow,
} from '../types/eficiencia.types'
import type { IndicadoresResultadoMes } from '../types/indicadoresResultado.types'
import { countVistagemD1 } from './racionalFormat'

export type IndicadorOperacionalRow = {
  indicador: string
  resultado: string
  detalhe: string
  bgColor: string
  racionalSlug?: RacionalIndicador
}

const GREEN_SOFT = '#E8F5E9'
const RED_SOFT = '#FFEBEE'
const BRAND_SOFT = '#D6EAF5'

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

/** Ciclo PDI aberto só no mês corrente; meses anteriores já estão fechados. */
export function isMesCorrenteIndicadores(
  ano: number,
  mes: number,
  ref = new Date(),
): boolean {
  return ano === ref.getFullYear() && mes === ref.getMonth() + 1
}

/** Mês padrão do Excel gerencial = mês anterior (dentro do ano selecionado). */
export function mesPadraoIndicadoresResultado(ano: number, ref = new Date()): number {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  if (ano < y) return 12
  if (ano > y) return 1
  return m <= 1 ? 1 : m - 1
}

function formatMinutosHoras(minutos: number): string {
  const total = Math.max(0, Math.round(minutos))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function buildDesenvolvimentoEquipeRow(
  dev: TreinamentosAnualRow | null,
): IndicadorOperacionalRow {
  const devResultado =
    dev && dev.meta_minutos > 0
      ? `${formatMinutosHoras(dev.minutos_lancados)}h / ${formatMinutosHoras(dev.meta_minutos)}h (${formatPercent(dev.pct_atingimento)})`
      : dev
        ? `${formatMinutosHoras(dev.minutos_lancados)}h`
        : '—'

  return {
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
  }
}

function buildGestaoPdiRow(
  gp: GestaoPdiMesRow | null,
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
      bgColor: gp.pct_aptas >= EFICIENCIA_META_PDI ? GREEN_SOFT : RED_SOFT,
    }
  }

  if (gp && gp.elegiveis > 0) {
    const pct = (gp.aptas / gp.elegiveis) * 100
    return {
      indicador: 'Gestão de PDI',
      resultado: formatPercent(pct),
      detalhe: `${gp.aptas} aptas · ${gp.desvios} desvios · ${gp.elegiveis} elegíveis`,
      bgColor: pct >= EFICIENCIA_META_PDI ? GREEN_SOFT : RED_SOFT,
    }
  }

  return {
    indicador: 'Gestão de PDI',
    resultado: '—',
    detalhe: 'Baixar racional (Excel)',
    bgColor: BRAND_SOFT,
  }
}

/** Linhas da tabela Indicadores Resultado (RESULTADO + e-mail). */
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
  let exclAg = 0
  for (const row of data.agendamento.linhas) {
    if (row.excludente === 'Excludente') {
      exclAg += 1
      continue
    }
    if (String(row.fatal_sem18_d1 ?? '').toLowerCase().includes('fora')) fora += 1
    else dentro += 1
  }
  const denAg = dentro + fora
  rows.push({
    indicador: 'SLA Ciência Agendamentos',
    resultado: denAg ? pctLabel(dentro, denAg) : '—',
    detalhe: `${dentro} dentro · ${fora} fora${exclAg ? ` · ${exclAg} excludentes` : ''}`,
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
  rows.push(buildDesenvolvimentoEquipeRow(data.desenvolvimentoAnual))

  rows.push(buildGestaoPdiRow(data.gestaoPdiMensal, data.ano, data.mes))

  const fin = data.financeiro
  if (fin?.receitaBrutaPct != null) {
    rows.push({
      indicador: 'Receita Bruta',
      resultado: formatPercent(fin.receitaBrutaPct),
      detalhe:
        fin.recebido != null && fin.meta != null
          ? `${formatCurrency(fin.recebido)} recebido · meta ${formatCurrency(fin.meta)}`
          : 'Baixar racional (Excel)',
      bgColor: fin.receitaBrutaPct >= EFICIENCIA_META_RECEITA_BRUTA ? GREEN_SOFT : RED_SOFT,
    })
  }

  if (fin?.inadimplenciaPct != null) {
    rows.push({
      indicador: 'Índice de Inadimplência',
      resultado: formatPercent(fin.inadimplenciaPct),
      detalhe:
        fin.inadimplencia != null && fin.previsto != null
          ? `${formatCurrency(fin.inadimplencia)} inad. · previsto ${formatCurrency(fin.previsto)}`
          : 'Baixar racional (Excel)',
      bgColor:
        fin.inadimplenciaPct <= EFICIENCIA_META_INDICE_INADIMPLENCIA ? GREEN_SOFT : RED_SOFT,
    })
  }

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
