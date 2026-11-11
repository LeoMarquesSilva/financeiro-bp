import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useReceitaMetas } from '@/features/receita/hooks/useReceitaMetas'
import { useReceitaDashboard } from '@/features/receita/hooks/useReceitaDashboard'
import { useReceitaMeDados } from '@/features/receita/hooks/useReceitaMe'
import { calcularAreaMe, type ReceitaMeAreaCalc } from '@/features/receita/utils/receitaMeCalc'
import { RECEITA_ME_AREAS, RECEITA_ME_OUTRAS_KEY } from '@/features/receita/utils/receitaMeLabels'
import { receitaService } from '@/features/receita/services/receitaService'
import { opexService } from '@/features/opex/services/opexService'
import { eficienciaService } from '@/features/eficiencia/services/eficienciaService'
import type { OpexDashboard } from '@/features/opex/types/opex.types'
import type { EficienciaOverview, NpsKpi } from '@/features/eficiencia/types/eficiencia.types'
import { planejamentoService } from '../services/planejamentoService'
import type {
  PlanCenarioRow,
  PlanClienteHistoricoRow,
  PlanInadimplenciaPeriodoRow,
  PlanInadimplenciaRow,
  PlanMargemRow,
  PlanOpexBlocosRow,
  PlanPessoasRow,
  PlanReceitaRow,
  PlanReceitaSemAreaRow,
  PlanTimesheetRow,
  PlanTituloSemAreaRow,
} from '../types'
import {
  estimarImpostoPelaTaxa,
  mePorAreaPlanejamento,
  montarBaseRealizada,
  projetarAno,
  type BaseAno,
} from '../utils/planejamentoBase'
import type { AreaKey } from '../utils/areasPlanejamento'
import type { DadosOpsLegais } from '../utils/indicadoresOperacionais'

/** `src/vite-env.d.ts` declara o react-query sem tipos: os retornos são tipados aqui. */
type Q<T> = { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown; isFetching: boolean }

const K = ['planejamento'] as const
const STALE = 5 * 60_000

export const ANO_ATUAL = 2026
export const ANO_ANTERIOR = 2025
export const ANO_ALVO = 2027

/** Último mês fechado do ano corrente (mês anterior ao atual); 12 para anos passados. */
export function ultimoMesFechado(ano: number, hoje = new Date()): number {
  if (ano < hoje.getFullYear()) return 12
  if (ano > hoje.getFullYear()) return 0
  return hoje.getMonth()
}

export function usePlanReceita(ano: number): Q<PlanReceitaRow[]> {
  return useQuery({ queryKey: [...K, 'receita', ano], queryFn: () => planejamentoService.receitaMensal(ano), staleTime: STALE })
}

export function usePlanReceitaSemArea(ano: number, enabled = true): Q<PlanReceitaSemAreaRow[]> {
  return useQuery({
    queryKey: [...K, 'sem-area', ano],
    queryFn: () => planejamentoService.receitaSemArea(ano),
    staleTime: STALE,
    enabled,
  })
}

/** Títulos do cliente sem área no ano e onde ele pagou em áreas (para classificar). */
export function usePlanTitulosCliente(ano: number, cliente: string | null): {
  titulos: Q<PlanTituloSemAreaRow[]>
  historico: Q<PlanClienteHistoricoRow[]>
} {
  const titulos = useQuery({
    queryKey: [...K, 'sem-area-titulos', ano, cliente ?? ''],
    queryFn: () => planejamentoService.titulosSemArea(ano, cliente ?? ''),
    enabled: cliente != null,
    staleTime: STALE,
  })
  const historico = useQuery({
    queryKey: [...K, 'cliente-historico', cliente ?? ''],
    queryFn: () => planejamentoService.clienteHistoricoAreas(cliente ?? ''),
    enabled: cliente != null,
    staleTime: STALE,
  })
  return { titulos, historico }
}

export function usePlanMargem(ano: number): Q<PlanMargemRow[]> {
  return useQuery({ queryKey: [...K, 'margem', ano], queryFn: () => planejamentoService.margemMensal(ano), staleTime: STALE })
}

export function usePlanOpexBlocos(ano: number): Q<PlanOpexBlocosRow[]> {
  return useQuery({ queryKey: [...K, 'opex-blocos', ano], queryFn: () => planejamentoService.opexBlocos(ano), staleTime: STALE })
}

export function usePlanPessoas(ano: number): Q<PlanPessoasRow[]> {
  return useQuery({ queryKey: [...K, 'pessoas', ano], queryFn: () => planejamentoService.pessoasMensal(ano), staleTime: STALE })
}

export function usePlanTimesheet(ano: number): Q<PlanTimesheetRow[]> {
  return useQuery({ queryKey: [...K, 'timesheet', ano], queryFn: () => planejamentoService.timesheetMensal(ano), staleTime: STALE })
}

