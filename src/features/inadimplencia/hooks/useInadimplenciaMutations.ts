import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inadimplenciaService } from '../services/inadimplenciaService'
import { logsService } from '../services/logsService'
import { pagamentosService } from '../services/pagamentosService'
import type { CreateClienteInput } from '../services/inadimplenciaService'
import type { RegistroAcaoForm } from '../types/inadimplencia.types'
import type { RegistroPagamentoForm } from '../types/inadimplencia.types'

export function useInadimplenciaMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inadimplencia'] })
  }

  const createCliente = useMutation({
    mutationFn: (input: CreateClienteInput) => inadimplenciaService.create(input),
    onSuccess: () => invalidate(),
  })

  const updateCliente = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof inadimplenciaService.update>[1] }) =>
      inadimplenciaService.update(id, input),
    onSuccess: () => invalidate(),
  })

  const marcarResolvido = useMutation({
    mutationFn: (id: string) => inadimplenciaService.marcarComoResolvido(id),
    onSuccess: () => invalidate(),
  })

  const registrarAcao = useMutation({
    mutationFn: async ({
      clientId,
      form,
      usuario,
    }: {
      clientId: string
      form: RegistroAcaoForm
      usuario?: string
    }) => {
      const { error: logError } = await logsService.create({
        client_id: clientId,
        tipo: form.tipo,
        descricao: form.descricao ?? null,
        usuario: usuario ?? null,
        data_acao: form.data_acao,
      })
      if (logError) return { data: null, error: logError }
      const dataAcaoDate = form.data_acao.slice(0, 10)
      const { error: updateError } = await inadimplenciaService.update(clientId, {
        ultima_providencia: form.descricao ?? `Ação: ${form.tipo}`,
        data_providencia: dataAcaoDate,
      })
      return updateError ? { data: null, error: updateError } : { data: {}, error: null }
    },
    onSuccess: (
      _: unknown,
      variables: { clientId: string; form: RegistroAcaoForm; usuario?: string }
    ) => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['inadimplencia', 'logs', variables.clientId] })
    },
  })

  const registrarPagamento = useMutation({
    mutationFn: ({
      clientId,
      form,
    }: {
      clientId: string
      form: RegistroPagamentoForm
    }) =>
      pagamentosService.create({
        client_id: clientId,
        valor_pago: form.valor_pago,
        data_pagamento: form.data_pagamento,
        forma_pagamento: form.forma_pagamento ?? null,
        observacao: form.observacao ?? null,
      }),
    onSuccess: (
      _: unknown,
      variables: { clientId: string; form: RegistroPagamentoForm }
    ) => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['inadimplencia', 'pagamentos', variables.clientId] })
    },
  })

  return {
    createCliente,
    updateCliente,
    marcarResolvido,
    registrarAcao,
    registrarPagamento,
    invalidate,
  }
}
