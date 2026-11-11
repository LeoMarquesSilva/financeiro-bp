import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dlService } from '../services/dlService'
import type { DlAliquota, DlGestor, DlParametroMensal, DlRegraNegativo } from '../types/dl.types'

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
      dlService.definirClienteCarteira(input.gestorId, input.cliente, input.incluir),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

export function useDlAliquotas(ano: number) {
  return useQuery({ queryKey: ['dl', 'aliquotas', ano], queryFn: () => dlService.fetchAliquotas(ano) })
}

export function useDlSalvarAliquotas(ano: number, updatedBy: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { salvar: DlAliquota[]; apagarMeses: number[] }) =>
      dlService.salvarAliquotas(ano, input.salvar, input.apagarMeses, updatedBy),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

export function useDlRegraNegativo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { areaKey: string; regra: DlRegraNegativo }) => dlService.salvarRegraNegativo(input.areaKey, input.regra),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

export function useDlFechamentos(ano: number) {
  return useQuery({ queryKey: ['dl', 'fechamentos', ano], queryFn: () => dlService.fetchFechamentos(ano) })
}

/** Fechar ou reabrir muda a foto e o ajuste: recarrega o módulo inteiro. */
export function useDlFecharMes(ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { mes: number; observacao: string | null }) => dlService.fecharMes(ano, input.mes, input.observacao),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}

export function useDlReabrirMes(ano: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mes: number) => dlService.reabrirMes(ano, mes),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dl'] }),
  })
}
