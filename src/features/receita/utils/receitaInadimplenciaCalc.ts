import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaEvolucaoMes,
  ReceitaInadimplenciaGrupoMes,
  ReceitaInadimplenciaGrupoPeriodo,
} from '../types/receitaInadimplencia.types'

/** Grupos incluídos por mês (chave = número do mês). Ausente = usa valor original do servidor. */
export type SelecaoGruposPorMes = Record<number, Set<string>>

export function previstoMesEvolucao(m: ReceitaInadimplenciaEvolucaoMes): number {
  if (m.previsto != null && m.previsto > 0) return m.previsto
  if (m.pct > 0 && m.valor > 0) return m.valor / (m.pct / 100)
  return 0
}

export function calcularPctInadimplencia(valor: number, previstoMes: number): number {
  if (previstoMes <= 0) return 0
  return Math.round((valor / previstoMes) * 10000) / 100
}

export function calcularMesAjustado(
  grupos: ReceitaInadimplenciaGrupoMes[],
  incluidos: Set<string>,
  previstoMes: number,
): { valor: number; pct: number } {
  const selected = grupos.filter((g) => incluidos.has(g.grupo_cliente))
  const valor = selected.reduce((s, g) => s + g.inadimplencia, 0)
  const pct = calcularPctInadimplencia(valor, previstoMes)
  return { valor, pct }
}

export function gruposInadimplentesPadrao(grupos: ReceitaInadimplenciaGrupoMes[]): Set<string> {
  return new Set(grupos.filter((g) => g.inadimplencia > 0).map((g) => g.grupo_cliente))
}

export function valorCalculadoMes(m: ReceitaInadimplenciaEvolucaoMes): number {
  if (m.ajustado) return m.valor
  return m.valor_calculado ?? m.valor
}

export function aplicarSelecaoGrupos(
  dashboard: ReceitaInadimplenciaDashboard,
  gruposPorMes: Record<number, ReceitaInadimplenciaGrupoMes[]>,
  selecaoPorMes: SelecaoGruposPorMes,
): ReceitaInadimplenciaDashboard {
  let algumMesAjustado = false
  const evolucao: ReceitaInadimplenciaEvolucaoMes[] = dashboard.evolucao.map((m) => {
    const grupos = gruposPorMes[m.mes]
    const incluidos = selecaoPorMes[m.mes]
    if (!grupos?.length || !incluidos) return m

    algumMesAjustado = true
    const previsto = previstoMesEvolucao(m)
    const { valor, pct } = calcularMesAjustado(grupos, incluidos, previsto)
    return { ...m, valor, pct, ajustado: true }
  })

  if (!algumMesAjustado) {
    return dashboard
  }

  // Ajuste mensal altera só a evolução; KPI do período vem do RPC / seleção por período.
  return {
    ...dashboard,
    evolucao,
  }
}

export function gruposPeriodoPadrao(grupos: ReceitaInadimplenciaGrupoPeriodo[]): Set<string> {
  return new Set(grupos.map((g) => g.grupo_cliente))
}

export function aplicarSelecaoGruposPeriodo(
  dashboard: ReceitaInadimplenciaDashboard,
  grupos: ReceitaInadimplenciaGrupoPeriodo[] | null,
  incluidos: Set<string> | null,
): ReceitaInadimplenciaDashboard {
  if (!grupos?.length || !incluidos) return dashboard

  const valor_total_periodo = grupos
    .filter((g) => incluidos.has(g.grupo_cliente))
    .reduce((s, g) => s + g.valor, 0)

  const todosIncluidos =
    grupos.length === incluidos.size && grupos.every((g) => incluidos.has(g.grupo_cliente))

  const previsto_periodo = dashboard.evolucao.reduce((s, m) => s + previstoMesEvolucao(m), 0)
  const pct_periodo =
    previsto_periodo > 0
      ? Math.round((valor_total_periodo / previsto_periodo) * 1000) / 10
      : dashboard.pct_periodo

  const top5_pct =
    valor_total_periodo > 0
      ? Math.round((dashboard.top5_total / valor_total_periodo) * 1000) / 10
      : dashboard.top5_pct

  return {
    ...dashboard,
    valor_total_periodo,
    pct_periodo,
    top5_pct,
    clientes_ajustado: !todosIncluidos,
  }
}
