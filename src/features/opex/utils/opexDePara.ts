import type { OpexGrupoDePara, OpexPlanoRow } from '../types/opex.types'

export function mapaDePara(linhas: OpexGrupoDePara[]): Map<string, string> {
  return new Map(linhas.map((l) => [l.nomeOrigem, l.nomeDestino]))
}

/** Grupos do ano origem que alimentam o grupo atual (inclui o próprio nome). */
export function origensDoDestino(linhas: OpexGrupoDePara[], destino: string): string[] {
  const origens = linhas.filter((l) => l.nomeDestino === destino).map((l) => l.nomeOrigem)
  return [...new Set([destino, ...origens])]
}

type LinhaMapeavel = {
  key: string
  label: string
  previsto?: number
  realizado: number
  variacao?: number
}

/** Renomeia e soma grupos do ano anterior conforme o De × Para. */
export function aplicarDeParaLinhas<T extends LinhaMapeavel>(rows: T[], linhas: OpexGrupoDePara[]): T[] {
  if (!linhas.length) return rows
  const mapa = mapaDePara(linhas)
  const byDest = new Map<string, T>()

  for (const row of rows) {
    const dest = mapa.get(row.key) ?? row.key
    const existing = byDest.get(dest)
    if (!existing) {
      byDest.set(dest, { ...row, key: dest, label: dest })
      continue
    }
    byDest.set(dest, {
      ...existing,
      previsto: (existing.previsto ?? 0) + (row.previsto ?? 0),
      realizado: existing.realizado + row.realizado,
      variacao: (existing.variacao ?? 0) + (row.variacao ?? 0),
    })
  }

  return [...byDest.values()]
}

export function mergePlanosGrupo(batches: OpexPlanoRow[]): OpexPlanoRow[] {
  const map = new Map<string, OpexPlanoRow>()
  for (const plano of batches) {
    const existing = map.get(plano.plano_contas)
    if (!existing) {
      map.set(plano.plano_contas, { ...plano })
      continue
    }
    map.set(plano.plano_contas, {
      ...existing,
      realizado_ytd: existing.realizado_ytd + plano.realizado_ytd,
      previsto_ano: existing.previsto_ano + plano.previsto_ano,
      previsto_vios: existing.previsto_vios + plano.previsto_vios,
    })
  }
  return [...map.values()]
}
