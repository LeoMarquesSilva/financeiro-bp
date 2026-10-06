import {
  isDiaFiltro,
  isSemanaFiltro,
  mesNoFiltro,
  rangeDiaFiltro,
  rangeSemanaFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import type { TreinamentoItemRow, TreinamentosPorPessoaRow } from '../types/eficiencia.types'
import { matchNomeChaveNaEquipe } from './responsavelMatch'
import { dedupeTreinamentoItens } from './treinamentosDedupe'

/** Presença entra no filtro de mês, Resultado, semana ou De/Até. `null` = ano inteiro. */
export function treinamentoDataNoFiltro(
  data: string | null | undefined,
  filtro: MesFiltroEficiencia,
  ano: number,
): boolean {
  if (filtro == null) return true
  const iso = String(data ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  if (isSemanaFiltro(filtro)) {
    const { inicio, fimExclusivo } = rangeSemanaFiltro(filtro)
    return iso >= inicio && iso < fimExclusivo
  }
  if (isDiaFiltro(filtro)) {
    const { inicio, fimExclusivo } = rangeDiaFiltro(filtro)
    return iso >= inicio && iso < fimExclusivo
  }
  if (Number(iso.slice(0, 4)) !== ano) return false
  return mesNoFiltro(Number(iso.slice(5, 7)), filtro, ano)
}

export function filtrarItensTreinamentoPorFiltro<T extends { data?: string | null }>(
  itens: T[],
  filtro: MesFiltroEficiencia,
  ano: number,
): T[] {
  if (filtro == null) return itens
  return itens.filter((item) => treinamentoDataNoFiltro(item.data, filtro, ano))
}

/** Troca os minutos anuais pelos lançamentos que caem no período. A meta individual permanece a do ano. */
export function aplicarMinutosTreinamentoPeriodo(
  porPessoa: TreinamentosPorPessoaRow[],
  itens: TreinamentoItemRow[],
): TreinamentosPorPessoaRow[] {
  const nomes = porPessoa.map((p) => p.colaborador)
  const minutos = new Map<string, number>()
  for (const item of dedupeTreinamentoItens(itens)) {
    const key = matchNomeChaveNaEquipe(item.colaborador, nomes)
    if (!key) continue
    const min = Number(item.duracao_minutos ?? 0)
    if (!Number.isFinite(min) || min <= 0) continue
    minutos.set(key, (minutos.get(key) ?? 0) + min)
  }
  return porPessoa.map((pessoa) => {
    const key = matchNomeChaveNaEquipe(pessoa.colaborador, nomes)
    return {
      ...pessoa,
      minutos_lancados: key ? (minutos.get(key) ?? 0) : 0,
    }
  })
}