/** Títulos de honorários já lançados no VIOS com vencimento no ano (carteira), por departamento e mês. */
export function usePlanPrevisto(ano: number): Q<Array<{ mes: number; departamento: string; total: number }>> {
  return useQuery({
    queryKey: [...K, 'previsto', ano],
    queryFn: () => receitaService.fetchPrevistoPorDepartamento(ano),
    staleTime: STALE,
  })
}

export function usePlanOpexDashboard(ano: number): Q<OpexDashboard> {
  return useQuery({ queryKey: [...K, 'opex-dashboard', ano], queryFn: () => opexService.fetchDashboard(ano), staleTime: STALE })
}

/**
 * Inadimplência por área e mês, só leitura. Não usar receita_inadimplencia_dashboard aqui:
 * ela congela os meses encerrados do ano consultado.
 */
export function usePlanInadimplencia(ano: number): Q<PlanInadimplenciaRow[]> {
  return useQuery({
    queryKey: [...K, 'inadimplencia', ano],
    queryFn: () => planejamentoService.inadimplenciaMensal(ano),
    staleTime: STALE,
  })
}

export function usePlanInadimplenciaPeriodo(ano: number): Q<PlanInadimplenciaPeriodoRow[]> {
  return useQuery({
    queryKey: [...K, 'inadimplencia-periodo', ano],
    queryFn: () => planejamentoService.inadimplenciaPeriodo(ano),
    staleTime: STALE,
  })
}

/** Indicadores jurídicos do painel de Eficiência (escritório ou uma área da Eficiência). */
export function usePlanOverview(ano: number, areaEficiencia: string | null, enabled = true): Q<EficienciaOverview> {
  return useQuery({
    queryKey: [...K, 'overview', ano, areaEficiencia ?? ''],
    queryFn: () => eficienciaService.getOverview(ano, areaEficiencia),
    staleTime: STALE,
    enabled,
  })
}

export function usePlanOpsLegais(ano: number): Q<DadosOpsLegais> {
  return useQuery({
    queryKey: [...K, 'ops-legais', ano],
    queryFn: async () => {
      const [protocolo, publicacoesAnalise, publicacoesAgendamento, cadastro, antecipacao] = await Promise.all([
        eficienciaService.fetchOpsLegaisProtocoloMensal(ano),
        eficienciaService.fetchOpsLegaisPublicacoesEficMensal(ano, 'analise'),
        eficienciaService.fetchOpsLegaisPublicacoesEficMensal(ano, 'agendamento'),
        eficienciaService.fetchOpsLegaisCadastroMensal(ano),
        eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
      ])
      return { protocolo, publicacoesAnalise, publicacoesAgendamento, cadastro, antecipacao }
    },
    staleTime: STALE,
  })
}

export function usePlanNps(ano: number): Q<NpsKpi> {
  return useQuery({
    queryKey: [...K, 'nps', ano],
    queryFn: () => eficienciaService.fetchNpsKpi(ano),
    staleTime: STALE,
    retry: 0,
  })
}

/**
 * Melhor Estimativa e meta de 2026 com as mesmas contas da página da ME
 * (ReceitaMelhorEstimativaPage): por chave da Receita e mês do horizonte.
 */
export function usePlanMe2026() {
  const { metas, isLoading: metasLoading } = useReceitaMetas()
  const dashboard = useReceitaDashboard(metas) as Q<{ ano: number; rows: Array<{ mes: number; metaBase: number; meta: number; recebido: number }> }>
  const dados = useReceitaMeDados(metas?.ano)

  const calcs = useMemo(() => {
    const out: Record<string, ReceitaMeAreaCalc> = {}
    if (!dados.base) return out
    for (const key of [...RECEITA_ME_AREAS.map((a) => a.key), RECEITA_ME_OUTRAS_KEY]) {
      out[key] = calcularAreaMe({
        areaKey: key,
        meses: dados.meses,
        mesCorrente: dados.mesCorrente,
        previstos: dados.base.previstos,
        recebidos: dados.base.recebidos,
        ajustes: dados.ajustes,
        novasReceitas: dados.novasReceitas,
        vistos: dados.vistos,
        confirmada: Boolean(dados.status.find((s) => s.area_key === key)?.confirmada_em),
      })
    }
    return out
  }, [dados.base, dados.meses, dados.mesCorrente, dados.ajustes, dados.novasReceitas, dados.vistos, dados.status])

  const mePorReceitaKey = useMemo(() => {
    const out: Record<string, Record<number, number>> = {}
    for (const [k, c] of Object.entries(calcs)) out[k] = { ...c.mePorMes }
    return out
  }, [calcs])

  /** Meta do escritório por mês (meta base da Receita; meses sem meta ficam fora). */
  const metaBasePorMes = useMemo(() => {
    const out: Record<number, number> = {}
    for (const r of dashboard.data?.rows ?? []) if (r.metaBase > 0) out[r.mes] = r.metaBase
    return out
  }, [dashboard.data?.rows])

  return {
    ano: metas?.ano,
    metasConfig: metas,
    mePorReceitaKey,
    mesesMe: dados.meses,
    mesCorrente: dados.mesCorrente,
    metaBasePorMes,
    /** % da meta por chave da Receita (contribuição da área). */
    contribuicaoMeta: Object.fromEntries(RECEITA_ME_AREAS.map((a) => [a.key, a.pct])) as Record<string, number>,
    isLoading: metasLoading || dados.isLoading || dashboard.isLoading,
    error: dados.error ?? dashboard.error ?? null,
    pronto: Object.keys(calcs).length > 0,
  }
}

