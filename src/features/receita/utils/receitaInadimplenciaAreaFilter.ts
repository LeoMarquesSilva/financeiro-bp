import { RECEITA_DEPARTAMENTO_LABELS } from '../constants'
import type {
  ReceitaInadimplenciaDashboard,
  ReceitaInadimplenciaDepartamentoMes,
  ReceitaInadimplenciaEvolucaoMes,
  ReceitaInadimplenciaGrupoDepartamentoPeriodo,
  ReceitaInadimplenciaGrupoMes,
  ReceitaInadimplenciaTopCliente,
} from '../types/receitaInadimplencia.types'
import type { ReceitaRecebidoDepartamentoRow } from '../types/receita.types'
import { departamentoNormKey } from './receitaColunasChart'
import { calcularPctInadimplencia } from './receitaInadimplenciaCalc'

/** Filtro por área: alocação VIOS por departamento do item — ver `.cursor/rules/receita-inadimplencia-agregacao.mdc` §5. */

export function departamentoMatchesAreaKey(departamento: string, areaKey: string): boolean {
  const key = departamentoNormKey(departamento)
  if (key === areaKey) return true
  const label = RECEITA_DEPARTAMENTO_LABELS[areaKey]
  if (!label) return false
  return key === departamentoNormKey(label)
}

export function inadimplenciaAreaMes(
  departamentos: ReceitaInadimplenciaDepartamentoMes[],
  areaKey: string,
): number {
  return departamentos
    .filter((d) => departamentoMatchesAreaKey(d.departamento, areaKey))
    .reduce((s, d) => s + d.inadimplencia, 0)
}

/** Saldo líquido da área no intervalo (grupo×dept período, não soma mensal). */
export function inadimplenciaAreaPeriodo(
  gruposDeptPeriodo: ReceitaInadimplenciaGrupoDepartamentoPeriodo[],
  areaKey: string,
): number {
  return gruposDeptPeriodo
    .filter((r) => departamentoMatchesAreaKey(r.departamento, areaKey))
    .reduce((s, r) => s + r.inadimplencia, 0)
}

export function previstoAreaMes(
  previstoRows: ReceitaRecebidoDepartamentoRow[],
  mes: number,
  areaKey: string,
): number {
  return previstoRows
    .filter((r) => r.mes === mes && departamentoMatchesAreaKey(r.departamento, areaKey))
    .reduce((s, r) => s + r.total, 0)
}

function reducaoPctEvolucao(evolucao: ReceitaInadimplenciaEvolucaoMes[]): number | null {
  if (evolucao.length < 2) return null
  const primeiro = evolucao[0]?.valor ?? 0
  const ultimo = evolucao[evolucao.length - 1]?.valor ?? 0
  if (primeiro <= 0) return null
  const reducao = ((primeiro - ultimo) / primeiro) * 100
  return reducao > 0 ? Math.round(reducao) : null
}

export type GrupoInadimplenciaAreaAlocado = {
  grupo_cliente: string
  valor: number
  valor_total_grupo: number
  qtd_meses: number
  qtd_clientes: number
}

