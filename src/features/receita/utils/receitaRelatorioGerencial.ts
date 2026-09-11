import { receitaService } from '../services/receitaService'
import { departamentoMatchesAreaKey } from './receitaInadimplenciaAreaFilter'
import { labelPlanoContas } from './planoContasLabel'
import { buildClienteGrupoMap, resolverGrupoCliente } from './recebidoGrupos'
import {
  itemVencimentoVencidoAteCorte,
  refDateCorteInadMes,
} from './receitaPrevistoFechamento'
import {
  chaveGrupoRelatorioGerencial,
  type RelatorioGerencialGrupo,
} from './receitaRelatorioGerencialExport'

type PrevistoItemGrupo = {
  cliente: string | null
  departamento?: string | null
  plano_contas?: string | null
  valor_item: number
  data_vencimento?: string | null
  data_pagamento?: string | null
}

function tipoReceitaItem(plano: string | null | undefined): string {
  const label = labelPlanoContas(plano?.trim() ?? '')
  return label || 'Sem plano'
}

/** Agrupa títulos vencidos por grupo e tipo de receita (plano de contas). */
export function agruparPrevistoItensPorChaveGrupo(
  itens: PrevistoItemGrupo[],
  clienteGrupoMap: Map<string, string>,
  ano: number,
  mes: number,
): RelatorioGerencialGrupo[] {
  const corte = refDateCorteInadMes(ano, mes)
  const map = new Map<string, RelatorioGerencialGrupo>()

  for (const item of itens) {
    if (!itemVencimentoVencidoAteCorte(item.data_vencimento, corte)) continue
    const cliente = item.cliente?.trim() || 'Sem cliente'
    const grupoCadastro = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const grupo = chaveGrupoRelatorioGerencial(grupoCadastro, cliente)
    const tipo_receita = tipoReceitaItem(item.plano_contas)
    const chave = `${grupo}\t${tipo_receita}`
    const cur = map.get(chave) ?? {
      grupo_cliente: grupo,
      tipo_receita,
      faturado: 0,
      recebido: 0,
      inadimplencia: 0,
    }
    const valor = Number(item.valor_item) || 0
    cur.faturado += valor
    if (item.data_pagamento?.trim()) cur.recebido += valor
    map.set(chave, cur)
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      inadimplencia: Math.max(0, g.faturado - g.recebido),
    }))
    .filter((g) => g.faturado > 0 || g.recebido > 0)
    .sort(
      (a, b) =>
        b.faturado - a.faturado ||
        a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR') ||
        a.tipo_receita.localeCompare(b.tipo_receita, 'pt-BR'),
    )
}

/** `areaKey` nulo = todas as áreas. */
export async function carregarRelatorioGerencialGrupos(
  ano: number,
  mes: number,
  areaKey: string | null,
): Promise<RelatorioGerencialGrupo[]> {
  const [itens, empresas] = await Promise.all([
    receitaService.fetchPrevistoMesItens(ano, mes),
    receitaService.fetchEmpresasNomeGrupo(),
  ])
  const filtrados = areaKey
    ? itens.filter(
        (i) => i.departamento != null && departamentoMatchesAreaKey(i.departamento, areaKey),
      )
    : itens
  return agruparPrevistoItensPorChaveGrupo(
    filtrados,
    buildClienteGrupoMap(empresas),
    ano,
    mes,
  )
}
