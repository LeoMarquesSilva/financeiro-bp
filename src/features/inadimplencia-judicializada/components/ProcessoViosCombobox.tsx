import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { formatarCnjExibicao, formatCnjInput } from '../utils/cnjUtils'
import { useProcessosDoGrupo } from '../hooks/useJudicializada'
import type { ProcessoViosRow } from '../types/judicializada.types'

export type ProcessoViosComboboxProps = {
  grupoCliente: string
  onSelect: (processo: ProcessoViosRow) => void
  id?: string
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  enabled?: boolean
}

export function ProcessoViosCombobox({
  grupoCliente,
  onSelect,
  id,
  disabled = false,
  loading = false,
  placeholder = 'Buscar por CNJ, ação ou área…',
  enabled = true,
}: ProcessoViosComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const grupo = grupoCliente.trim()
  const { data: processos = [], isLoading } = useProcessosDoGrupo(
    grupo,
    search,
    enabled && Boolean(grupo),
  )

  useEffect(() => {
    if (disabled || loading) setOpen(false)
  }, [disabled, loading])

  const handleSelect = (processo: ProcessoViosRow) => {
    onSelect(processo)
    setSearch('')
    setOpen(false)
  }

  const busy = disabled || loading || isLoading

  const handleSearchChange = (raw: string) => {
    const hasLetters = /[a-zA-ZÀ-ÿ]/.test(raw)
    setSearch(hasLetters ? raw : formatCnjInput(raw))
    setOpen(true)
  }

  return (
    <Popover open={open && !busy} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          {loading ? (
            <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
          ) : (
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          )}
          <Input
            id={id}
            type="search"
            autoComplete="off"
            value={search}
            disabled={busy || !grupo}
            placeholder={!grupo ? 'Selecione um grupo primeiro' : isLoading ? 'Carregando processos…' : placeholder}
            className="pl-9 font-mono text-xs"
            onChange={(e) => handleSearchChange(e.target.value)}
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
            <p className="p-4 text-center text-sm text-slate-500">Carregando processos…</p>
          ) : processos.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">
              {search.trim() ? 'Nenhum processo encontrado.' : 'Nenhum processo VIOS para este grupo.'}
            </p>
          ) : (
            <ul className="list-none py-1">
              {processos.map((p: ProcessoViosRow) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className="font-mono text-sm font-medium text-slate-900">
                      {formatarCnjExibicao(p.nro_cnj) || p.ci || 'Sem CNJ'}
                    </span>
                    <span className="truncate text-xs text-slate-600">{p.acao || '—'}</span>
                    {(p.area || p.situacao_processo) && (
                      <span className="truncate text-xs text-slate-400">
                        {[p.area, p.situacao_processo].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )

}
