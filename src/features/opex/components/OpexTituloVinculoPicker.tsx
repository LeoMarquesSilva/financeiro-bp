import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { opexService, valorReferenciaTitulos } from '../services/opexService'
import type { OpexTituloVinculado } from '../types/opexMetas.types'

type Props = {
  ano: number
  selected: OpexTituloVinculado[]
  onChange: (titulos: OpexTituloVinculado[]) => void
  onValorSugerido?: (valor: number) => void
}

export function OpexTituloVinculoPicker({ ano, selected, onChange, onValorSugerido }: Props) {
  const [busca, setBusca] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(busca.trim()), 300)
    return () => window.clearTimeout(t)
  }, [busca])

  const { data: resultados, isFetching } = useQuery({
    queryKey: ['opex', 'buscar-titulos', ano, debounced],
    queryFn: () => opexService.buscarTitulosVinculo(ano, debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  })

  const addTitulo = (t: OpexTituloVinculado) => {
    if (selected.some((s) => s.ci_item === t.ci_item)) return
    const next = [...selected, t]
    onChange(next)
    onValorSugerido?.(valorReferenciaTitulos(next))
    setBusca('')
    setDebounced('')
  }

  const removeTitulo = (ciItem: number) => {
    const next = selected.filter((t) => t.ci_item !== ciItem)
    onChange(next)
    onValorSugerido?.(valorReferenciaTitulos(next))
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          Título(s) VIOS vinculado(s) <span className="text-red-500">*</span>
        </Label>
        <p className="text-[11px] text-slate-500">
          Busque pelo número, descrição, fornecedor ou plano de contas do título PAGAR que comprova a economia ou o
          custo evitado.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar título no VIOS…"
            className="pl-9"
          />
        </div>
        {debounced.length >= 2 && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            {isFetching && (
              <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Buscando…
              </p>
            )}
            {!isFetching && resultados?.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500">Nenhum título encontrado em {ano}.</p>
            )}
            {resultados?.map((t: OpexTituloVinculado) => {
              const jaAdd = selected.some((s) => s.ci_item === t.ci_item)
              const valor = Math.max(t.valor_previsto, t.valor_realizado)
              return (
                <button
                  key={t.ci_item}
                  type="button"
                  disabled={jaAdd}
                  onClick={() => addTitulo(t)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-slate-50 px-3 py-2 text-left text-xs transition-colors last:border-0',
                    jaAdd ? 'cursor-default bg-slate-50 opacity-60' : 'hover:bg-violet-50/60',
                  )}
                >
                  <span className="font-medium text-slate-900">{t.descricao}</span>
                  <span className="text-[10px] text-slate-500">
                    Nº {t.nro_titulo} · {t.grupo_conta} · {formatCurrency(valor)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <ul className="space-y-2">
          {selected.map((t) => {
            const valor = Math.max(t.valor_previsto, t.valor_realizado)
            return (
              <li
                key={t.ci_item}
                className="flex items-start justify-between gap-2 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900">{t.descricao}</p>
                  <p className="text-[10px] text-slate-500">
                    Nº {t.nro_titulo} · CI {t.ci_item} · {formatCurrency(valor)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeTitulo(t.ci_item)}
                  aria-label="Remover vínculo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
