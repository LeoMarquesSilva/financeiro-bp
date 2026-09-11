import { receitaService } from '../services/receitaService'
import { mesAbrev, mesNome } from '../constants'
import { departamentoMatchesAreaKey } from './receitaInadimplenciaAreaFilter'
import { labelPlanoContas } from './planoContasLabel'
import { buildClienteGrupoMap, resolverGrupoCliente } from './recebidoGrupos'
import {
  itemVencimentoVencidoAteCorte,
  refDateCorteInadMes,
} from './receitaPrevistoFechamento'
import {
  chaveGrupoRelatorioGerencial,
  type RelatorioGerencialLinha,
} from './receitaRelatorioGerencialExport'

type PrevistoItemGrupo = {
  cliente: string | null
  departamento?: string | null
  plano_contas?: string | null
  valor_item: number
  data_vencimento?: string | null
  data_pagamento?: string | null
  mesFonte: number
}

function tipoReceitaItem(plano: string | null | undefined): string {
  const label = labelPlanoContas(plano?.trim() ?? '')
  return label || 'Sem plano'
}

function vencimentoIso(raw: string | null | undefined): string | null {
  const iso = raw?.trim().slice(0, 10)
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

export function periodoRelatorioGerencial(meses: number[]): string {
  const sorted = [...new Set(meses)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return mesNome(sorted[0])
  return sorted.map((m) => mesAbrev(m)).join(', ')
}

function mesDoVencimento(iso: string | null, fallbackMes: number): number {
  if (!iso) return fallbackMes
  const m = Number(iso.slice(5, 7))
  return m >= 1 && m <= 12 ? m : fallbackMes
}

/** Agrupa por grupo × tipo de receita × data de vencimento. */
export function montarLinhasRelatorioGerencial(
  itens: PrevistoItemGrupo[],
  clienteGrupoMap: Map<string, string>,
  ano: number,
): RelatorioGerencialLinha[] {
  const map = new Map<string, RelatorioGerencialLinha>()

  for (const item of itens) {
    const valor = Number(item.valor_item) || 0
    if (valor === 0) continue
    const cliente = item.cliente?.trim() || 'Sem cliente'
    const grupoCadastro = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const grupo = chaveGrupoRelatorioGerencial(grupoCadastro, cliente)
    const data_vencimento = vencimentoIso(item.data_vencimento)
    const tipo_receita = tipoReceitaItem(item.plano_contas)
    const pago = Boolean(item.data_pagamento?.trim())
    const mesItem = mesDoVencimento(data_vencimento, item.mesFonte)
    const corte = refDateCorteInadMes(ano, mesItem)
    const inadimplencia =
      !pago && itemVencimentoVencidoAteCorte(item.data_vencimento, corte) ? valor : 0
    const chave = `${grupo}\0${tipo_receita}\0${data_vencimento ?? ''}`
    const cur = map.get(chave)
    if (cur) {
      cur.faturado += valor
      cur.recebido += pago ? valor : 0
      cur.inadimplencia += inadimplencia
    } else {
      map.set(chave, {
        grupo_cliente: grupo,
        tipo_receita,
        data_vencimento,
        faturado: valor,
        recebido: pago ? valor : 0,
        inadimplencia,
      })
    }
  }

  return [...map.values()].sort((a, b) => {
    const da = a.data_vencimento ?? ''
    const db = b.data_vencimento ?? ''
    return (
      da.localeCompare(db) ||
      a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR') ||
      a.tipo_receita.localeCompare(b.tipo_receita, 'pt-BR')
    )
  })
}

/** `areaKey` nulo = todas as áreas. `meses` = meses do ano a incluir. */
export async function carregarRelatorioGerencialGrupos(
  ano: number,
  meses: number[],
  areaKey: string | null,
): Promise<RelatorioGerencialLinha[]> {
  const mesesOk = [...new Set(meses)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b)
  if (mesesOk.length === 0) return []

  const [listas, empresas] = await Promise.all([
    Promise.all(mesesOk.map((m) => receitaService.fetchPrevistoMesItens(ano, m))),
    receitaService.fetchEmpresasNomeGrupo(),
  ])
  const itens = listas.flatMap((lista, i) =>
    lista.map((item) => ({ ...item, mesFonte: mesesOk[i] })),
  )
  const filtrados = areaKey
    ? itens.filter(
        (i) => i.departamento != null && departamentoMatchesAreaKey(i.departamento, areaKey),
      )
    : itens
  return montarLinhasRelatorioGerencial(filtrados, buildClienteGrupoMap(empresas), ano)
}
