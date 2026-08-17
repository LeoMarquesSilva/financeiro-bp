import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_AREA_OPS_LEGAIS,
  MESES_EFICIENCIA,
  isMesesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type { TreinamentoItemRow } from '../types/eficiencia.types'
import {
  buildOpsTreinamentosCategorias,
  type OpsTreinamentoPessoaDetalhe,
} from './opsTreinamentosCategorias'
import { metaTreinamentoMinutosProporcional } from './treinamentoMetaProporcional'
import { dedupeTreinamentoItens } from './treinamentosDedupe'

export type ApresentacaoLiderancaMesCell = {
  mes: number
  mesLabel: string
  value: number | null
  label: string
  atingiu: boolean | null
}

export type ApresentacaoLiderancaTreinamento = {
  nome: string
  horasLabel: string
  minutos: number
}

export type ApresentacaoLiderancaPessoa = {
  colaborador: string
  minutos: number
  horasLabel: string
  treinamentos: ApresentacaoLiderancaTreinamento[]
}

export type ApresentacaoLiderancaData = {
  qtdPessoas: number
  metaMinutos: number
  metaHorasLabel: string
  minutos: number
  horasRealizadasLabel: string
  pctAtingimento: number | null
  acumuladoLabel: string
  atingiu: boolean | null
  meses: ApresentacaoLiderancaMesCell[]
  pessoas: ApresentacaoLiderancaPessoa[]
}

function normalizeNome(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleUpperCase('pt-BR')
    .replace(/\s+/g, ' ')
}

function mesFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null
  const m = Number(String(iso).slice(5, 7))
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null
}

function formatHorasColon(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}hrs`
}

function formatHorasParens(minutos: number): string {
  const h = Math.round((minutos / 60) * 100) / 100
  if (Number.isInteger(h)) return `${h}h`
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`
}

function formatHorasMeta(minutos: number): string {
  return `${Math.floor(minutos / 60)}h`
}