/** Bases 2025 e 2026 (2026 com ME/projeção e 2025 com imposto estimado). */
export function usePlanBases() {
  const m25 = usePlanMargem(ANO_ANTERIOR)
  const m26 = usePlanMargem(ANO_ATUAL)
  const o25 = usePlanOpexBlocos(ANO_ANTERIOR)
  const o26 = usePlanOpexBlocos(ANO_ATUAL)
  const me = usePlanMe2026()
  const fechado = ultimoMesFechado(ANO_ATUAL)

  const bases = useMemo(() => {
    if (!m25.data || !m26.data || !o25.data || !o26.data) return null
    const real26 = montarBaseRealizada(ANO_ATUAL, m26.data, o26.data)
    const fechados = Array.from({ length: fechado }, (_, i) => i + 1)
    const mePlan: Record<AreaKey, Record<number, number>> = mePorAreaPlanejamento(me.mePorReceitaKey, real26, fechados)
    const base2026: BaseAno = projetarAno(real26, fechado, mePlan)
    const base2025 = estimarImpostoPelaTaxa(montarBaseRealizada(ANO_ANTERIOR, m25.data, o25.data), real26, fechados)
    return { base2025, base2026, real2026: real26, mePlan, fechados }
  }, [m25.data, m26.data, o25.data, o26.data, me.mePorReceitaKey, fechado])

  const consultas = [m25, m26, o25, o26]
  return {
    ...bases,
    me,
    ultimoMesFechado: fechado,
    margem2025: m25.data ?? [],
    margem2026: m26.data ?? [],
    opex2025: o25.data ?? [],
    opex2026: o26.data ?? [],
    isLoading: consultas.some((q) => q.isLoading) || me.isLoading || !me.pronto,
    error: consultas.find((q) => q.error)?.error ?? me.error ?? null,
    refetch: () => consultas.forEach((q) => void q.refetch()),
  }
}

export function useClassificarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { cliente: string; areaKey: string | null }) => planejamentoService.classificarCliente(v.cliente, v.areaKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...K, 'sem-area'] })
      void qc.invalidateQueries({ queryKey: [...K, 'receita'] })
      void qc.invalidateQueries({ queryKey: [...K, 'margem'] })
    },
  }) as { mutateAsync: (v: { cliente: string; areaKey: string | null }) => Promise<void>; isPending: boolean }
}

export function usePlanCenarios(ano: number): Q<PlanCenarioRow[]> {
  return useQuery({ queryKey: [...K, 'cenarios', ano], queryFn: () => planejamentoService.listarCenarios(ano) })
}

export function useCenarioMutations(ano: number) {
  const qc = useQueryClient()
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: [...K, 'cenarios', ano] })
  }
  const criar = useMutation({
    mutationFn: (v: { nome: string; descricao?: string | null; premissas: unknown }) =>
      planejamentoService.criarCenario({ ano, ...v }),
    onSuccess: invalidar,
  }) as { mutateAsync: (v: { nome: string; descricao?: string | null; premissas: unknown }) => Promise<PlanCenarioRow>; isPending: boolean }
  const salvar = useMutation({
    mutationFn: (v: { id: string; nome?: string; descricao?: string | null; premissas?: unknown }) =>
      planejamentoService.salvarCenario(v.id, { nome: v.nome, descricao: v.descricao, premissas: v.premissas }),
    onSuccess: invalidar,
  }) as {
    mutateAsync: (v: { id: string; nome?: string; descricao?: string | null; premissas?: unknown }) => Promise<PlanCenarioRow>
    isPending: boolean
  }
  const excluir = useMutation({
    mutationFn: (id: string) => planejamentoService.excluirCenario(id),
    onSuccess: invalidar,
  }) as { mutateAsync: (id: string) => Promise<void>; isPending: boolean }
  const oficializar = useMutation({
    mutationFn: (v: { id: string; linhas: unknown[]; operacionais: unknown[] }) =>
      planejamentoService.oficializar(v.id, v.linhas, v.operacionais),
    onSuccess: invalidar,
  }) as { mutateAsync: (v: { id: string; linhas: unknown[]; operacionais: unknown[] }) => Promise<void>; isPending: boolean }
  return { criar, salvar, excluir, oficializar }
}
