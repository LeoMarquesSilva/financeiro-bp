import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { formatCurrency } from '@/shared/utils/format'
import {
  fetchGruposResumo,
  GRUPO_SEM_NOME,
  normalizarNomeGrupo,
  type GrupoResumoRow,
} from '@/features/escritorio/services/escritorioService'

const MAX_GRUPOS_DROPDOWN = 50

type GrupoInfo = {
  nome: string
  totalEmpresas: number
  valorEmAtraso: number
}

export type GrupoDevedorComboboxProps = {
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  enabled?: boolean
}

function buildGruposList(gruposResumo: GrupoResumoRow[]): GrupoInfo[] {
  return gruposResumo
    .map((r) => ({
      nome: r.grupo_cliente.trim() || GRUPO_SEM_NOME,
      totalEmpresas: r.total_empresas,
      valorEmAtraso: r.valor_em_atraso_ativos || r.valor_em_atraso,
    }))
    .filter((g) => g.nome !== GRUPO_SEM_NOME)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function filterGrupos(grupos: GrupoInfo[], search: string) {
  const b = search.trim().toLowerCase()
  if (!b) {
    const lista = grupos.slice(0, MAX_GRUPOS_DROPDOWN)
    return {
      filteredGrupos: lista,
      totalFiltrado: grupos.length,
      excedeuLimite: grupos.length > MAX_GRUPOS_DROPDOWN,
    }
  }
  const buscaNorm = normalizarNomeGrupo(b)
  const filtrado = grupos.filter((g) => {
    const grupoNorm = normalizarNomeGrupo(g.nome)
    const nomeLower = g.nome.toLowerCase()
    return (
      nomeLower.includes(b) ||
      grupoNorm.includes(buscaNorm) ||
      buscaNorm.includes(grupoNorm)
    )
  })
  const total = filtrado.length
  const lista = filtrado.slice(0, MAX_GRUPOS_DROPDOWN)
  return { filteredGrupos: lista, totalFiltrado: total, excedeuLimite: total > MAX_GRUPOS_DROPDOWN }
}

export function GrupoDevedorCombobox({
  value,
  onChange,
  id,
  disabled = false,
  placeholder = 'Buscar por nome do grupo…',
  enabled = true,
}: GrupoDevedorComboboxProps) {
  const [open, setOpen] = useState(false)

  const { data: gruposResumo = [], isLoading } = useQuery({
    queryKey: ['escritorio-grupos-resumo'],
    queryFn: fetchGruposResumo,
    enabled,
    staleTime: 60_000,
  })

  const grupos = useMemo(() => buildGruposList(gruposResumo), [gruposResumo])
  const { filteredGrupos, totalFiltrado, excedeuLimite } = useMemo(
    () => filterGrupos(grupos, value),
    [grupos, value],
  )

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const handleSelect = (nome: string) => {
    onChange(nome)
    setOpen(false)
  }

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id={id}
            type="search"
            autoComplete="off"
            value={value}
            disabled={disabled || isLoading}
            placeholder={isLoading ? 'Carregando grupos…' : placeholder}
            className="pl-9"
            onChange={(e) => {
              onChange(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-center text-sm text-slate-500">Carregando grupos…</p>
          ) : filteredGrupos.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">Nenhum grupo encontrado.</p>
          ) : (
            <>
              <ul className="list-none py-1">
                {filteredGrupos.map((g) => (
                  <li key={g.nome}>
                    <button
                      type="button"
                      onClick={() => handleSelect(g.nome)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900">{g.nome}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {g.totalEmpresas} empresa{g.totalEmpresas !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {g.valorEmAtraso > 0 && (
                        <span className="shrink-0 text-xs font-medium text-red-600">
                          {formatCurrency(g.valorEmAtraso)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {excedeuLimite && (
                <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Mostrando até {MAX_GRUPOS_DROPDOWN} de {totalFiltrado}. Digite para refinar.
                </p>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
