import { formatPercent } from '@/shared/utils/format'
import type { HeatCell } from '../components/OverviewKpiHeatRow'
import { mesNoFiltro, type MesFiltroEficiencia } from '../constants'
import type { GestaoPdiDetalheRow, GestaoPdiElegivelRow, GestaoPdiMesRow } from '../types/eficiencia.types'
import { normalizeResponsavelChave } from './responsavelMatch'

/** Progresso do mês anterior na aba Elegíveis (mesmo colaborador). */
export function progressoMesAnteriorElegiveis(
  elegiveis: GestaoPdiElegivelRow[],
  colaborador: string,
  mes: number,
): number | null {
  const alvo = mes - 1
  if (alvo < 1) return null
  const key = normalizeResponsavelChave(colaborador)
  const hit = elegiveis.find(
    (row) =>
      row.mes === alvo &&
      normalizeResponsavelChave(row.colaborador) === key &&
      row.progresso != null,
  )
  return hit == null ? null : Number(hit.progresso)
}

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

export type GestaoPdiPessoaMesCell = {
  mes: number
  /** null = pessoa não elegível naquele mês */
  apta: boolean | null
}

export type GestaoPdiPessoaMesLinha = {
  colaborador: string
  area: string | null
  cells: GestaoPdiPessoaMesCell[]
  aptas: number
  elegiveis: number
  pct: number | null
}

/** Colunas da grade por pessoa: junho (baseline) até o último mês do ano (ou mês corrente). */
export function mesesColunasGestaoPdiPessoas(ano: number, ref = new Date()): number[] {
  const ultimo =
    ref.getFullYear() > ano ? 12 : Math.min(12, Math.max(GESTAO_PDI_MES_BASELINE, ref.getMonth() + 1))
  const meses: number[] = []
  for (let m = GESTAO_PDI_MES_BASELINE; m <= ultimo; m++) meses.push(m)
  return meses
}

/** Uma linha por colaborador; célula 100% / 0% / sem dado. */
export function buildGestaoPdiPessoasMatrix(
  detalhe: GestaoPdiDetalheRow[],
  mesesColunas: number[],
): GestaoPdiPessoaMesLinha[] {
  const porPessoa = new Map<string, GestaoPdiDetalheRow[]>()
  for (const row of detalhe) {
    const list = porPessoa.get(row.colaborador) ?? []
    list.push(row)
    porPessoa.set(row.colaborador, list)
  }

  const linhas: GestaoPdiPessoaMesLinha[] = []
  for (const [colaborador, lista] of porPessoa) {
    const porMes = new Map(lista.map((r) => [r.mes, r]))
    const cells = mesesColunas.map((mes) => {
      const hit = porMes.get(mes)
      return { mes, apta: hit == null ? null : hit.apta }
    })
    const avaliadas = cells.filter((c) => c.apta != null)
    const aptas = avaliadas.filter((c) => c.apta).length
    const elegiveis = avaliadas.length
    const pct =
      elegiveis > 0 ? Math.round((aptas / elegiveis) * 10000) / 100 : null
    linhas.push({
      colaborador,
      area: lista[0]?.area ?? null,
      cells,
      aptas,
      elegiveis,
      pct,
    })
  }

  return linhas.sort((a, b) => {
    const aDesvio = a.cells.some((c) => c.apta === false) ? 0 : 1
    const bDesvio = b.cells.some((c) => c.apta === false) ? 0 : 1
    if (aDesvio !== bDesvio) return aDesvio - bDesvio
    return a.colaborador.localeCompare(b.colaborador, 'pt-BR')
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
