import { receitaService } from '../services/receitaService'
import { mesAbrev, mesNome, RECEITA_META_CONTRIBUICAO_AREA } from '../constants'
import type { ReceitaRecebidoClassificacaoItemRow } from '../types/receita.types'
import { departamentoMatchesAreaKey } from './receitaInadimplenciaAreaFilter'
import { labelPlanoContas } from './planoContasLabel'
import { buildClienteGrupoMap, resolverGrupoCliente, valorRecebidoItem } from './recebidoGrupos'
import {
  itemVencimentoVencidoAteCorte,
  refDateCorteInadMes,
} from './receitaPrevistoFechamento'
import { areaKeyForDepartamento, RECEITA_RATEIO_OUTRAS_KEY } from './receitaRateioConsulta'
import {
  chaveGrupoRelatorioGerencial,
  type RelatorioGerencialLinha,
} from './receitaRelatorioGerencialExport'

export const RELATORIO_GERENCIAL_TRIBUTARIO_KEY = 'tributario'

export const RELATORIO_GERENCIAL_AREA_KEYS = [
  ...RECEITA_META_CONTRIBUICAO_AREA.map((a) => a.key),
  RELATORIO_GERENCIAL_TRIBUTARIO_KEY,
  RECEITA_RATEIO_OUTRAS_KEY,
] as const

