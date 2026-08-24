import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  fetchGruposResumo,
  GRUPO_SEM_NOME,
  normalizarNomeGrupo,
  type GrupoResumoRow,
} from '@/features/escritorio/services/escritorioService'

const MAX_GRUPOS_DROPDOWN = 50

type Props = {
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
}

export function GrupoClienteCombobox({
  value,
  onChange,
  id,
  disabled = false,
  placeholder = 'Buscar grupo…',
}: Props) {
  const [open, setOpen] = useState(false)

  const { data: gruposResumo = [], isLoading } = useQuery({
    queryKey: ['escritorio-grupos-resumo'],
    queryFn: (): Promise<GrupoResumoRow[]> => fetchGruposResumo(),
    staleTime: 60_000,
  })

  const grupos = useMemo(
    () =>
      gruposResumo
        .map((r: GrupoResumoRow) => r.grupo_cliente.trim())
        .filter((nome: string) => nome && nome !== GRUPO_SEM_NOME)
        .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')),
    [gruposResumo],
  )

  const filtrados = useMemo(() => {
    const q = value.trim().toLowerCase()
    const qNorm = normalizarNomeGrupo(value)
    const lista = q
      ? grupos.filter(
          (nome: string) =>
            nome.toLowerCase().includes(q) ||
            normalizarNomeGrupo(nome).includes(qNorm) ||
            qNorm.includes(normalizarNomeGrupo(nome)),
        )
      : grupos
    return {
      itens: lista.slice(0, MAX_GRUPOS_DROPDOWN),
      total: lista.length,
    }
  }, [grupos, value])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

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
          {filtrados.itens.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">Nenhum grupo encontrado.</p>
          ) : (
            <>
              <ul className="list-none py-1">
                {filtrados.itens.map((nome: string) => (
                  <li key={nome}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(nome)
                        setOpen(false)
                      }}
                      className="flex w-full px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50"
                    >
                      {nome}
                    </button>
                  </li>
                ))}
              </ul>
              {filtrados.total > MAX_GRUPOS_DROPDOWN ? (
                <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Mostrando até {MAX_GRUPOS_DROPDOWN} de {filtrados.total}. Digite para refinar.
                </p>
              ) : null}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
