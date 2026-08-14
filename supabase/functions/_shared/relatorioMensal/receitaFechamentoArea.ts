export type ReceitaFechamentoMes = {
  previsto: number
  recebido_classificado: number
  receita_mes_caixa: number
  inad_recebida: number
  novos_vencimento_mes: number
  novos_vencimento_anterior: number
  inadimplencia_kpi: number
  recebido_previsto_caixa: number
}

type PrevistoItem = {
  ci_item: number
  valor_item: number
  data_vencimento?: string | null
  data_pagamento?: string | null
}

type ClassificacaoItem = {
  categoria: string
  valor_recebido: number
  data_vencimento?: string | null
}

export function filtrarPrevistoMesItensPorCiItens<T extends { ci_item: number }>(
  itens: T[],
  ciItensArea: Array<{ ci_item: number }>,
): T[] {
  if (ciItensArea.length === 0) return []
  const ids = new Set(ciItensArea.map((i) => Number(i.ci_item)))
  return itens.filter((i) => ids.has(Number(i.ci_item)))
}

function formatDateIsoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function refDateCorteInadMes(ano: number, mes: number, ref = new Date()): string {
  const mesFim = new Date(ano, mes, 0)
  const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const corte = mesFim.getTime() < hoje.getTime() ? mesFim : hoje
  return formatDateIsoLocal(corte)
}

function itemVencimentoVencidoAteCorte(
  data_vencimento: string | null | undefined,
  corteIso: string,
): boolean {
  if (!data_vencimento?.trim()) return false
  return data_vencimento.trim().slice(0, 10) <= corteIso
}

/** Vencido até hoje no mês e não quitado no mês — mesma regra do SIOE (visão por área). */
export function inadimplenciaItemMesFaturadoNaoPago(
  item: PrevistoItem,
  ano: number,
  mes: number,
  ref = new Date(),
): number {
  const corte = refDateCorteInadMes(ano, mes, ref)
  if (!itemVencimentoVencidoAteCorte(item.data_vencimento, corte)) return 0

  const pg = item.data_pagamento
  const valor = Number(item.valor_item) || 0
  if (!pg) return valor

  const d = new Date(`${pg.slice(0, 10)}T12:00:00`)
  const mesInicio = new Date(ano, mes - 1, 1)
  if (d.getFullYear() === ano && d.getMonth() + 1 === mes) return 0
  if (d < mesInicio) return 0
  return valor
}

function isNovosVencimentoMes(item: ClassificacaoItem, ano: number, mes: number): boolean {
  if (item.categoria !== 'novos_contratos' || !item.data_vencimento) return false
  const d = new Date(`${String(item.data_vencimento).slice(0, 10)}T12:00:00`)
  return d.getFullYear() === ano && d.getMonth() + 1 === mes
}

function somaClassificacaoDetalhe(
  itens: ClassificacaoItem[],
  key: 'inadimplencia' | 'receita_mes' | 'novos_vencimento_mes' | 'novos_vencimento_anterior',
  ano: number,
  mes: number,
): number {
  let total = 0
  for (const item of itens) {
    const cat = String(item.categoria ?? '')
    const val = Number(item.valor_recebido) || 0
    let include = false
    switch (key) {
      case 'inadimplencia':
        include = cat === 'inadimplencia'
        break
      case 'receita_mes':
        include = cat === 'receita_mes'
        break
      case 'novos_vencimento_mes':
        include = isNovosVencimentoMes(item, ano, mes)
        break
      case 'novos_vencimento_anterior':
        include = cat === 'novos_contratos' && !isNovosVencimentoMes(item, ano, mes)
        break
    }
    if (include) total += val
  }
  return total
}

/** Monta fechamento do mês por área — espelha buildPrevistoFechamentoMesFromDados no frontend. */
export function buildFechamentoPorAreaItens(
  previstoItens: PrevistoItem[],
  classificacaoItens: ClassificacaoItem[],
  ano: number,
  mes: number,
  ref = new Date(),
): ReceitaFechamentoMes {
  const mesInicio = new Date(ano, mes - 1, 1)
  const mesFim = new Date(ano, mes, 0)

  let previsto = 0
  let quitado_no_mes = 0
  let quitado_antecipado = 0
  let quitado_pago_depois = 0
  let em_aberto = 0

  for (const item of previstoItens) {
    const valor = Number(item.valor_item) || 0
    previsto += valor
    const pg = item.data_pagamento
    if (!pg) {
      em_aberto += valor
      continue
    }
    const d = new Date(`${pg.slice(0, 10)}T12:00:00`)
    if (d.getFullYear() === ano && d.getMonth() + 1 === mes) quitado_no_mes += valor
    else if (d < mesInicio) quitado_antecipado += valor
    else if (d > mesFim) quitado_pago_depois += valor
  }

  const inad_recebida = somaClassificacaoDetalhe(classificacaoItens, 'inadimplencia', ano, mes)
  const receita_mes_caixa = somaClassificacaoDetalhe(classificacaoItens, 'receita_mes', ano, mes)
  const novos_vencimento_mes = somaClassificacaoDetalhe(
    classificacaoItens,
    'novos_vencimento_mes',
    ano,
    mes,
  )
  const novos_vencimento_anterior = somaClassificacaoDetalhe(
    classificacaoItens,
    'novos_vencimento_anterior',
    ano,
    mes,
  )
  const recebido_classificado =
    inad_recebida + receita_mes_caixa + novos_vencimento_mes + novos_vencimento_anterior
  const recebido_previsto_caixa = receita_mes_caixa + novos_vencimento_mes

  let inadimplencia_kpi = 0
  for (const item of previstoItens) {
    inadimplencia_kpi += inadimplenciaItemMesFaturadoNaoPago(item, ano, mes, ref)
  }

  return {
    previsto,
    recebido_classificado,
    receita_mes_caixa,
    inad_recebida,
    novos_vencimento_mes,
    novos_vencimento_anterior,
    inadimplencia_kpi,
    recebido_previsto_caixa,
  }
}
