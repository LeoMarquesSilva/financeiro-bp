import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  relatorioMensalService,
  type RelatorioMensalConfig,
  type RelatorioMensalDestinatario,
} from '../services/relatorioMensalService'

export function useRelatorioMensalConfig(enabled = true) {
  const qc = useQueryClient()

  const configQuery = useQuery({
    queryKey: ['receita', 'relatorio-mensal', 'config'],
    queryFn: () => relatorioMensalService.fetchConfig(),
    enabled,
  })

  const destinatariosQuery = useQuery({
    queryKey: ['receita', 'relatorio-mensal', 'destinatarios'],
    queryFn: () => relatorioMensalService.fetchDestinatarios(),
    enabled,
  })

  const logQuery = useQuery({
    queryKey: ['receita', 'relatorio-mensal', 'log'],
    queryFn: () => relatorioMensalService.fetchLog(40),
    enabled,
  })

  const saveConfig = useMutation({
    mutationFn: (config: RelatorioMensalConfig) => relatorioMensalService.saveConfig(config),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['receita', 'relatorio-mensal', 'config'] })
    },
  })

  const saveDestinatario = useMutation({
    mutationFn: (dest: Omit<RelatorioMensalDestinatario, 'created_at' | 'updated_at'>) =>
      relatorioMensalService.upsertDestinatario(dest),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['receita', 'relatorio-mensal', 'destinatarios'] })
    },
  })

  const deleteDestinatario = useMutation({
    mutationFn: (id: string) => relatorioMensalService.deleteDestinatario(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['receita', 'relatorio-mensal', 'destinatarios'] })
    },
  })

  const enviar = useMutation({
    mutationFn: relatorioMensalService.invokeEnviar,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['receita', 'relatorio-mensal', 'log'] })
    },
  })

  const configError = configQuery.error ?? destinatariosQuery.error ?? logQuery.error

  return {
    config: configQuery.data,
    destinatarios: destinatariosQuery.data ?? [],
    log: logQuery.data ?? [],
    isLoading: configQuery.isLoading || destinatariosQuery.isLoading,
    isError: configQuery.isError || destinatariosQuery.isError,
    error: configError,
    saveConfig,
    saveDestinatario,
    deleteDestinatario,
    enviar,
    refetchLog: logQuery.refetch,
  }
}
