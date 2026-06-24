import { useCallback, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { RECEITA_DEPARTAMENTO_LABELS } from '../constants'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import type { ReceitaInadimplenciaDepartamentoMes } from '../types/receitaInadimplencia.types'
import { departamentoNormKey } from '../utils/receitaColunasChart'

function labelDepartamento(nome: string): string {
  const key = departamentoNormKey(nome)
  return RECEITA_DEPARTAMENTO_LABELS[key] ?? nome
}

type Props = {
  ano: number
  mes: number
  valor: number
  ajustado?: boolean
  onClick: () => void
}

export function ReceitaInadimplenciaMesValorButton({ ano, mes, valor, ajustado, onClick }: Props) {
  const [areas, setAreas] = useState<ReceitaInadimplenciaDepartamentoMes[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarAreas = useCallback(() => {
    if (areas != null || loading) return
    setLoading(true)
    setErro(null)
    receitaInadimplenciaService
      .fetchDepartamentosMes(ano, mes)
      .then((data) => setAreas(data.filter((a) => a.inadimplencia > 0)))
      .catch((e) => {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar áreas.')
        setAreas([])
      })
      .finally(() => setLoading(false))
  }, [ano, mes, areas, loading])

  const areasVisiveis = areas?.filter((a) => a.inadimplencia > 0) ?? []

  const totalAreas = useMemo(
    () => areasVisiveis.reduce((s, a) => s + a.inadimplencia, 0),
    [areasVisiveis],
  )

  const formatPct = (parte: number) =>
    totalAreas > 0
      ? `${((parte / totalAreas) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
      : '—'

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          onMouseEnter={carregarAreas}
          onFocus={carregarAreas}
          title="Ver e ajustar grupos inadimplentes"
          className={cn(
            'w-full min-w-[4.5rem] rounded-lg px-1.5 py-1.5 text-sm font-semibold tabular-nums transition-colors sm:px-2',
            'hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-1',
            ajustado ? 'text-amber-800 ring-1 ring-amber-200/80 bg-amber-50/60' : 'text-slate-900',
          )}
        >
          {formatCurrency(valor)}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-[min(100vw-2rem,20rem)] border-0 bg-slate-900 px-3 py-2.5 text-left text-slate-50 shadow-lg"
      >
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Inadimplência por área
        </p>
        {loading && (
          <p className="flex items-center gap-1.5 text-xs text-slate-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando...
          </p>
        )}
        {!loading && erro && <p className="text-xs text-rose-300">{erro}</p>}
        {!loading && !erro && areasVisiveis.length === 0 && areas != null && (
          <p className="text-xs text-slate-300">Sem inadimplência por área neste mês.</p>
        )}
        {!loading && areasVisiveis.length > 0 && (
          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Área</span>
              <span className="text-right">Valor</span>
              <span className="w-10 text-right">%</span>
            </div>
            <ul className="space-y-1">
              {areasVisiveis.map((a) => (
                <li
                  key={a.departamento}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 text-xs"
                >
                  <span className="truncate text-slate-100">{labelDepartamento(a.departamento)}</span>
                  <span className="shrink-0 tabular-nums font-medium text-amber-200">
                    {formatCurrency(a.inadimplencia)}
                  </span>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-300">
                    {formatPct(a.inadimplencia)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!loading && areas == null && (
          <p className="text-xs text-slate-400">Passe o mouse para ver o detalhe por área.</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
