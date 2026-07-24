import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Filter, Loader2, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { OPEX_COLORS } from '../constants'
import { useOpexPlanoCatalogo } from '../hooks/useOpexPlanoCatalogo'
import {
  agruparCatalogoPlano,
  contagemPlanoFiltro,
  grupoTotalmenteExcluido,
  OPEX_PLANO_FILTRO_VAZIO,
  planoExcluido,
  planoFiltroChave,
  saveOpexPlanoFiltro,
  temPlanoFiltroAtivo,
  type OpexPlanoFiltroState,
} from '../utils/opexPlanoFiltro'

type Props = {
  ano: number
  filtro: OpexPlanoFiltroState
  onChange: (filtro: OpexPlanoFiltroState) => void
}

function cloneFiltro(filtro: OpexPlanoFiltroState): OpexPlanoFiltroState {
  return {
    gruposExcluidos: [...filtro.gruposExcluidos],
    planosExcluidos: [...filtro.planosExcluidos],
  }
}

export function OpexPlanoContasFiltro({ ano, filtro, onChange }: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [rascunho, setRascunho] = useState<OpexPlanoFiltroState>(() => cloneFiltro(filtro))
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set())

  const { data: catalogo, isLoading } = useOpexPlanoCatalogo(ano)

  const gruposMap = useMemo(() => agruparCatalogoPlano(catalogo ?? []), [catalogo])
  const contagem = useMemo(
    () => contagemPlanoFiltro(catalogo ?? [], filtro),
    [catalogo, filtro],
  )

  const gruposFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return [...gruposMap.entries()]
    return [...gruposMap.entries()].filter(([grupo, planos]) => {
      if (grupo.toLowerCase().includes(q)) return true
      return planos.some((p) => p.plano_contas.toLowerCase().includes(q))
    })
  }, [gruposMap, busca])

  const abrirSheet = (open: boolean) => {
    setAberto(open)
    if (open) {
      setRascunho(cloneFiltro(filtro))
      setBusca('')
    }
  }

  const aplicar = () => {
    onChange(cloneFiltro(rascunho))
    saveOpexPlanoFiltro(ano, rascunho)
    setAberto(false)
  }

  const limpar = () => {
    const vazio = cloneFiltro(OPEX_PLANO_FILTRO_VAZIO)
    setRascunho(vazio)
    onChange(vazio)
    saveOpexPlanoFiltro(ano, vazio)
    setAberto(false)
  }

  const toggleGrupo = (grupo: string, planos: { plano_contas: string }[], incluir: boolean) => {
    setRascunho((prev) => {
      const next = cloneFiltro(prev)
      if (incluir) {
        next.gruposExcluidos = next.gruposExcluidos.filter((g) => g !== grupo)
        for (const p of planos) {
          const chave = planoFiltroChave(grupo, p.plano_contas)
          next.planosExcluidos = next.planosExcluidos.filter((c) => c !== chave)
        }
      } else {
        if (!next.gruposExcluidos.includes(grupo)) next.gruposExcluidos.push(grupo)
        for (const p of planos) {
          const chave = planoFiltroChave(grupo, p.plano_contas)
          next.planosExcluidos = next.planosExcluidos.filter((c) => c !== chave)
        }
      }
      return next
    })
  }

  const togglePlano = (grupo: string, plano: string, incluir: boolean) => {
    setRascunho((prev) => {
      const next = cloneFiltro(prev)
      const chave = planoFiltroChave(grupo, plano)
      next.gruposExcluidos = next.gruposExcluidos.filter((g) => g !== grupo)
      if (incluir) {
        next.planosExcluidos = next.planosExcluidos.filter((c) => c !== chave)
      } else if (!next.planosExcluidos.includes(chave)) {
        next.planosExcluidos.push(chave)
      }
      return next
    })
  }

  const filtroAtivo = temPlanoFiltroAtivo(filtro)

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Sheet open={aberto} onOpenChange={abrirSheet}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5" aria-hidden />
              Planos no painel
              {filtroAtivo && (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                  {contagem.ocultos} oculto{contagem.ocultos !== 1 ? 's' : ''}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Planos no painel</SheetTitle>
              <SheetDescription>
                Marque os planos de contas e subplanos que entram na visualização do OPEX em {ano}.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 border-b border-slate-100 px-6 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" aria-hidden />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar grupo ou subplano…"
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Desmarque um <strong>grupo</strong> para ocultar todos os subplanos. Desmarque subplanos individualmente
                para excluir só parte do grupo.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
              {isLoading && (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Carregando planos…
                </div>
              )}
              {!isLoading && !gruposFiltrados.length && (
                <p className="py-8 text-sm text-slate-500">Nenhum plano encontrado para este ano.</p>
              )}
              <div className="space-y-2">
                {gruposFiltrados.map(([grupo, planos]) => {
                  const abertoGrupo = gruposAbertos.has(grupo)
                  const grupoIncluido = !grupoTotalmenteExcluido(grupo, rascunho)
                  const planosVisiveis = planos.filter((p) => !planoExcluido(grupo, p.plano_contas, rascunho)).length
                  const indeterminado = grupoIncluido && planosVisiveis > 0 && planosVisiveis < planos.length

                  return (
                    <div key={grupo} className="rounded-lg border border-slate-200/80 bg-slate-50/40">
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <Checkbox
                          id={`grupo-${grupo}`}
                          checked={grupoIncluido}
                          indeterminate={indeterminado}
                          onCheckedChange={(checked) => toggleGrupo(grupo, planos, checked === true)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`grupo-${grupo}`} className="block cursor-pointer text-sm font-medium text-slate-800">
                            {grupo}
                          </label>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {planosVisiveis}/{planos.length} subplano{planos.length !== 1 ? 's' : ''} visíve
                            {planosVisiveis !== 1 ? 'is' : 'l'}
                            {planos.some((p) => p.fixo) && (
                              <span className={cn('ml-2', OPEX_COLORS.fixo.text)}>· fixa</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setGruposAbertos((prev) => {
                              const next = new Set(prev)
                              if (next.has(grupo)) next.delete(grupo)
                              else next.add(grupo)
                              return next
                            })
                          }
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                          aria-label={abertoGrupo ? 'Recolher subplanos' : 'Expandir subplanos'}
                        >
                          {abertoGrupo ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                      {abertoGrupo && (
                        <div className="space-y-1 border-t border-slate-100 bg-white px-3 py-2">
                          {planos.map((plano) => {
                            const incluido = !planoExcluido(grupo, plano.plano_contas, rascunho)
                            return (
                              <div
                                key={plano.plano_contas}
                                className="flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50"
                              >
                                <Checkbox
                                  id={`plano-${planoFiltroChave(grupo, plano.plano_contas)}`}
                                  checked={incluido}
                                  onCheckedChange={(checked) =>
                                    togglePlano(grupo, plano.plano_contas, checked === true)
                                  }
                                  className="mt-0.5"
                                />
                                <label
                                  htmlFor={`plano-${planoFiltroChave(grupo, plano.plano_contas)}`}
                                  className="min-w-0 flex-1 cursor-pointer text-[13px] leading-snug text-slate-700"
                                >
                                  {plano.plano_contas}
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <SheetFooter className="border-t border-slate-200 bg-slate-50/80">
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={limpar}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Mostrar todos
              </Button>
              <Button type="button" size="sm" onClick={aplicar}>
                Aplicar filtro
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <span className="text-[11px] text-slate-500">
          {contagem.visiveis}/{contagem.total} subplano{contagem.total !== 1 ? 's' : ''} no painel
          {filtroAtivo ? ' · filtro ativo' : ''}
        </span>
      </div>
    </div>
  )
}
