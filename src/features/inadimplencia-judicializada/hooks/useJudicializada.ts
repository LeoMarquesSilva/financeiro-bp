import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  judicializadaService,
  calcularValorAutoGrupo,
} from '../services/judicializadaService'
import type {
  CreateJudicializadaInput,
  UpdateJudicializadaInput,
} from '../types/judicializada.types'

const LIST_KEY = ['inadimplencia', 'judicializada', 'list'] as const

export function useJudicializadaList(incluirEncerrados: boolean) {
  return useQuery({
    queryKey: [...LIST_KEY, incluirEncerrados],
    queryFn: () => judicializadaService.fetchJudicializadaList(incluirEncerrados),
  })
}

export function useProcessosDoGrupo(grupoCliente: string, busca?: string, enabled = true) {
  return useQuery({
    queryKey: ['inadimplencia', 'judicializada', 'processos', grupoCliente, busca ?? ''],
    queryFn: () => judicializadaService.fetchProcessosDoGrupo(grupoCliente, busca),
    enabled: enabled && Boolean(grupoCliente.trim()),
  })
}

export function useValorAutoGrupo(grupoCliente: string, enabled = true) {
  return useQuery({
    queryKey: ['inadimplencia', 'judicializada', 'valor-auto', grupoCliente],
    queryFn: () => calcularValorAutoGrupo(grupoCliente),
    enabled: enabled && Boolean(grupoCliente.trim()),
  })
}

export function useJudicializadaMutations() {
  const queryClient = useQueryClient()

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: LIST_KEY })
  }

  const create = useMutation({
    mutationFn: (input: CreateJudicializadaInput) => judicializadaService.createJudicializada(input),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateJudicializadaInput }) =>
      judicializadaService.updateJudicializada(id, input),
    onSuccess: invalidate,
  })

  const recalcular = useMutation({
    mutationFn: (id: string) => judicializadaService.recalcularValorAuto(id),
    onSuccess: invalidate,
  })

  const encerrar = useMutation({
    mutationFn: (id: string) => judicializadaService.encerrarJudicializada(id),
    onSuccess: invalidate,
  })

  const reabrir = useMutation({
    mutationFn: (id: string) => judicializadaService.reabrirJudicializada(id),
    onSuccess: invalidate,
  })

  return { create, update, recalcular, encerrar, reabrir }
}
