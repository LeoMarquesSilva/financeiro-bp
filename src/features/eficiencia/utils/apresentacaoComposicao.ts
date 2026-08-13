import { mesMaxDisponivelInadimplencia, MESES_NOME } from '@/features/receita/constants'
import { receitaInadimplenciaService } from '@/features/receita/services/receitaInadimplenciaService'
import { receitaService } from '@/features/receita/services/receitaService'
import type { ReceitaMesRow } from '@/features/receita/types/receita.types'
import { agruparClassificacaoPorGrupo } from '@/features/receita/utils/recebidoClassificacao'
import {
  buildClienteGrupoMap,
  valorRecebidoItem,
} from '@/features/receita/utils/recebidoGrupos'
import { valorExibicaoEvolucao } from '@/features/receita/utils/receitaInadimplenciaCalc'
import { buildPrevistoFechamentoMesFromDados } from '@/features/receita/utils/receitaPrevistoFechamento'
import {
  isMesesFiltro,
  mesFimResultado,
  type MesFiltroEficiencia,
} from '../constants'

export type ApresentacaoComposicaoGrupo = {
  grupo: string
  total: number
  pct: number
}

export type ApresentacaoComposicaoData = {
  ano: number
  mes: number
  mesLabel: string
  meta: number
  previsto: number
  recebido: number
  inadimplencia: number
  novosContratos: number
  /** Inadimplência recuperada — “Esforço de Receita Não Prevista” no BI. */
  esforcoNaoPrevista: number
  receitaMaisInadimplencia: number
  gruposNovos: ApresentacaoComposicaoGrupo[]
}

/** Mês de referência do Bloco 3 (painel mensal do BI). */
export function mesReferenciaComposicao(
  ano: number,
  mesFiltro: MesFiltroEficiencia,
  ref = new Date(),
): number {
  if (isMesesFiltro(mesFiltro) && mesFiltro.length > 0) {
    return Math.max(...mesFiltro)
  }
  const maxInad = mesMaxDisponivelInadimplencia(ano, ref)
  if (maxInad > 0) return maxInad
  const fim = mesFimResultado(ano, ref)
  return fim >= 1 ? fim : 1
}

export async function fetchApresentacaoComposicao(
  ano: number,
  mes: number,
  rows: ReceitaMesRow[],
): Promise<ApresentacaoComposicaoData> {
  const [itens, previstoItens, empresas, inadDashboard] = await Promise.all([
    receitaService.fetchRecebidoClassificacaoMes(ano, mes),
    receitaService.fetchPrevistoMesItens(ano, mes),
    receitaService.fetchEmpresasNomeGrupo(),
    receitaInadimplenciaService.fetchDashboard({
      ano,
      mesInicio: mes,
      mesFim: mes,
    }),
  ])

  const fechamento = buildPrevistoFechamentoMesFromDados(previstoItens, itens, ano, mes)
  const row = rows.find((r) => r.mes === mes)
  const meta = row?.meta ?? 0
  const previsto = row?.previsto ?? fechamento.previsto
  const recebido = row?.recebido ?? fechamento.recebido_classificado

  const evolucaoMes = inadDashboard.evolucao.find((e) => e.mes === mes)
  const inadimplencia =
    evolucaoMes != null
      ? valorExibicaoEvolucao(evolucaoMes).valor
      : Math.max(0, fechamento.inadimplencia_kpi)

  const clienteGrupoMap = buildClienteGrupoMap(empresas)
  const gruposAgg = agruparClassificacaoPorGrupo(
    itens,
    clienteGrupoMap,
    'novos_contratos',
  ).filter((g) => g.total > 0.009)

  const novosFromItens = itens
    .filter((i) => i.categoria === 'novos_contratos')
    .reduce((s, i) => s + valorRecebidoItem(i), 0)
  const novosContratos =
    fechamento.novos_total > 0.009 ? fechamento.novos_total : novosFromItens

  const baseNovos = novosContratos > 0.009 ? novosContratos : 1
  const gruposNovos: ApresentacaoComposicaoGrupo[] = gruposAgg
    .map((g) => ({
      grupo: g.grupo,
      total: g.total,
      pct: (g.total / baseNovos) * 100,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    ano,
    mes,
    mesLabel: MESES_NOME[mes - 1] ?? String(mes),
    meta,
    previsto,
    recebido,
    inadimplencia,
    novosContratos,
    esforcoNaoPrevista: fechamento.inad_recebida,
    receitaMaisInadimplencia: recebido + inadimplencia,
    gruposNovos,
  }
}
