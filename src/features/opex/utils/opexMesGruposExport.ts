import { formatDate } from '@/shared/utils/format'
import { opexService } from '../services/opexService'
import type { OpexMesGrupoRow, OpexMesItemRow } from '../types/opex.types'

type ExportMeta = {
  ano: number
  mes: number
  mesLabel: string
}

type ResumoPlanoRow = {
  grupo_conta: string
  plano_contas: string
  conta_numero: string
  previsto: number
  previsto_vios: number
  realizado: number
  variacao: number
  qtd_itens: number
}

function buildResumoPlanos(itens: OpexMesItemRow[]): ResumoPlanoRow[] {
  const map = new Map<string, ResumoPlanoRow>()

  for (const item of itens) {
    const key = `${item.grupo_conta}\0${item.plano_contas}\0${item.conta_numero}`
    const atual = map.get(key) ?? {
      grupo_conta: item.grupo_conta,
      plano_contas: item.plano_contas,
      conta_numero: item.conta_numero,
      previsto: 0,
      previsto_vios: 0,
      realizado: 0,
      variacao: 0,
      qtd_itens: 0,
    }
    atual.previsto += item.valor_previsto
    atual.previsto_vios += item.valor_previsto_vios
    atual.realizado += item.valor_realizado
    atual.variacao += item.valor_realizado - item.valor_previsto
    atual.qtd_itens += 1
    map.set(key, atual)
  }

  return [...map.values()].sort(
    (a, b) => Math.max(b.previsto, b.realizado) - Math.max(a.previsto, a.realizado),
  )
}

export async function exportOpexMesGruposExcel(
  grupos: OpexMesGrupoRow[],
  meta: ExportMeta,
): Promise<void> {
  const itens = await opexService.fetchMesItens(meta.ano, meta.mes)
  const XLSX = await import('xlsx')

  const totaisItens = itens.reduce(
    (acc, item) => ({
      previsto: acc.previsto + item.valor_previsto,
      previsto_vios: acc.previsto_vios + item.valor_previsto_vios,
      orcamento: acc.orcamento + item.valor_orcamento,
      realizado: acc.realizado + item.valor_realizado,
    }),
    { previsto: 0, previsto_vios: 0, orcamento: 0, realizado: 0 },
  )

  const detalheRows = itens.map((item) => ({
    'Grupo macro': item.grupo_conta,
    'Plano mínimo': item.plano_contas,
    'Nº conta': item.conta_numero,
    Fixo: item.fixo ? 'Sim' : 'Não',
    'Nº título': item.nro_titulo,
    'CI título': item.ci_titulo,
    'CI item': item.ci_item,
    Descrição: item.descricao,
    Fornecedor: item.fornecedor,
    Departamento: item.departamento,
    Situação: item.situacao_titulo,
    'Data vencimento': formatDate(item.data_vencimento),
    'Data pagamento': formatDate(item.data_pagamento),
    'Orçamento (R$)': item.valor_orcamento,
    'Previsto VIOS (R$)': item.valor_previsto_vios,
    'Previsto exibido (R$)': item.valor_previsto,
    'Realizado (R$)': item.valor_realizado,
    'Variação (R$)': item.valor_realizado - item.valor_previsto,
  }))
  detalheRows.push({
    'Grupo macro': 'TOTAL',
    'Plano mínimo': '',
    'Nº conta': '',
    Fixo: '',
    'Nº título': '',
    'CI título': 0,
    'CI item': 0,
    Descrição: '',
    Fornecedor: '',
    Departamento: '',
    Situação: '',
    'Data vencimento': '',
    'Data pagamento': '',
    'Orçamento (R$)': totaisItens.orcamento,
    'Previsto VIOS (R$)': totaisItens.previsto_vios,
    'Previsto exibido (R$)': totaisItens.previsto,
    'Realizado (R$)': totaisItens.realizado,
    'Variação (R$)': totaisItens.realizado - totaisItens.previsto,
  })

  const resumoPlanos = buildResumoPlanos(itens)
  const totaisPlanos = resumoPlanos.reduce(
    (acc, p) => ({
      previsto: acc.previsto + p.previsto,
      previsto_vios: acc.previsto_vios + p.previsto_vios,
      realizado: acc.realizado + p.realizado,
      variacao: acc.variacao + p.variacao,
      qtd_itens: acc.qtd_itens + p.qtd_itens,
    }),
    { previsto: 0, previsto_vios: 0, realizado: 0, variacao: 0, qtd_itens: 0 },
  )

  const planoRows = resumoPlanos.map((p) => ({
    'Grupo macro': p.grupo_conta,
    'Plano mínimo': p.plano_contas,
    'Nº conta': p.conta_numero,
    'Qtd itens': p.qtd_itens,
    'Orçamento (R$)': p.previsto,
    'Previsto VIOS (R$)': p.previsto_vios,
    'Realizado (R$)': p.realizado,
    'Variação (R$)': p.variacao,
  }))
  planoRows.push({
    'Grupo macro': 'TOTAL',
    'Plano mínimo': '',
    'Nº conta': '',
    'Qtd itens': totaisPlanos.qtd_itens,
    'Orçamento (R$)': totaisPlanos.previsto,
    'Previsto VIOS (R$)': totaisPlanos.previsto_vios,
    'Realizado (R$)': totaisPlanos.realizado,
    'Variação (R$)': totaisPlanos.variacao,
  })

  const totaisGrupos = grupos.reduce(
    (acc, g) => ({
      previsto: acc.previsto + g.previsto,
      previsto_vios: acc.previsto_vios + g.previsto_vios,
      realizado: acc.realizado + g.realizado,
      variacao: acc.variacao + g.variacao,
    }),
    { previsto: 0, previsto_vios: 0, realizado: 0, variacao: 0 },
  )

  const grupoRows = grupos.map((g) => ({
    'Grupo macro': g.grupo_conta,
    Fixo: g.fixo ? 'Sim' : 'Não',
    'Orçamento (R$)': g.previsto,
    'Previsto VIOS (R$)': g.previsto_vios,
    'Realizado (R$)': g.realizado,
    'Variação (R$)': g.variacao,
  }))
  grupoRows.push({
    'Grupo macro': 'TOTAL',
    Fixo: '',
    'Orçamento (R$)': totaisGrupos.previsto,
    'Previsto VIOS (R$)': totaisGrupos.previsto_vios,
    'Realizado (R$)': totaisGrupos.realizado,
    'Variação (R$)': totaisGrupos.variacao,
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalheRows), 'Detalhado')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planoRows), 'Resumo planos')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grupoRows), 'Resumo grupos')

  const safeMes = meta.mesLabel.replace(/[^\w-]+/g, '_').toLowerCase()
  XLSX.writeFile(wb, `opex-previsto-realizado-${meta.ano}-${safeMes}.xlsx`)
}
