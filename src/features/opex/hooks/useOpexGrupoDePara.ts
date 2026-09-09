import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { opexDeParaService } from '../services/opexDeParaService'
import { opexDeParaKeys } from '../utils/opexDePara'
import type { OpexGrupoDePara } from '../types/opex.types'

function sortDePara(linhas: OpexGrupoDePara[]): OpexGrupoDePara[] {
  return [...linhas].sort((a, b) => a.nomeOrigem.localeCompare(b.nomeOrigem, 'pt-BR'))
}

export function useOpexGrupoDePara(anoOrigem: number, anoDestino: number) {
  const queryClient = useQueryClient()
  const enabled = anoOrigem > 2000 && anoDestino > anoOrigem
  const pairKey = opexDeParaKeys.pair(anoOrigem, anoDestino)

  const query = useQuery({
    queryKey: pairKey,
    queryFn: (): Promise<OpexGrupoDePara[]> => opexDeParaService.list(anoOrigem, anoDestino),
    enabled,
    staleTime: 0,
  })

  const syncCache = (updater: (atual: OpexGrupoDePara[]) => OpexGrupoDePara[]) => {
    queryClient.setQueryData(pairKey, (atual: OpexGrupoDePara[] | undefined) => updater(atual ?? []))
  }

  const refetchRelacionados = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: opexDeParaKeys.all, refetchType: 'all' }),
      queryClient.invalidateQueries({ queryKey: ['opex', 'planos-yoy'], refetchType: 'all' }),
    ])
  }

  const upsert = useMutation({
    mutationFn: (input: Parameters<typeof opexDeParaService.upsert>[0]) => opexDeParaService.upsert(input),
    onSuccess: async (salvo: OpexGrupoDePara) => {
      syncCache((atual) => {
        const sem = atual.filter(
          (linha) =>
            linha.id !== salvo.id &&
            !(linha.nomeOrigem === salvo.nomeOrigem && linha.anoDestino === salvo.anoDestino),
        )
        return sortDePara([...sem, salvo])
      })
      await refetchRelacionados()
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => opexDeParaService.remove(id),
    onSuccess: async (_resultado: void, id: string) => {
      syncCache((atual) => atual.filter((linha) => linha.id !== id))
      await refetchRelacionados()
    },
  })

  return {
    data: query.data as OpexGrupoDePara[] | undefined,
    isLoading: query.isLoading,
    upsert,
    remove,
  }
}
