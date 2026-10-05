import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'

export const RENTABILIDADE_COPY_LIMITE = 20

export function inicioUltimos3Meses(dataFimIso: string): string {
  const [y, m] = dataFimIso.split('-').map(Number)
  if (!y || !m) return dataFimIso
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 2)
  return d.toISOString().slice(0, 10)
}

export function labelUltimos3Meses(dataFimIso: string): string {
  const inicio = inicioUltimos3Meses(dataFimIso)
  const fmt = (iso: string) => {
    const [yy, mm] = iso.split('-').map(Number)
    const nomes = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ]
    return `${nomes[(mm ?? 1) - 1]}/${String(yy).slice(-2)}`
  }
  return `${fmt(inicio)} – ${fmt(dataFimIso)}`
}

export function normalizarChaveGrupoRentabilidade(nome: string): string {
  return nome.trim().toLowerCase()
}

export function buildGruposComFaturamentoSet(chaves: string[] | undefined): Set<string> {
  const set = new Set<string>()
  for (const c of chaves ?? []) {
    const t = c.trim()
    if (t) set.add(normalizarChaveGrupoRentabilidade(t))
  }
  return set
}

export function rankingRentabilidadeParaCopia(
  linhas: RentabilidadeContratoLinha[],
  gruposComFaturamento: Set<string>,
  dir: 'desc' | 'asc',
  limit = RENTABILIDADE_COPY_LIMITE,
): RentabilidadeContratoLinha[] {
  const eligible = linhas.filter((l) => {
    if (l.valor_hora_efetivo == null || !Number.isFinite(l.valor_hora_efetivo)) return false
    if (gruposComFaturamento.size === 0) return false
    return gruposComFaturamento.has(normalizarChaveGrupoRentabilidade(l.cliente))
  })
  return [...eligible]
    .sort((a, b) => {
      const cmp = (a.valor_hora_efetivo ?? 0) - (b.valor_hora_efetivo ?? 0)
      if (cmp === 0) return a.cliente.localeCompare(b.cliente, 'pt-BR')
      return dir === 'desc' ? -cmp : cmp
    })
    .slice(0, limit)
}
