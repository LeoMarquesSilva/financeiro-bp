import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/AuthContext'
import { receitaMeService } from '../services/receitaMeService'
import { horizonteMe } from '../utils/receitaMeCalc'
import type { ReceitaMeBase } from '../services/receitaMeService'
import type {
  ReceitaMeAjuste,
  ReceitaMeAjusteTipo,
  ReceitaMeAreaStatus,
  ReceitaMeHistoricoRow,
  ReceitaMeNovaReceita,
  ReceitaMeNovaReceitaInput,
  ReceitaMeResponsavel,
  ReceitaMeSnapshotRow,
  ReceitaMeVisto,
} from '../types/receitaMe.types'

/** `@tanstack/react-query` é declarado sem tipos em `src/vite-env.d.ts`: tipamos o que sai daqui. */
type Consulta<T> = {
  data: T | undefined
  isLoading: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export const RECEITA_ME_QUERY_KEY = ['receita', 'me'] as const

const k = {
  base: (ano: number, meses: number[], mesCorrente: number | null) =>
    [...RECEITA_ME_QUERY_KEY, 'base', ano, meses.join(','), mesCorrente] as const,
  realizado: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'realizado-area', ano] as const,
  ajustes: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'ajustes', ano] as const,
  novas: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'novas', ano] as const,
  vistos: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'vistos', ano] as const,
  status: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'status', ano] as const,
  historico: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'historico', ano] as const,
  snapshots: (ano: number) => [...RECEITA_ME_QUERY_KEY, 'snapshots', ano] as const,
  responsaveis: [...RECEITA_ME_QUERY_KEY, 'responsaveis'] as const,
  minhasAreas: (email: string | null | undefined) =>
    [...RECEITA_ME_QUERY_KEY, 'minhas-areas', email ?? ''] as const,
}

export const RECEITA_ME_QUERY_KEYS = k

/** Horizonte calculado uma vez por montagem (mês corrente até dezembro). */
export function useReceitaMeHorizonte(ano: number | undefined) {
  return useMemo(() => horizonteMe(ano ?? new Date().getFullYear()), [ano])
}

/** Carteira e caixa ao vivo do VIOS para o horizonte. */
export function useReceitaMeDados(ano: number | undefined) {
  const { meses, mesCorrente } = useReceitaMeHorizonte(ano)
  const enabled = ano != null
  const anoOk = ano ?? 0

  const base: Consulta<ReceitaMeBase> = useQuery({
    queryKey: k.base(anoOk, meses, mesCorrente),
    queryFn: () => receitaMeService.carregarBase(anoOk, meses, mesCorrente),
    enabled,
    staleTime: 5 * 60_000,
  })
  const realizado: Consulta<Record<string, Record<number, number>>> = useQuery({
    queryKey: k.realizado(anoOk),
    queryFn: () => receitaMeService.carregarRealizadoPorArea(anoOk),
    enabled,
    staleTime: 5 * 60_000,
  })
  const ajustes: Consulta<ReceitaMeAjuste[]> = useQuery({
    queryKey: k.ajustes(anoOk),
    queryFn: () => receitaMeService.listAjustes(anoOk),
    enabled,
  })
  const novas: Consulta<ReceitaMeNovaReceita[]> = useQuery({
    queryKey: k.novas(anoOk),
    queryFn: () => receitaMeService.listNovasReceitas(anoOk),
    enabled,
  })
  const vistos: Consulta<ReceitaMeVisto[]> = useQuery({
    queryKey: k.vistos(anoOk),
    queryFn: () => receitaMeService.listVistos(anoOk),
    enabled,
  })
  const status: Consulta<ReceitaMeAreaStatus[]> = useQuery({
    queryKey: k.status(anoOk),
    queryFn: () => receitaMeService.listAreaStatus(anoOk),
    enabled,
  })

  const queries: Array<Consulta<unknown>> = [base, realizado, ajustes, novas, vistos, status]
  return {
    meses,
    mesCorrente,
    base: base.data,
    realizadoPorArea: realizado.data,
    ajustes: ajustes.data ?? [],
    novasReceitas: novas.data ?? [],
    vistos: vistos.data ?? [],
    status: status.data ?? [],
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetchBase: base.refetch,
  }
}

