import { useQuery } from '@tanstack/react-query'
import { cobrancaService } from '../services/cobrancaService'

export function useTelefonesWhatsapp(pessoaId: string | null | undefined) {
  return useQuery({
    queryKey: ['cobranca', 'telefones-whatsapp', pessoaId],
    queryFn: () => (pessoaId ? cobrancaService.listTelefonesWhatsapp(pessoaId) : []),
    enabled: !!pessoaId,
  })
}