type PrevistoItemGrupo = {
  ci_item?: number
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

function areaKeyForRelatorioGerencial(departamento: string | null | undefined): string {
  const key = areaKeyForDepartamento(departamento)
  if (key !== RECEITA_RATEIO_OUTRAS_KEY) return key
  const dept = departamento?.trim()
  if (dept && departamentoMatchesAreaKey(dept, RELATORIO_GERENCIAL_TRIBUTARIO_KEY)) {
    return RELATORIO_GERENCIAL_TRIBUTARIO_KEY
  }
  return RECEITA_RATEIO_OUTRAS_KEY
}

function emptyValorPorArea(): Record<string, number> {
  return Object.fromEntries(RELATORIO_GERENCIAL_AREA_KEYS.map((k) => [k, 0]))
}

function filtrarPorArea<T extends { departamento?: string | null }>(
  itens: T[],
  areaKey: string | null,
): T[] {
  if (!areaKey) return itens
  return itens.filter(
    (i) => i.departamento != null && departamentoMatchesAreaKey(i.departamento, areaKey),
  )
}

function upsertLinha(
  map: Map<string, RelatorioGerencialLinha>,
  input: {
    grupo: string
    tipo_receita: string
    data_vencimento: string | null
    data_pagamento: string | null
    faturado: number
    recebido: number
    inadimplencia: number
    areaKey: string
    areaValor: number
  },
): void {
  const chave = `${input.grupo}\0${input.tipo_receita}\0${input.data_vencimento ?? ''}\0${input.data_pagamento ?? ''}`
  const cur = map.get(chave)
  if (cur) {
    cur.faturado += input.faturado
    cur.recebido += input.recebido
    cur.inadimplencia += input.inadimplencia
    cur.valorPorArea[input.areaKey] = (cur.valorPorArea[input.areaKey] ?? 0) + input.areaValor
    return
  }
  const valorPorArea = emptyValorPorArea()
  valorPorArea[input.areaKey] = (valorPorArea[input.areaKey] ?? 0) + input.areaValor
  map.set(chave, {
    grupo_cliente: input.grupo,
    tipo_receita: input.tipo_receita,
    data_vencimento: input.data_vencimento,
    data_pagamento: input.data_pagamento,
    faturado: input.faturado,
    recebido: input.recebido,
    inadimplencia: input.inadimplencia,
    valorPorArea,
  })
}

/** Previsto (vencimento no período) + valor pago = caixa do período (mesma base da Gestão à vista). */
export function montarLinhasRelatorioGerencial(
  previsto: PrevistoItemGrupo[],
  recebidoCaixa: ReceitaRecebidoClassificacaoItemRow[],
  clienteGrupoMap: Map<string, string>,
  ano: number,
): RelatorioGerencialLinha[] {
  const map = new Map<string, RelatorioGerencialLinha>()
  const caixaPorCi = new Map<number, ReceitaRecebidoClassificacaoItemRow[]>()
  for (const item of recebidoCaixa) {
    if (item.ci_item <= 0) continue
    const lista = caixaPorCi.get(item.ci_item) ?? []
    lista.push(item)
    caixaPorCi.set(item.ci_item, lista)
  }
  const caixaUsado = new Set<number>()

  for (const item of previsto) {
    const valor = Number(item.valor_item) || 0
    if (valor === 0) continue
    const cliente = item.cliente?.trim() || 'Sem cliente'
    const grupoCadastro = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const grupo = chaveGrupoRelatorioGerencial(grupoCadastro, cliente)
    const data_vencimento = vencimentoIso(item.data_vencimento)
    const caixaLista =
      item.ci_item && item.ci_item > 0 ? caixaPorCi.get(item.ci_item) : undefined
    const recebido = caixaLista
      ? caixaLista.reduce((s, x) => s + valorRecebidoItem(x), 0)
      : 0
    if (item.ci_item && item.ci_item > 0 && caixaLista) caixaUsado.add(item.ci_item)
    const data_pagamento = vencimentoIso(
      caixaLista?.[0]?.data_pagamento ?? item.data_pagamento,
    )
    const pagoAlgumaVez = Boolean(vencimentoIso(item.data_pagamento))
    const mesItem = mesDoVencimento(data_vencimento, item.mesFonte)
    const corte = refDateCorteInadMes(ano, mesItem)
    const inadimplencia =
      !pagoAlgumaVez && itemVencimentoVencidoAteCorte(item.data_vencimento, corte)
        ? valor
        : 0
    upsertLinha(map, {
      grupo,
      tipo_receita: tipoReceitaItem(item.plano_contas),
      data_vencimento,
      data_pagamento,
      faturado: valor,
      recebido,
      inadimplencia,
      areaKey: areaKeyForRelatorioGerencial(item.departamento),
      areaValor: recebido,
    })
  }

  for (const item of recebidoCaixa) {
    if (item.ci_item > 0 && caixaUsado.has(item.ci_item)) continue
    const valor = valorRecebidoItem(item)
    if (valor === 0) continue
    const cliente = item.cliente?.trim() || 'Sem cliente'
    const grupoCadastro = resolverGrupoCliente(item.cliente, clienteGrupoMap)
    const grupo = chaveGrupoRelatorioGerencial(grupoCadastro, cliente)
    upsertLinha(map, {
      grupo,
      tipo_receita: tipoReceitaItem(item.plano_contas),
      data_vencimento: vencimentoIso(item.data_vencimento),
      data_pagamento: vencimentoIso(item.data_pagamento),
      faturado: 0,
      recebido: valor,
      inadimplencia: 0,
      areaKey: areaKeyForRelatorioGerencial(item.departamento),
      areaValor: valor,
    })
  }

  return [...map.values()].sort((a, b) => {
    const da = a.data_vencimento ?? ''
    const db = b.data_vencimento ?? ''
    const pa = a.data_pagamento ?? ''
    const pb = b.data_pagamento ?? ''
    return (
      da.localeCompare(db) ||
      pa.localeCompare(pb) ||
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

  const [listasPrevisto, listasRecebido, empresas] = await Promise.all([
    Promise.all(mesesOk.map((m) => receitaService.fetchPrevistoMesItens(ano, m))),
    Promise.all(mesesOk.map((m) => receitaService.fetchRecebidoClassificacaoMes(ano, m))),
    receitaService.fetchEmpresasNomeGrupo(),
  ])
  const previsto = filtrarPorArea(
    listasPrevisto.flatMap((lista, i) =>
      lista.map((item) => ({ ...item, mesFonte: mesesOk[i] })),
    ),
    areaKey,
  )
  const recebidoCaixa = filtrarPorArea(listasRecebido.flat(), areaKey)
  return montarLinhasRelatorioGerencial(
    previsto,
    recebidoCaixa,
    buildClienteGrupoMap(empresas),
    ano,
  )
}
