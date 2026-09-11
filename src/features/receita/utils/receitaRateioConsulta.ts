import { GRUPO_SEM_NOME } from '@/features/escritorio/services/escritorioService'
import { RECEITA_META_CONTRIBUICAO_AREA } from '../constants'
import type { ReceitaPrevistoItemRow } from '../types/receita.types'
import { departamentoMatchesAreaKey } from './receitaInadimplenciaAreaFilter'
import { resolverGrupoCliente } from './recebidoGrupos'

export const RECEITA_RATEIO_OUTRAS_KEY = 'outras'

export type ReceitaRateioGrupoRow = {
  grupo_cliente: string
  total: number
  quantidadeTitulos: number
  pctPorArea: Record<string, number>
  valorPorArea: Record<string, number>
}

export function areaKeyForDepartamento(departamento: string | null | undefined): string {
  const dept = departamento?.trim()
  if (!dept) return RECEITA_RATEIO_OUTRAS_KEY
  for (const area of RECEITA_META_CONTRIBUICAO_AREA) {
    if (departamentoMatchesAreaKey(dept, area.key)) return area.key
  }
  return RECEITA_RATEIO_OUTRAS_KEY
}

/** Sem grupo cadastrado → razão social (não balde único). */
export function chaveGrupoRateio(
  cliente: string | null | undefined,
  clienteGrupoMap: Map<string, string>,
): string {
  const grupo = resolverGrupoCliente(cliente, clienteGrupoMap)
  if (grupo === GRUPO_SEM_NOME) {
    return cliente?.trim() || 'Sem cliente'
  }
  return grupo
}

export function agruparRateioPorGrupo(
  itens: ReceitaPrevistoItemRow[],
  clienteGrupoMap: Map<string, string>,
): ReceitaRateioGrupoRow[] {
  const areaKeys = [
    ...RECEITA_META_CONTRIBUICAO_AREA.map((a) => a.key),
    RECEITA_RATEIO_OUTRAS_KEY,
  ]
  const byGrupo = new Map<
    string,
    { total: number; titulos: Set<number>; valorPorArea: Record<string, number> }
  >()

  for (const item of itens) {
    const grupo = chaveGrupoRateio(item.cliente, clienteGrupoMap)
    const area = areaKeyForDepartamento(item.departamento)
    const cur = byGrupo.get(grupo) ?? {
      total: 0,
      titulos: new Set<number>(),
      valorPorArea: Object.fromEntries(areaKeys.map((k) => [k, 0])),
    }
    const valor = Number(item.valor_item) || 0
    cur.total += valor
    cur.titulos.add(item.ci_titulo)
    cur.valorPorArea[area] = (cur.valorPorArea[area] ?? 0) + valor
    byGrupo.set(grupo, cur)
  }

  return [...byGrupo.entries()]
    .map(([grupo_cliente, v]) => ({
      grupo_cliente,
      total: v.total,
      quantidadeTitulos: v.titulos.size,
      pctPorArea: Object.fromEntries(
        Object.entries(v.valorPorArea).map(([k, valor]) => [
          k,
          v.total > 0 ? (valor / v.total) * 100 : 0,
        ]),
      ),
      valorPorArea: v.valorPorArea,
    }))
    .sort((a, b) => a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR'))
}