function formatHorasRealizadas(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}h ${String(m).padStart(2, '0')}min`
}

function itensDaPessoa(
  itens: TreinamentoItemRow[],
  colaborador: string,
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): TreinamentoItemRow[] {
  const key = normalizeNome(colaborador)
  return itens
    .filter((i) => normalizeNome(i.colaborador) === key)
    .filter((i) => {
      const mes = mesFromIso(i.data)
      if (mes == null) return false
      return mesNoFiltro(mes, mesFiltro, ano)
    })
    .sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')))
}

function agregarTreinamentos(
  itens: TreinamentoItemRow[],
): ApresentacaoLiderancaTreinamento[] {
  const map = new Map<string, number>()
  for (const i of dedupeTreinamentoItens(itens)) {
    const nome = String(i.treinamento ?? '').trim() || 'Treinamento'
    const min = Number(i.duracao_minutos ?? 0)
    if (!Number.isFinite(min) || min <= 0) continue
    map.set(nome, (map.get(nome) ?? 0) + min)
  }
  return [...map.entries()]
    .map(([nome, minutos]) => ({
      nome,
      minutos,
      horasLabel: formatHorasParens(minutos),
    }))
    .sort((a, b) => b.minutos - a.minutos)
}

function minutosYtdAte(
  lideres: OpsTreinamentoPessoaDetalhe[],
  itens: TreinamentoItemRow[],
  mesAte: number,
): number {
  const keys = new Set(lideres.map((p) => normalizeNome(p.colaborador)))
  let total = 0
  for (const i of dedupeTreinamentoItens(itens)) {
    const key = normalizeNome(i.colaborador)
    if (!keys.has(key)) continue
    const mes = mesFromIso(i.data)
    if (mes == null || mes > mesAte) continue
    const min = Number(i.duracao_minutos ?? 0)
    if (!Number.isFinite(min) || min <= 0) continue
    total += min
  }
  return total
}

function minutosNoFiltro(
  lideres: OpsTreinamentoPessoaDetalhe[],
  itens: TreinamentoItemRow[],
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): number {
  const keys = new Set(lideres.map((p) => normalizeNome(p.colaborador)))
  let total = 0
  for (const i of dedupeTreinamentoItens(itens)) {
    const key = normalizeNome(i.colaborador)
    if (!keys.has(key)) continue
    const mes = mesFromIso(i.data)
    if (mes == null || !mesNoFiltro(mes, mesFiltro, ano)) continue
    const min = Number(i.duracao_minutos ?? 0)
    if (!Number.isFinite(min) || min <= 0) continue
    total += min
  }
  return total
}

export function buildApresentacaoLideranca(
  ativos: Array<{ nome: string; cargo: string | null; admissao?: string | null }>,
  itens: TreinamentoItemRow[],
  mesFiltro: MesFiltroEficiencia,
  ano: number,
): ApresentacaoLiderancaData {
  const { resumos, pessoas } = buildOpsTreinamentosCategorias(ativos, itens, ano)
  const resumo = resumos.find((r) => r.categoria === 'Liderança')
  const lideres = pessoas.filter((p) => p.categoria === 'Liderança')
  const qtdPessoas = resumo?.qtdPessoas ?? lideres.length
  const metaMinutos =
    resumo?.metaMinutos ??
    lideres.reduce((s, p) => s + metaTreinamentoMinutosProporcional(p.admissao, ano), 0)

  const minutos =
    mesFiltro == null
      ? (resumo?.minutos ?? 0)
      : minutosNoFiltro(lideres, itens, mesFiltro, ano)

  const pctAtingimento =
    metaMinutos > 0 ? Math.round((minutos / metaMinutos) * 10000) / 100 : null
  const atingiu = pctAtingimento == null ? null : pctAtingimento >= 100

  const mesesBase =
    isMesesFiltro(mesFiltro) && mesFiltro.length > 0
      ? [...mesFiltro].sort((a, b) => a - b)
      : Array.from({ length: 12 }, (_, i) => i + 1).filter((m) =>
          mesNoFiltro(m, mesFiltro, ano),
        )

  const meses: ApresentacaoLiderancaMesCell[] = mesesBase.map((mes) => {
    const ytd = minutosYtdAte(lideres, itens, mes)
    if (ytd <= 0 && metaMinutos <= 0) {
      return {
        mes,
        mesLabel: MESES_EFICIENCIA[mes - 1] ?? String(mes),
        value: null,
        label: '-',
        atingiu: null,
      }
    }
    if (ytd <= 0) {
      return {
        mes,
        mesLabel: MESES_EFICIENCIA[mes - 1] ?? String(mes),
        value: null,
        label: '-',
        atingiu: null,
      }
    }
    const pct =
      metaMinutos > 0 ? Math.round((ytd / metaMinutos) * 10000) / 100 : null
    return {
      mes,
      mesLabel: MESES_EFICIENCIA[mes - 1] ?? String(mes),
      value: pct,
      label: pct == null ? '-' : formatPercent(pct),
      atingiu: pct == null ? null : pct >= 100,
    }
  })

  const pessoasOut: ApresentacaoLiderancaPessoa[] = lideres
    .map((p) => {
      const itensPessoa = itensDaPessoa(itens, p.colaborador, mesFiltro, ano)
      const minutosPessoa =
        mesFiltro == null
          ? p.minutos
          : itensPessoa.reduce((s, i) => s + (Number(i.duracao_minutos) || 0), 0)
      return {
        colaborador: p.colaborador,
        minutos: minutosPessoa,
        horasLabel: formatHorasColon(minutosPessoa),
        treinamentos: agregarTreinamentos(itensPessoa),
      }
    })
    .filter((p) => p.minutos > 0 || mesFiltro == null)
    .sort((a, b) => b.minutos - a.minutos)

  return {
    qtdPessoas,
    metaMinutos,
    metaHorasLabel: formatHorasMeta(metaMinutos),
    minutos,
    horasRealizadasLabel: formatHorasRealizadas(minutos),
    pctAtingimento,
    acumuladoLabel: pctAtingimento == null ? '-' : formatPercent(pctAtingimento),
    atingiu,
    meses,
    pessoas: pessoasOut,
  }
}

export async function fetchApresentacaoLideranca(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
): Promise<ApresentacaoLiderancaData> {
  const [ativos, itens] = await Promise.all([
    eficienciaService.fetchTurnoverAtivosArea(ano, EFICIENCIA_AREA_OPS_LEGAIS),
    eficienciaService.fetchTreinamentosItens(ano),
  ])
  return buildApresentacaoLideranca(ativos, itens, mesFiltro, ano)
}
