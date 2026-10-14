import type { OpexGrupoDePara, OpexGrupoRow, OpexNivel1, OpexNivel1Bloco, OpexPlanoContaNivel } from '../types/opex.types'
// Extensão explícita para o node --test resolver (tests/opex-nivel1.test.ts).
import { opexGrupoChave } from './opexGrupoNome.ts'

export const NIVEL1_FORA_DO_PLANO: OpexNivel1 = { codigo: null, nome: 'FORA DO PLANO DE CONTAS' }

/** Nome do grupo da conta (nível 2) → nível 1 do plano de contas. */
export function mapaNivel1PorGrupo(contas: OpexPlanoContaNivel[]): Map<string, OpexNivel1> {
  const raizes = new Map(contas.filter((c) => c.nivel === 1).map((c) => [c.n1, c.nome]))
  const mapa = new Map<string, OpexNivel1>()
  for (const c of contas) {
    if (c.nivel !== 2) continue
    const nome = raizes.get(c.n1)
    if (nome) mapa.set(opexGrupoChave(c.nome), { codigo: c.n1, nome })
  }
  return mapa
}

/**
 * Casa o grupo pelo nome (e grafias) com o plano vigente; grupos de anos com
 * plano antigo (ex.: "Despesas com pessoal" em 2025) usam o destino do De × Para.
 */
export function nivel1DoGrupo(
  grupo: OpexGrupoRow,
  mapa: Map<string, OpexNivel1>,
  dePara: OpexGrupoDePara[] = [],
): OpexNivel1 {
  const nomes = [grupo.grupo_conta, ...(grupo.aliases ?? [])].map(opexGrupoChave)
  for (const nome of nomes) {
    const nivel1 = mapa.get(nome)
    if (nivel1) return nivel1
  }
  for (const linha of dePara) {
    if (!nomes.includes(opexGrupoChave(linha.nomeOrigem))) continue
    const nivel1 = mapa.get(opexGrupoChave(linha.nomeDestino))
    if (nivel1) return nivel1
  }
  return NIVEL1_FORA_DO_PLANO
}

function somarGrupos(nome: string, grupos: OpexGrupoRow[]): OpexGrupoRow {
  const total: OpexGrupoRow = {
    grupo_conta: nome,
    fixo: false,
    realizado_ytd: 0,
    previsto_ano: 0,
    previsto_vios: 0,
    previsto_vios_futuro: 0,
    previsto_restante: 0,
    projetado_ano: 0,
  }
  for (const g of grupos) {
    total.realizado_ytd += g.realizado_ytd
    total.previsto_ano += g.previsto_ano
    total.previsto_vios += g.previsto_vios
    total.previsto_vios_futuro += g.previsto_vios_futuro
    total.previsto_restante += g.previsto_restante
    total.projetado_ano += g.projetado_ano
  }
  return total
}

export function nivel1Chave(nivel1: OpexNivel1): string {
  return nivel1.codigo == null ? 'fora' : String(nivel1.codigo)
}

/** Agrupa os grupos da tabela pelo nível 1, na ordem do plano de contas. */
export function agruparGruposPorNivel1(
  grupos: OpexGrupoRow[],
  contas: OpexPlanoContaNivel[],
  dePara: OpexGrupoDePara[] = [],
): OpexNivel1Bloco[] {
  const mapa = mapaNivel1PorGrupo(contas)
  const blocos = new Map<string, { nivel1: OpexNivel1; grupos: OpexGrupoRow[] }>()

  for (const g of grupos) {
    const nivel1 = nivel1DoGrupo(g, mapa, dePara)
    const chave = nivel1Chave(nivel1)
    const bloco = blocos.get(chave)
    if (bloco) bloco.grupos.push(g)
    else blocos.set(chave, { nivel1, grupos: [g] })
  }

  return [...blocos.values()]
    .map((b) => ({ ...b, total: somarGrupos(b.nivel1.nome, b.grupos) }))
    .sort((a, b) => (a.nivel1.codigo ?? Infinity) - (b.nivel1.codigo ?? Infinity))
}
