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

  const valor_total_periodo = evolucao.reduce((s, m) => s + m.valor, 0)
  const previsto_periodo = evolucao.reduce((s, m) => s + (m.previsto ?? 0), 0)
  const pct_periodo = calcularPctInadimplencia(valor_total_periodo, previsto_periodo)

  const top5 = top5GruposPorAreaFromMeses(gruposDeptPorMes, gruposPorMes, areaKey, meses)
  const top5_total = top5.reduce((s, g) => s + g.valor, 0)
  const top5_pct =
    valor_total_periodo > 0
      ? Math.round((top5_total / valor_total_periodo) * 1000) / 10
      : 0

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