export function useReceitaMeResponsaveis(enabled = true): Consulta<ReceitaMeResponsavel[]> {
  return useQuery({
    queryKey: k.responsaveis,
    queryFn: () => receitaMeService.listResponsaveis(),
    enabled,
    staleTime: 60_000,
  })
}

/**
 * Quem vê o quê (espelha `receita_me_pode_editar` no banco):
 * admin e financeiro que não é responsável de área (Controladoria) editam todas;
 * responsável edita só as próprias áreas; comitê só lê.
 */
export function useReceitaMeAcesso() {
  const { user, role } = useAuth()
  const email = user?.email ?? null
  const minhas: Consulta<string[]> = useQuery({
    queryKey: k.minhasAreas(email),
    queryFn: () => receitaMeService.minhasAreas(),
    enabled: !!email,
    staleTime: 5 * 60_000,
  })
  const minhasAreas = minhas.data ?? []
  const editorGeral = role === 'admin' || (role === 'financeiro' && !minhas.isLoading && minhasAreas.length === 0)
  const podeVerEscritorio = role === 'admin' || role === 'financeiro' || role === 'comite'
  return {
    minhasAreas,
    isLoading: minhas.isLoading,
    editorGeral,
    podeVerEscritorio,
    temAcesso: podeVerEscritorio || minhasAreas.length > 0,
    podeEditar: (areaKey: string) => editorGeral || minhasAreas.includes(areaKey),
  }
}

type AjusteChave = { area_key: string; grupo: string; mes: number }

type AjusteUpsert = AjusteChave & {
  tipo: ReceitaMeAjusteTipo
  valor_marcado: number
}

type AjustesInput = { upserts: AjusteUpsert[]; remover: AjusteChave[] }

