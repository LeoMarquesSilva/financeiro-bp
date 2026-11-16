import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { mesesFiltroKey, planoFiltroKey } from '@/features/opex/utils/opexPeriodo'
import { loadOpexPlanoFiltro } from '@/features/opex/utils/opexPlanoFiltro'
import {
  fetchApresentacaoOpex,
  mesesApresentacaoOpex,
} from '../utils/apresentacaoOpex'

/**
 * Bloco OPEX da Apresentação. Usa o mesmo filtro de planos salvo na página
 * `/financeiro/opex` (localStorage, por ano) para os números baterem com ela.
 */
export function useApresentacaoOpex(
  ano: number,
  mesInicio: number,
  mesFim: number,
  enabled: boolean,
) {
  const meses = useMemo(
    () => mesesApresentacaoOpex(ano, mesInicio, mesFim),
    [ano, mesInicio, mesFim],
  )
  // Relido ao abrir a apresentação, caso o filtro tenha mudado na página OPEX.
  const planoFiltro = useMemo(() => loadOpexPlanoFiltro(ano), [ano, enabled])

  const query = useQuery({
    queryKey: [
      'eficiencia',
      'apresentacao-opex',
      ano,
      mesesFiltroKey(meses),
      planoFiltroKey(planoFiltro),
    ] as const,
    queryFn: () => fetchApresentacaoOpex(ano, meses, planoFiltro),
    enabled: enabled && meses.length > 0,
    staleTime: 60_000,
  })

  return {
    data: query.data ?? null,
    loading: enabled && (query.isLoading || query.isPending),
    error: (query.error as Error | null) ?? null,
    planoFiltro,
  }
}
