import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, AlertTriangle, Building2, Loader2 } from 'lucide-react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import type { AppRole } from '@/lib/database.types'

const LOGO_AZUL = '/team/logo-azul.png'
const MIN_CHARS = 2
const MAX_PER_MODULE = 6

interface SearchResult {
  id: string
  label: string
  sublabel?: string
  module: 'inadimplencia' | 'escritorio'
  valor?: number
}

function getModulesForRole(role: AppRole | null): ('inadimplencia' | 'escritorio')[] {
  if (role === 'comite') return ['inadimplencia']
  if (role === 'financeiro' || role === 'admin') return ['inadimplencia', 'escritorio']
  return ['inadimplencia']
}

async function searchGlobal(
  term: string,
  modules: ('inadimplencia' | 'escritorio')[],
): Promise<SearchResult[]> {
  const q = term.trim()
  if (q.length < MIN_CHARS) return []

  const like = `%${q.replace(/%/g, '\\%')}%`
  const results: SearchResult[] = []

  if (modules.includes('inadimplencia')) {
    const { data } = await supabase
      .from('clients_inadimplencia_list' as never)
      .select('id, razao_social, status_classe, valor_em_aberto, gestor, area')
      .ilike('razao_social', like)
      .is('resolvido_at', null)
      .limit(MAX_PER_MODULE)

    if (data) {
      for (const r of data as Record<string, unknown>[]) {
        const areas = Array.isArray(r.area) ? (r.area as string[]).join(', ') : ''
        results.push({
          id: r.id as string,
          label: r.razao_social as string,
          sublabel: `Classe ${r.status_classe}${areas ? ` · ${areas}` : ''}`,
          module: 'inadimplencia',
          valor: r.valor_em_aberto ? Number(r.valor_em_aberto) : undefined,
        })
      }
    }
  }

  if (modules.includes('escritorio')) {
    const { data } = await supabase
      .from('escritorio_empresas_por_grupo' as never)
      .select('id, grupo_cliente, nome, cpf_cnpj, qtd_processos')
      .or(`grupo_cliente.ilike.${like},nome.ilike.${like}`)
      .order('grupo_cliente')
      .limit(30)

    if (data) {
      const seen = new Set<string>()
      const inadLabels = new Set(results.map((x: SearchResult) => x.label))
      for (const r of data as Record<string, unknown>[]) {
        const key = ((r.grupo_cliente as string) ?? '').trim() || (r.nome as string)
        if (!key || seen.has(key) || inadLabels.has(key)) continue
        seen.add(key)
        const empresasCount =
          (data as Record<string, unknown>[]).filter(
            (x: Record<string, unknown>) => ((x.grupo_cliente as string) ?? '').trim() === key,
          ).length
        results.push({
          id: key,
          label: key,
          sublabel:
            empresasCount > 1
              ? `${empresasCount} empresas · ${r.qtd_processos ?? 0} processos`
              : (r.cpf_cnpj as string) ?? 'Empresa',
          module: 'escritorio',
        })
        if (results.filter((x: SearchResult) => x.module === 'escritorio').length >= MAX_PER_MODULE) break
      }
    }
  }
  return results
}

export function TopBar() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const debouncedSearch = useDebounce(search, 300)
  const { role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const modules = useMemo(() => getModulesForRole(role), [role])

  const { data: rawResults, isLoading } = useQuery({
    queryKey: ['global-search', debouncedSearch, modules],
    queryFn: () => searchGlobal(debouncedSearch, modules),
    enabled: debouncedSearch.trim().length >= MIN_CHARS,
    staleTime: 30_000,
  })
  const results: SearchResult[] = (rawResults ?? []) as SearchResult[]

  useEffect(() => {
    setHighlightIdx(-1)
  }, [results])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setSearch('')
    setOpen(false)
  }, [location.pathname])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      setSearch('')
      if (result.module === 'inadimplencia') {
        navigate(`/financeiro/inadimplencia?busca=${encodeURIComponent(result.label)}`)
      } else {
        navigate(`/financeiro/escritorio?busca=${encodeURIComponent(result.label)}`)
      }
    },
    [navigate],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < results.length) {
      e.preventDefault()
      handleSelect(results[highlightIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const showDropdown = open && debouncedSearch.trim().length >= MIN_CHARS

  const inadResults = results.filter((r) => r.module === 'inadimplencia')
  const escritResults = results.filter((r) => r.module === 'escritorio')

  let flatIdx = -1

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-slate-200/60 bg-white/80 px-6 backdrop-blur-sm">
      <div className="relative mx-auto w-full max-w-lg" ref={containerRef}>
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (e.target.value.trim().length >= MIN_CHARS) setOpen(true)
          }}
          onFocus={() => {
            if (search.trim().length >= MIN_CHARS) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar clientes, grupos ou empresas..."
          className="h-9 w-full rounded-full border-0 bg-slate-100/80 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition-colors focus:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        {showDropdown && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[380px] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
            {isLoading && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                Nenhum resultado para &ldquo;{debouncedSearch}&rdquo;
              </div>
            )}

            {!isLoading && results.length > 0 && (
              <>
                {inadResults.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-2 backdrop-blur-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Inadimplência
                      </span>
                    </div>
                    {inadResults.map((r) => {
                      flatIdx++
                      const idx = flatIdx
                      return (
                        <button
                          key={`inad-${r.id}`}
                          type="button"
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setHighlightIdx(idx)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                            highlightIdx === idx ? 'bg-primary/5' : 'hover:bg-slate-50',
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{r.label}</p>
                            {r.sublabel && (
                              <p className="truncate text-xs text-slate-500">{r.sublabel}</p>
                            )}
                          </div>
                          {r.valor != null && r.valor > 0 && (
                            <span className="shrink-0 text-xs font-semibold text-red-600">
                              {formatCurrency(r.valor)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {escritResults.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-2 backdrop-blur-sm">
                      <Building2 className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Escritório
                      </span>
                    </div>
                    {escritResults.map((r) => {
                      flatIdx++
                      const idx = flatIdx
                      return (
                        <button
                          key={`escrit-${r.id}`}
                          type="button"
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setHighlightIdx(idx)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                            highlightIdx === idx ? 'bg-primary/5' : 'hover:bg-slate-50',
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{r.label}</p>
                            {r.sublabel && (
                              <p className="truncate text-xs text-slate-500">{r.sublabel}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                  <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>{' '}
                  navegar{' '}
                  <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
                  selecionar{' '}
                  <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">Esc</kbd>{' '}
                  fechar
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <img
        src={LOGO_AZUL}
        alt="Bismarchi Pires"
        className="h-7 w-auto shrink-0 object-contain"
      />
    </header>
  )
}
