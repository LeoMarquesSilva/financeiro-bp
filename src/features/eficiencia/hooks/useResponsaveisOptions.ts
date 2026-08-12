import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { AREAS_EFICIENCIA_JURIDICO } from '../constants'
import { useBpUsuariosAvatar, type BpUsuarioAvatar } from './useBpUsuariosAvatar'
import { normalizeResponsavelChave } from '../utils/responsavelMatch'
import { formatPessoaNome } from '../utils/formatPessoaNome'

export type ResponsavelOption = {
  nome: string
  area: string | null
  nomeChave: string
}

type TurnoverRow = {
  nome: string | null
  area: string | null
  admissao: string | null
}

/**
 * Colaboradores elegíveis ao filtro de gestão individual (jurídico).
 * Fonte: sp_turnover ativos no ano + áreas do painel jurídico.
 * Com `area`, lista só quem está nessa área; `null` = todas.
 */
export function useResponsaveisOptions(ano: number, area: string | null = null) {
  const { usuarios: avatarCatalog, loading: loadingAvatars } = useBpUsuariosAvatar()

  const { data, isLoading, error } = useQuery({
    queryKey: ['eficiencia', 'responsaveis-options', ano],
    queryFn: async (): Promise<ResponsavelOption[]> => {
      const { data: rows, error: qErr } = await supabase
        .from('sp_turnover')
        .select('nome, area, admissao, desligamento')
        .lte('admissao', `${ano}-12-31`)
        .or(`desligamento.is.null,desligamento.gte.${ano}-01-01`)
        .in('area', [...AREAS_EFICIENCIA_JURIDICO])

      if (qErr) throw qErr

      const byKey = new Map<string, ResponsavelOption & { admissao: string }>()
      for (const row of (rows ?? []) as TurnoverRow[]) {
        const nome = String(row.nome ?? '').trim()
        if (!nome) continue
        const chave = normalizeResponsavelChave(nome)
        if (!chave) continue
        const admissao = String(row.admissao ?? '')
        const prev = byKey.get(chave)
        if (!prev || admissao > prev.admissao) {
          byKey.set(chave, {
            nome: formatPessoaNome(nome),
            area: row.area ? String(row.area) : null,
            nomeChave: chave,
            admissao,
          })
        }
      }
      return [...byKey.values()]
        .map(({ nome, area: areaOpt, nomeChave }) => ({
          nome,
          area: areaOpt,
          nomeChave,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    },
    staleTime: 1000 * 60 * 10,
  })

  const baseOptions: ResponsavelOption[] = data ?? []

  const options = useMemo(() => {
    const withDisplay = baseOptions.map((opt: ResponsavelOption) => {
      const cat = avatarCatalog.find(
        (u: BpUsuarioAvatar) => normalizeResponsavelChave(u.nome) === opt.nomeChave,
      )
      if (cat?.nome?.trim()) {
        return { ...opt, nome: formatPessoaNome(cat.nome) }
      }
      return opt
    })
    if (!area) return withDisplay
    return withDisplay.filter((opt) => opt.area === area)
  }, [baseOptions, avatarCatalog, area])

  return {
    options,
    loading: isLoading || loadingAvatars,
    error,
  }
}