export function useReceitaMeMutations(ano: number) {
  const qc = useQueryClient()
  const { user, fullName } = useAuth()

  const onError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Não foi possível salvar.'
    toast.error(`Não foi possível salvar. ${msg}`)
  }

  /** Grava/remove ajustes com atualização otimista (clique na célula responde na hora). */
  const ajustes = useMutation({
    mutationFn: async (input: AjustesInput) => {
      await receitaMeService.removerAjustes(input.remover.map((r) => ({ ...r, ano })))
      await receitaMeService.salvarAjustes(input.upserts.map((u) => ({ ...u, ano })))
    },
    onMutate: async (input: AjustesInput) => {
      await qc.cancelQueries({ queryKey: k.ajustes(ano) })
      const anterior = (qc.getQueryData(k.ajustes(ano)) as ReceitaMeAjuste[] | undefined) ?? []
      const chave = (a: AjusteChave) => `${a.area_key}\u0000${a.grupo}\u0000${a.mes}`
      const remover = new Set(input.remover.map(chave))
      const upsertPorChave = new Map(input.upserts.map((u) => [chave(u), u]))
      const proximo: ReceitaMeAjuste[] = anterior
        .filter((a) => !remover.has(chave(a)))
        .map((a) => {
          const u = upsertPorChave.get(chave(a))
          if (!u) return a
          upsertPorChave.delete(chave(a))
          return { ...a, tipo: u.tipo, valor_marcado: u.valor_marcado }
        })
      for (const u of upsertPorChave.values()) {
        proximo.push({
          id: `tmp:${chave(u)}`,
          ano,
          ...u,
          motivo: null,
          updated_at: new Date().toISOString(),
          updated_by: user?.email ?? null,
        })
      }
      qc.setQueryData(k.ajustes(ano), proximo)
      return { anterior }
    },
    onError: (err: unknown, _input: AjustesInput, ctx: { anterior: ReceitaMeAjuste[] } | undefined) => {
      if (ctx?.anterior) qc.setQueryData(k.ajustes(ano), ctx.anterior)
      onError(err)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: k.ajustes(ano) })
      void qc.invalidateQueries({ queryKey: k.historico(ano) })
    },
  })

  const vistos = useMutation({
    mutationFn: (rows: ReceitaMeVisto[]) => receitaMeService.marcarVistos(rows),
    onMutate: async (rows: ReceitaMeVisto[]) => {
      await qc.cancelQueries({ queryKey: k.vistos(ano) })
      const anterior = (qc.getQueryData(k.vistos(ano)) as ReceitaMeVisto[] | undefined) ?? []
      const chave = (v: ReceitaMeVisto) => `${v.area_key}\u0000${v.grupo}\u0000${v.mes}`
      const novos = new Map(rows.map((r) => [chave(r), r]))
      qc.setQueryData(k.vistos(ano), [
        ...anterior.filter((v) => !novos.has(chave(v))),
        ...novos.values(),
      ])
      return { anterior }
    },
    onError: (err: unknown, _rows: ReceitaMeVisto[], ctx: { anterior: ReceitaMeVisto[] } | undefined) => {
      if (ctx?.anterior) qc.setQueryData(k.vistos(ano), ctx.anterior)
      onError(err)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: k.vistos(ano) }),
  })

  const confirmar = useMutation({
    mutationFn: (input: { areaKey: string; vistos: ReceitaMeVisto[] }) =>
      receitaMeService.confirmarArea({
        ano,
        areaKey: input.areaKey,
        email: user?.email ?? null,
        nome: fullName ?? null,
        vistos: input.vistos,
      }),
    onSuccess: () => toast.success('Melhor estimativa confirmada'),
    onError,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: k.status(ano) })
      void qc.invalidateQueries({ queryKey: k.vistos(ano) })
      void qc.invalidateQueries({ queryKey: k.historico(ano) })
    },
  })

  const salvarNova = useMutation({
    mutationFn: (input: ReceitaMeNovaReceitaInput) => receitaMeService.salvarNovaReceita(input),
    onSuccess: () => toast.success('Nova receita salva'),
    onError,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: k.novas(ano) })
      void qc.invalidateQueries({ queryKey: k.historico(ano) })
    },
  })

  const removerNova = useMutation({
    mutationFn: (id: string) => receitaMeService.removerNovaReceita(id),
    onSuccess: () => toast.success('Nova receita removida'),
    onError,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: k.novas(ano) })
      void qc.invalidateQueries({ queryKey: k.historico(ano) })
    },
  })

  const baixarNova = useMutation({
    mutationFn: (input: { id: string; meses: number[] }) =>
      receitaMeService.baixarMesesNovaReceita(input.id, input.meses),
    onError,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: k.novas(ano) })
      void qc.invalidateQueries({ queryKey: k.historico(ano) })
    },
  })

  return {
    salvarAjustes: ajustes.mutate as (input: AjustesInput) => void,
    marcarVistos: vistos.mutateAsync as (rows: ReceitaMeVisto[]) => Promise<void>,
    confirmarArea: confirmar.mutateAsync as (input: { areaKey: string; vistos: ReceitaMeVisto[] }) => Promise<void>,
    confirmando: confirmar.isPending as boolean,
    salvarNovaReceita: salvarNova.mutateAsync as (input: ReceitaMeNovaReceitaInput) => Promise<void>,
    salvandoNova: salvarNova.isPending as boolean,
    removerNovaReceita: removerNova.mutateAsync as (id: string) => Promise<void>,
    baixarMesesNovaReceita: baixarNova.mutateAsync as (input: { id: string; meses: number[] }) => Promise<void>,
  }
}

export function useReceitaMeHistorico(
  ano: number | undefined,
  enabled = true,
): Consulta<ReceitaMeHistoricoRow[]> {
  return useQuery({
    queryKey: k.historico(ano ?? 0),
    queryFn: () => receitaMeService.listHistorico(ano ?? 0),
    enabled: enabled && ano != null,
  })
}

export function useReceitaMeSnapshots(
  ano: number | undefined,
  enabled = true,
): Consulta<ReceitaMeSnapshotRow[]> {
  return useQuery({
    queryKey: k.snapshots(ano ?? 0),
    queryFn: () => receitaMeService.listSnapshots(ano ?? 0),
    enabled: enabled && ano != null,
  })
}
