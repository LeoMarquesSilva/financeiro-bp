import { useMemo, useState } from 'react'
import { CalendarIcon, Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatDate, parseDateAsLocal } from '@/shared/utils/format'
import { defaultMesCorrente } from '../services/escritorioLevantamentoService'

type Props = {
  dataInicio: string
  dataFim: string
  gruposSelecionados: string[]
  area: string | null
  grupos: string[]
  gruposLoading?: boolean
  areas: string[]
  onChange: (next: {
    dataInicio?: string
    dataFim?: string
    gruposSelecionados?: string[]
    area?: string | null
  }) => void
}

function DateBrField({
  id,
  label,
  valueIso,
  onChangeIso,
}: {
  id: string
  label: string
  valueIso: string
  onChangeIso: (iso: string) => void
}) {
  const selected = parseDateAsLocal(valueIso) ?? undefined

  return (
    <div className="flex w-[10.5rem] shrink-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'h-10 w-full justify-start gap-2 px-3 text-left text-sm font-normal tabular-nums',
              !valueIso && 'text-slate-500',
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {valueIso ? formatDate(valueIso) : 'DD/MM/AAAA'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (!d) return
              onChangeIso(format(d, 'yyyy-MM-dd'))
            }}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function MultiGrupoCombobox({
  options,
  value,
  onChange,
  loading,
}: {
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    const list = !q
      ? options
      : options.filter((g) => g.toLocaleLowerCase('pt-BR').includes(q))
    return list.slice(0, 80)
  }, [options, busca])

  function toggle(nome: string) {
    if (value.includes(nome)) onChange(value.filter((g) => g !== nome))
    else onChange([...value, nome])
  }

  const label = loading
    ? 'Carregando grupos…'
    : value.length === 0
      ? 'Todos os grupos'
      : value.length === 1
        ? value[0]
        : `${value.length} grupos selecionados`

  return (
    <div className="min-w-[14rem] flex-1 space-y-1.5">
      <Label>Grupo Cliente</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={loading}
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(28rem,90vw)] p-2" align="start">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar grupo…"
              className="h-9 pl-8"
            />
          </div>
          {value.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {value.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                  onClick={() => toggle(g)}
                  title="Remover"
                >
                  <span className="truncate">{g}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                onClick={() => onChange([])}
              >
                Limpar
              </button>
            </div>
          ) : null}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto">
            {filtrados.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-slate-400">Nenhum grupo</li>
            ) : (
              filtrados.map((g) => {
                const checked = value.includes(g)
                return (
                  <li key={g}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100',
                        checked && 'bg-slate-50',
                      )}
                      onClick={() => toggle(g)}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          checked
                            ? 'border-slate-800 bg-slate-800 text-white'
                            : 'border-slate-300',
                        )}
                      >
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="truncate">{g}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          {busca.trim() && filtrados.length >= 80 ? (
            <p className="mt-1 px-1 text-[11px] text-slate-400">
              Mostrando os 80 primeiros — refine a busca.
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

const selectClass =
  'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400'

export function LevantamentoFiltros({
  dataInicio,
  dataFim,
  gruposSelecionados,
  area,
  grupos,
  gruposLoading,
  areas,
  onChange,
}: Props) {
  const mesCorrente = defaultMesCorrente()

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex shrink-0 items-end gap-3">
        <DateBrField
          id="lev-data-inicio"
          label="Data início"
          valueIso={dataInicio}
          onChangeIso={(iso) => onChange({ dataInicio: iso })}
        />
        <DateBrField
          id="lev-data-fim"
          label="Data fim"
          valueIso={dataFim}
          onChangeIso={(iso) => onChange({ dataFim: iso })}
        />
      </div>
      <MultiGrupoCombobox
        options={grupos}
        value={gruposSelecionados}
        loading={gruposLoading}
        onChange={(next) => onChange({ gruposSelecionados: next })}
      />
      <div className="min-w-[12rem] max-w-xs flex-1 space-y-1.5">
        <Label htmlFor="lev-area" className="text-xs font-medium text-slate-600">
          Área
        </Label>
        <select
          id="lev-area"
          className={selectClass}
          value={area ?? ''}
          onChange={(e) => onChange({ area: e.target.value || null })}
        >
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 shrink-0"
        onClick={() =>
          onChange({
            dataInicio: mesCorrente.dataInicio,
            dataFim: mesCorrente.dataFim,
            gruposSelecionados: [],
            area: null,
          })
        }
      >
        Mês corrente
      </Button>
    </div>
  )
}
