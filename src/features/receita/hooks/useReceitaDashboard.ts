import { useQuery } from '@tanstack/react-query'
import { receitaService } from '../services/receitaService'
import type { ReceitaMetasConfig } from '../types/receita.types'

export function useReceitaDashboard(metas: ReceitaMetasConfig | undefined) {
  return useQuery({
    queryKey: ['receita', 'dashboard', metas?.ano, metas?.meses, metas?.meta, metas?.projetado_base_abril, metas?.projetado_real],
    queryFn: () => {
      if (!metas) throw new Error('Metas não carregadas')
      return receitaService.buildDashboard(metas)
    },
    enabled: !!metas,
  })
}
