import { formatPercent } from '@/shared/utils/format'
import type { HeatCell } from '../components/OverviewKpiHeatRow'
import { mesNoFiltro, type MesFiltroEficiencia } from '../constants'
import type { GestaoPdiDetalheRow, GestaoPdiElegivelRow, GestaoPdiMesRow } from '../types/eficiencia.types'

/** Junho = baseline 100% (regra de negócio validada). */
export const GESTAO_PDI_MES_BASELINE = 6

function evidenciasOk(v: string | null | undefined): boolean {
  return String(v ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR') === 'sim'
}

/** Avalia apta/desvio por colaborador × mês (mesma regra da RPC). */
export function avaliarGestaoPdi(
  rows: GestaoPdiElegivelRow[],
  area: string | null = null,
): GestaoPdiDetalheRow[] {
  const filtrados = area ? rows.filter((r) => r.area === area) : rows
  const porPessoa = new Map<string, GestaoPdiElegivelRow[]>()
  for (const r of filtrados) {
    const list = porPessoa.get(r.colaborador) ?? []
    list.push(r)
    porPessoa.set(r.colaborador, list)
  }

  const out: GestaoPdiDetalheRow[] = []
  for (const [, lista] of porPessoa) {
    const ordenada = [...lista].sort((a, b) => a.mes - b.mes)
    for (let i = 0; i < ordenada.length; i++) {
      const cur = ordenada[i]!
      const ant = i > 0 ? ordenada[i - 1]! : null
      const progressoAnterior = ant?.progresso ?? null
      const mudouProgresso =
        progressoAnterior != null && Number(cur.progresso) !== Number(progressoAnterior)
      const temEvidencia = evidenciasOk(cur.evidencias_execucao)
      const tem1a1 = Number(cur.one_a_one ?? 0) >= 1
      const apta =
        cur.mes === GESTAO_PDI_MES_BASELINE
          ? true
          : mudouProgresso && temEvidencia && tem1a1
      out.push({
        mes: cur.mes,
        area: cur.area,
        colaborador: cur.colaborador,
        estrutura: cur.estrutura,
        progresso: cur.progresso == null ? null : Number(cur.progresso),
        progresso_anterior: progressoAnterior == null ? null : Number(progressoAnterior),
        evidencias_execucao: cur.evidencias_execucao,
        one_a_one: cur.one_a_one == null ? null : Number(cur.one_a_one),
        mudou_progresso: mudouProgresso,
        tem_evidencia: temEvidencia,
        tem_1a1: tem1a1,
        apta,
        status: apta ? 'Apta' : 'Desvio',
      })
    }
  }
  return out.sort((a, b) => a.mes - b.mes || a.colaborador.localeCompare(b.colaborador, 'pt-BR'))
}

export function agregarGestaoPdiMensal(detalhe: GestaoPdiDetalheRow[]): GestaoPdiMesRow[] {
  const porMes = new Map<number, GestaoPdiDetalheRow[]>()
  for (const d of detalhe) {
    const list = porMes.get(d.mes) ?? []
    list.push(d)
    porMes.set(d.mes, list)
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => a - b)
    .map(([mes, list]) => {
      const elegiveis = list.length
      const aptas = list.filter((r) => r.apta).length
      const desvios = elegiveis - aptas
      const pct_aptas =
        mes === GESTAO_PDI_MES_BASELINE
          ? 100
          : elegiveis > 0
            ? Math.round((aptas / elegiveis) * 10000) / 100
            : null
      return { mes, elegiveis, aptas, desvios, pct_aptas }
    })
}

export function buildGestaoPdiCells(mensal: GestaoPdiMesRow[]): HeatCell[] {
  const porMes = new Map(mensal.map((r) => [r.mes, r]))
  return Array.from({ length: 12 }, (_, i) => {
    const row = porMes.get(i + 1)
    if (!row || row.pct_aptas == null) return { value: null, label: '-' }
    return { value: row.pct_aptas, label: formatPercent(row.pct_aptas) }
  })
}

/** Acumulado = Σ aptas / Σ elegíveis no filtro (Junho conta todos como aptos). */
export function acumuladoGestaoPdi(
  mensal: GestaoPdiMesRow[],
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): HeatCell {
  const rows = mensal.filter((r) => mesNoFiltro(r.mes, mesFiltro, ano))
  if (rows.length === 0) return { value: null, label: '-' }
  const elegiveis = rows.reduce((s, r) => s + r.elegiveis, 0)
  const aptas = rows.reduce((s, r) => s + r.aptas, 0)
  if (elegiveis <= 0) return { value: null, label: '-' }
  const pct = Math.round((aptas / elegiveis) * 10000) / 100
  return { value: pct, label: formatPercent(pct) }
}
