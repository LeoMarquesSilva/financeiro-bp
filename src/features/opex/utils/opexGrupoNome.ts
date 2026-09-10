import type { OpexGrupoRow } from '../types/opex.types'

export function opexGrupoChave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR')
}

export function opexGrupoLabel(nome: string): string {
  return nome.trim().toLocaleUpperCase('pt-BR')
}

function uniqueNomes(nomes: Array<string | undefined>): string[] {
  return [...new Set(nomes.map((n) => n?.trim()).filter((n): n is string => Boolean(n)))]
}

/** Junta grafias do mesmo grupo (ÇãO vs ÇÃO) para não parecer duas categorias. */
export function mergeGruposEncoding(grupos: OpexGrupoRow[]): OpexGrupoRow[] {
  const map = new Map<string, OpexGrupoRow>()

  for (const g of grupos) {
    const chave = opexGrupoChave(g.grupo_conta)
    const existing = map.get(chave)
    if (!existing) {
      map.set(chave, {
        ...g,
        grupo_conta: opexGrupoLabel(g.grupo_conta),
        aliases: uniqueNomes([g.grupo_conta, ...(g.aliases ?? [])]),
      })
      continue
    }

    map.set(chave, {
      grupo_conta: existing.grupo_conta,
      fixo: existing.fixo || g.fixo,
      realizado_ytd: existing.realizado_ytd + g.realizado_ytd,
      previsto_ano: existing.previsto_ano + g.previsto_ano,
      previsto_vios: existing.previsto_vios + g.previsto_vios,
      previsto_vios_futuro: existing.previsto_vios_futuro + g.previsto_vios_futuro,
      previsto_restante: existing.previsto_restante + g.previsto_restante,
      projetado_ano: existing.projetado_ano + g.projetado_ano,
      aliases: uniqueNomes([...(existing.aliases ?? []), g.grupo_conta, ...(g.aliases ?? [])]),
    })
  }

  return [...map.values()].sort((a, b) => b.realizado_ytd - a.realizado_ytd)
}

export function gruposConsulta(grupo: string, aliases?: string[]): string[] {
  const nomes = uniqueNomes([grupo, ...(aliases ?? [])])
  return nomes.length ? nomes : [grupo]
}