/** Grupos com inadimplência alocada à área no período (saldo líquido VIOS). */
export function gruposAlocadosPorAreaPeriodo(
  gruposDeptPeriodo: ReceitaInadimplenciaGrupoDepartamentoPeriodo[],
  areaKey: string,
): GrupoInadimplenciaAreaAlocado[] {
  const porGrupo = new Map<string, number>()

  for (const r of gruposDeptPeriodo) {
    if (!departamentoMatchesAreaKey(r.departamento, areaKey)) continue
    if (r.inadimplencia <= 0) continue
    porGrupo.set(r.grupo_cliente, (porGrupo.get(r.grupo_cliente) ?? 0) + r.inadimplencia)
  }

  return [...porGrupo.entries()]
    .map(([grupo_cliente, valor]) => ({
      grupo_cliente,
      valor: Math.round(valor * 100) / 100,
      valor_total_grupo: Math.round(valor * 100) / 100,
      qtd_meses: 0,
      qtd_clientes: 0,
    }))
    .filter((g) => g.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR'))
}

/** Grupos com inadimplência alocada à área (VIOS por departamento do grupo, não rateio global). */
export function gruposAlocadosPorArea(
  gruposDeptPorMes: Record<number, ReceitaInadimplenciaGrupoDepartamentoPeriodo[]>,
  gruposPorMes: Record<number, ReceitaInadimplenciaGrupoMes[]>,
  areaKey: string,
  meses: number[],
): GrupoInadimplenciaAreaAlocado[] {
  const porGrupo = new Map<
    string,
    { valor: number; totalGrupo: number; meses: Set<number>; qtdClientes: number }
  >()

  for (const mes of meses) {
    const rows = (gruposDeptPorMes[mes] ?? []).filter((r) =>
      departamentoMatchesAreaKey(r.departamento, areaKey),
    )
    for (const r of rows) {
      if (r.inadimplencia <= 0) continue
      const prev = porGrupo.get(r.grupo_cliente) ?? {
        valor: 0,
        totalGrupo: 0,
        meses: new Set<number>(),
        qtdClientes: 0,
      }
      prev.valor += r.inadimplencia
      prev.meses.add(mes)
      porGrupo.set(r.grupo_cliente, prev)
    }

    for (const g of gruposPorMes[mes] ?? []) {
      const prev = porGrupo.get(g.grupo_cliente)
      if (!prev) continue
      prev.totalGrupo += g.inadimplencia
      prev.qtdClientes = Math.max(prev.qtdClientes, g.qtd_clientes)
    }
  }

  return [...porGrupo.entries()]
    .map(([grupo_cliente, v]) => ({
      grupo_cliente,
      valor: Math.round(v.valor * 100) / 100,
      valor_total_grupo: Math.round(v.totalGrupo * 100) / 100,
      qtd_meses: v.meses.size,
      qtd_clientes: v.qtdClientes,
    }))
    .filter((g) => g.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.grupo_cliente.localeCompare(b.grupo_cliente, 'pt-BR'))
}

export function top5GruposPorAreaPeriodo(
  gruposDeptPeriodo: ReceitaInadimplenciaGrupoDepartamentoPeriodo[],
  areaKey: string,
): ReceitaInadimplenciaTopCliente[] {
  return gruposAlocadosPorAreaPeriodo(gruposDeptPeriodo, areaKey)
    .slice(0, 5)
    .map((g) => ({ cliente: g.grupo_cliente, valor: g.valor }))
}

export function top5GruposPorAreaFromMeses(
  gruposDeptPorMes: Record<number, ReceitaInadimplenciaGrupoDepartamentoPeriodo[]>,
  gruposPorMes: Record<number, ReceitaInadimplenciaGrupoMes[]>,
  areaKey: string,
  meses: number[],
): ReceitaInadimplenciaTopCliente[] {
  return gruposAlocadosPorArea(gruposDeptPorMes, gruposPorMes, areaKey, meses)
    .slice(0, 5)
    .map((g) => ({ cliente: g.grupo_cliente, valor: g.valor }))
}

/** Recalcula KPIs e evolução para uma única área meta (alocação VIOS por departamento). */
export function aplicarFiltroAreaInadimplencia(
  dashboard: ReceitaInadimplenciaDashboard,
  areaKey: string,
  deptPorMes: Record<number, ReceitaInadimplenciaDepartamentoMes[]>,
  previstoDept: ReceitaRecebidoDepartamentoRow[],
  gruposDeptPorMes: Record<number, ReceitaInadimplenciaGrupoDepartamentoPeriodo[]> = {},
  gruposPorMes: Record<number, ReceitaInadimplenciaGrupoMes[]> = {},
  meses: number[] = [],
  gruposDeptPeriodo: ReceitaInadimplenciaGrupoDepartamentoPeriodo[] = [],
): ReceitaInadimplenciaDashboard {
  const evolucao: ReceitaInadimplenciaEvolucaoMes[] = dashboard.evolucao.map((m) => {
    const valor = inadimplenciaAreaMes(deptPorMes[m.mes] ?? [], areaKey)
    const previsto = previstoAreaMes(previstoDept, m.mes, areaKey)
    const pct = calcularPctInadimplencia(valor, previsto)
    return {
      ...m,
      valor,
      valor_calculado: valor,
      previsto,
      pct,
      valor_congelado: undefined,
      pct_congelado: undefined,
      congelado: false,
      ajustado: false,
    }
  })

  const valor_total_periodo =
    gruposDeptPeriodo.length > 0
      ? inadimplenciaAreaPeriodo(gruposDeptPeriodo, areaKey)
      : evolucao.reduce((s, m) => s + m.valor, 0)
  const previsto_periodo = evolucao.reduce((s, m) => s + (m.previsto ?? 0), 0)
  const pct_periodo = calcularPctInadimplencia(valor_total_periodo, previsto_periodo)

  const top5 =
    gruposDeptPeriodo.length > 0
      ? top5GruposPorAreaPeriodo(gruposDeptPeriodo, areaKey)
      : top5GruposPorAreaFromMeses(gruposDeptPorMes, gruposPorMes, areaKey, meses)
  const top5_total = top5.reduce((s, g) => s + g.valor, 0)
  const top5_pct =
    valor_total_periodo > 0 ? calcularPctInadimplencia(top5_total, valor_total_periodo) : 0

  return {
    ...dashboard,
    evolucao,
    valor_total_periodo,
    pct_periodo,
    top5,
    top5_total,
    top5_pct,
    clientes_ajustado: false,
    destaque_reducao_pct: reducaoPctEvolucao(evolucao),
  }
}
