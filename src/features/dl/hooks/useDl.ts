import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dlService } from '../services/dlService'
import type { DlGestor, DlParametroMensal } from '../types/dl.types'

export function useDlAreas() {
  return useQuery({ queryKey: ['dl', 'areas'], queryFn: () => dlService.fetchAreas(), staleTime: Infinity })
}

export function useDlResultado(ano: number) {
  return useQuery({ queryKey: ['dl', 'resultado', ano], queryFn: () => dlService.fetchResultadoMensal(ano) })
}

export function useDlGestorMensal(ano: number) {
  return useQuery({ queryKey: ['dl', 'gestor-mensal', ano], queryFn: () => dlService.fetchGestorMensal(ano) })
}

export function useDlClientesArea(ano: number) {
  return useQuery({ queryKey: ['dl', 'clientes-area', ano], queryFn: () => dlService.fetchClientesArea(ano) })
}

export function useDlCarteiras(gestorIds: string[]) {
  return useQuery({
    queryKey: ['dl', 'carteiras', [...gestorIds].sort()],
    queryFn: () => dlService.fetchCarteiras(gestorIds),
    enabled: gestorIds.length > 0,
  })
}

export function useDlParametros(ano: number) {
  return useQuery({ queryKey: ['dl', 'parametros', ano], queryFn: () => dlService.fetchParametros(ano) })
}

export function useDlGestores(ano: number) {
  return useQuery({ queryKey: ['dl', 'gestores', ano], queryFn: () => dlService.fetchGestores(ano) })
}

/** Salva parâmetros e recalcula o DL (o resultado depende deles). */
export function useDlSalvarParametros(updatedBy: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mensais: DlParametroMensal[]) => dlService.salvarParametros(mensais, updatedBy),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

/** Gestor e carteira mudam o DL calculado: invalida o módulo inteiro. */
export function useDlSalvarGestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (g: Omit<DlGestor, 'id'> & { id?: string }) => dlService.salvarGestor(g),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

export function useDlExcluirGestor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dlService.excluirGestor(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

export function useDlCarteiraCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { gestorId: string; cliente: string; incluir: boolean }) =>
      input.incluir
        ? dlService.adicionarCliente(input.gestorId, input.cliente)
        : dlService.removerCliente(input.gestorId, input.cliente),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}
