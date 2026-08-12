import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { Avatar } from '@/shared/components/Avatar'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { useResponsaveisOptions, type ResponsavelOption } from '../hooks/useResponsaveisOptions'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { toPriMaiuscula } from '../utils/textFormat'
import { normalizeResponsavelChave } from '../utils/responsavelMatch'

const MAX_DROPDOWN = 40

type Props = {
  ano: number
  /** Área do slicer — null = todas (lista completa). */
  area?: string | null
  value: string | null
  onChange: (nome: string | null) => void
  /** Quando false, o controle fica desabilitado (indicador sem pessoa). */
  enabled?: boolean
  hintDisabled?: string
}

export function ResponsavelFilter({
  ano,
  area = null,
  value,
  onChange,
  enabled = true,
  hintDisabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { options, loading } = useResponsaveisOptions(ano, area)
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  const filtrados = useMemo(() => {
    const q = busca.trim()
    const qKey = q ? normalizeResponsavelChave(q) : ''
    const list = !q
      ? options
      : options.filter((o: ResponsavelOption) => {
          const nomeKey = normalizeResponsavelChave(o.nome)
          return (
            o.nome.toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR')) ||
            nomeKey.includes(qKey) ||
            (o.area != null &&
              o.area.toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR')))
          )
        })
    return {
      items: list.slice(0, MAX_DROPDOWN),
      total: list.length,
      truncated: list.length > MAX_DROPDOWN,
    }
  }, [options, busca])

  const selected = value
    ? options.find(
        (o: ResponsavelOption) =>
          normalizeResponsavelChave(o.nome) === normalizeResponsavelChave(value),
      )
    : null
  const selectedNome = selected?.nome ?? value
  const selectedAvatar = selectedNome
    ? resolvePessoaAvatarUrl(selectedNome, teamMembers, avatarCatalog)
    : null

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!enabled) setOpen(false)
  }, [enabled])

  // Troca de área: se o responsável atual não está na lista, limpa.
  useEffect(() => {
    if (!value || loading) return
    const aindaValido = options.some(
      (o: ResponsavelOption) =>
        normalizeResponsavelChave(o.nome) === normalizeResponsavelChave(value),
    )
    if (!aindaValido) {
      onChange(null)
      setBusca('')
      setOpen(false)
    }
  }, [area, options, value, loading, onChange])

  function clear() {
    onChange(null)
    setBusca('')
    setOpen(false)
  }

  function select(nome: string) {
    onChange(nome)
    setBusca('')
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative w-full space-y-1.5">
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />

        <button
          type="button"
          disabled={!enabled}
          onClick={clear}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
            value === null
              ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            !enabled && 'cursor-not-allowed opacity-50',
          )}
          aria-pressed={value === null}
        >
          {toPriMaiuscula('Todos')}
        </button>

        {value ? (
          <button
            type="button"
            disabled={!enabled}
            onClick={clear}
            className={cn(
              'inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border border-slate-800 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm',
              !enabled && 'cursor-not-allowed opacity-50',
            )}
            title="Limpar filtro"
          >
            <Avatar
              src={selectedAvatar}
              fallbackSrc={selectedAvatar?.replace(/\.jpg$/i, '.png')}
              fullName={selectedNome ?? ''}
              size="xs"
              className="h-4 w-4 shrink-0 text-[8px] ring-1 ring-white/30"
            />
            <span className="truncate">{selectedNome}</span>
            <X className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          </button>
        ) : null}

        <div className="relative w-56 shrink-0 sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            ref={inputRef}
            type="text"
            autoComplete="off"
            disabled={!enabled || loading}
            value={busca}
            placeholder={
              loading
                ? 'Carregando…'
                : enabled
                  ? 'Buscar responsável…'
                  : 'Indisponível neste indicador'
            }
            className="h-7 pl-8 text-[11px]"
            onChange={(e) => {
              setBusca(e.target.value)
              if (enabled) setOpen(true)
            }}
            onFocus={() => {
              if (enabled) setOpen(true)
            }}
            onClick={() => {
              if (enabled) setOpen(true)
            }}
          />
        </div>
      </div>

      {open && enabled ? (
        <div
          className="absolute left-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-md"
          role="listbox"
          aria-label="Responsáveis"
        >
          {filtrados.items.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-400">
              Nenhum responsável encontrado.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {filtrados.items.map((opt: ResponsavelOption) => {
                const avatarUrl = resolvePessoaAvatarUrl(
                  opt.nome,
                  teamMembers,
                  avatarCatalog,
                )
                const ativo =
                  value != null &&
                  normalizeResponsavelChave(opt.nome) === normalizeResponsavelChave(value)
                return (
                  <li key={opt.nomeChave}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={ativo}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100',
                        ativo && 'bg-slate-100',
                      )}
                      onMouseDown={(e) => {
                        // Evita blur do input antes do click.
                        e.preventDefault()
                      }}
                      onClick={() => select(opt.nome)}
                    >
                      <Avatar
                        src={avatarUrl}
                        fallbackSrc={avatarUrl?.replace(/\.jpg$/i, '.png')}
                        fullName={opt.nome}
                        size="sm"
                        className="h-6 w-6 shrink-0 text-[10px]"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                        {opt.nome}
                      </span>
                      {opt.area ? (
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {toPriMaiuscula(opt.area)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {filtrados.truncated ? (
            <p className="border-t border-slate-100 px-2 py-1.5 text-[10px] text-slate-400">
              Mostrando {MAX_DROPDOWN} de {filtrados.total} — refine a busca.
            </p>
          ) : null}
        </div>
      ) : null}

      {!enabled && hintDisabled ? (
        <p className="text-center text-[10px] text-slate-400">{hintDisabled}</p>
      ) : null}
    </div>
  )
}
