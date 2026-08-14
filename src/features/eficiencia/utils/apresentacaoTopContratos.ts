import { GRUPO_SEM_NOME } from '@/features/escritorio/services/escritorioService'
import { receitaService } from '@/features/receita/services/receitaService'
import {
  buildClienteGrupoMap,
  resolverGrupoCliente,
} from '@/features/receita/utils/recebidoGrupos'
import {
  isMesesFiltro,
  mesFimResultado,
  type MesFiltroEficiencia,
} from '../constants'

/** Mês de referência para ranquear contratos (previsto do mês). */
export function mesReferenciaTopContratos(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  ref = new Date(),
): number {
  if (isMesesFiltro(mesFiltro) && mesFiltro.length > 0) {
    return Math.max(...mesFiltro)
  }
  const fim = mesFimResultado(ano, ref)
  return fim >= 1 ? fim : 1
}

/** "Grupo Metalcasty" → "Metalcasty" (rótulo limpo no PPT). */
export function labelContratoApresentacao(nome: string): string {
  const t = nome.trim()
  if (!t) return '—'
  const stripped = t.replace(/^grupo\s+/i, '').trim()
  return stripped || t
}

function chaveContrato(
  cliente: string | null | undefined,
  clienteGrupoMap: Map<string, string>,
): string {
  const grupo = resolverGrupoCliente(cliente, clienteGrupoMap)
  if (grupo && grupo !== GRUPO_SEM_NOME) return grupo
  const c = cliente?.trim()
  return c && c.length > 0 ? c : ''
}

/**
 * Top N grupos/clientes por valor previsto (honorários) no mês — proxy do
 * tamanho do contrato no escritório. Retorna só os nomes (ordenados desc).
 */
export async function fetchApresentacaoTopContratos(
  ano: number,
  mes: number,
  limit = 5,
): Promise<string[]> {
  const [itens, empresas] = await Promise.all([
    receitaService.fetchPrevistoMesItens(ano, mes),
    receitaService.fetchEmpresasNomeGrupo(),
  ])
  const clienteGrupoMap = buildClienteGrupoMap(empresas)
  const byGrupo = new Map<string, number>()

  for (const item of itens) {
    const chave = chaveContrato(item.cliente, clienteGrupoMap)
    if (!chave) continue
    const v = Number(item.valor_item) || 0
    if (v <= 0) continue
    byGrupo.set(chave, (byGrupo.get(chave) ?? 0) + v)
  }

  return [...byGrupo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nome]) => labelContratoApresentacao(nome))
}
