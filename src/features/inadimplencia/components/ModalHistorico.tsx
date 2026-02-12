import { useQuery } from '@tanstack/react-query'
import { formatDate } from '@/shared/utils/format'
import { ModalBase } from './ModalBase'
import { logsService } from '../services/logsService'
import { TIPOS_ACAO } from '@/shared/constants/inadimplencia'

interface ModalHistoricoProps {
  open: boolean
  onClose: () => void
  clientId: string
}

export function ModalHistorico({ open, onClose, clientId }: ModalHistoricoProps) {
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['inadimplencia', 'logs', clientId],
    queryFn: async () => {
      const { data, error: err } = await logsService.listByClientId(clientId)
      if (err) throw err
      return data
    },
    enabled: open && !!clientId,
  })

  const getTipoLabel = (tipo: string) => TIPOS_ACAO.find((t) => t.value === tipo)?.label ?? tipo

  return (
    <ModalBase open={open} onClose={onClose} title="Histórico de ações">
      {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}
      {error && <p className="text-sm text-red-600">Erro ao carregar histórico.</p>}
      {logs && logs.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma ação registrada.</p>
      )}
      {logs && logs.length > 0 && (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700">{getTipoLabel(log.tipo)}</span>
                <span className="text-slate-500">{formatDate(log.data_acao)}</span>
              </div>
              {log.descricao && (
                <p className="mt-1 text-slate-600">{log.descricao}</p>
              )}
              {log.usuario && (
                <p className="mt-1 text-xs text-slate-500">Por: {log.usuario}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </ModalBase>
  )
}
