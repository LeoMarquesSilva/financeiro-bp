import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Lock, Search, Snowflake } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { formatCurrency, formatDateTime, formatPercent } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import type {
  ReceitaInadimplenciaFechamentoMes,
  ReceitaInadimplenciaGrupoMes,
} from '../types/receitaInadimplencia.types'
import {
  calcularMesAjustado,
  calcularPctInadimplencia,
  gruposInadimplentesPadrao,
} from '../utils/receitaInadimplenciaCalc'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  mesLabel: string
  valorOriginal: number
  previstoMes: number
  congeladoInicial: boolean
  congeladoEmInicial?: string
  incluidosInicial?: Set<string>
  onAplicar: (mes: number, grupos: ReceitaInadimplenciaGrupoMes[], incluidos: Set<string>) => void
  onCongelado?: (fechamento: ReceitaInadimplenciaFechamentoMes) => void
}

export function ReceitaInadimplenciaGrupoSheet({
  open,
  onOpenChange,
  ano,
  mes,
  mesLabel,
  valorOriginal,
  previstoMes,
  congeladoInicial,
  congeladoEmInicial,
  incluidosInicial,
  onAplicar,
  onCongelado,
}: Props) {
  const { role } = useAuth()
  const canCongelar = role === 'admin'
  const canEditSelecao = role === 'admin' || role === 'financeiro'
  const [grupos, setGrupos] = useState<ReceitaInadimplenciaGrupoMes[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [incluidos, setIncluidos] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [fechamento, setFechamento] = useState<ReceitaInadimplenciaFechamentoMes | null>(null)
  const [congelando, setCongelando] = useState(false)
  const [congelarErro, setCongelarErro] = useState<string | null>(null)
  const buscaDebounced = useDebounce(busca, 250)

  const congelado = fechamento?.congelado ?? congeladoInicial
  const congeladoEm = fechamento?.congelado_em ?? congeladoEmInicial

  useEffect(() => {
    if (!open) {
      setBusca('')
      setFechamento(null)
      setCongelarErro(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      receitaInadimplenciaService.fetchGruposMes(ano, mes),
      receitaInadimplenciaService.fetchFechamentoMes(ano, mes),
      receitaInadimplenciaService.fetchSelecaoMes(ano, mes),
    ])
      .then(([data, fech, salvos]) => {
        if (cancelled) return
        setGrupos(data)
        setFechamento(fech)
        const inicial =
          salvos && salvos.length > 0
            ? new Set(salvos)
            : incluidosInicial && incluidosInicial.size > 0
              ? new Set(incluidosInicial)
              : gruposInadimplentesPadrao(data)
        setIncluidos(inicial)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar grupos.')
          setGrupos([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes, incluidosInicial])

  const filtrados = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase()
    const base = [...grupos]
      .filter((g) => g.inadimplencia > 0)
      .sort((a, b) => b.inadimplencia - a.inadimplencia)
    if (!termo) return base
    return base.filter((g) => g.grupo_cliente.toLowerCase().includes(termo))
  }, [grupos, buscaDebounced])

  const preview = useMemo(
    () => calcularMesAjustado(grupos, incluidos, previstoMes),
    [grupos, incluidos, previstoMes],
  )

  const totalExibido = useMemo(() => {
    if (congelado && fechamento?.valor_total != null) {
      const valor = fechamento.valor_total
      const pct =
        fechamento.pct != null && fechamento.pct > 0
          ? fechamento.pct
          : calcularPctInadimplencia(valor, previstoMes)
      return { valor, pct, congelado: true as const }
    }
    return { ...preview, congelado: false as const }
  }, [congelado, fechamento, preview, previstoMes])

  const recalculoAoVivo =
    congelado && Math.abs(preview.valor - totalExibido.valor) > 0.01 ? preview : null

  const toggle = (grupo: string) => {
    setIncluidos((prev) => {
      const next = new Set(prev)
      if (next.has(grupo)) next.delete(grupo)
      else next.add(grupo)
      return next
    })
  }

  const selecionarTodosInad = () => {
    setIncluidos(gruposInadimplentesPadrao(grupos))
  }

  const limparSelecao = () => setIncluidos(new Set())

  const handleCongelar = async () => {
    const msg = congelado
      ? `Atualizar o congelamento de ${mesLabel}/${String(ano).slice(-2)} com ${formatCurrency(preview.valor)} (${formatPercent(preview.pct)})? A data será renovada.`
      : `Congelar ${formatCurrency(preview.valor)} (${formatPercent(preview.pct)}) como valor oficial de ${mesLabel}/${String(ano).slice(-2)}?`
    if (!window.confirm(msg)) return

    setCongelando(true)
    setCongelarErro(null)
    try {
      const result = await receitaInadimplenciaService.congelarMes(ano, mes, preview.valor, preview.pct)
      setFechamento(result)
      onAplicar(mes, grupos, incluidos)
      onCongelado?.(result)
    } catch (e) {
      setCongelarErro(e instanceof Error ? e.message : 'Não foi possível congelar o valor.')
    } finally {
      setCongelando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <SheetTitle className="text-left">
              Inadimplência — {mesLabel}/{String(ano).slice(-2)}
            </SheetTitle>
            {congelado ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                Congelado em {formatDateTime(congeladoEm)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
                <Snowflake className="h-3 w-3 shrink-0" aria-hidden />
                Não congelado
              </span>
            )}
          </div>
          <SheetDescription className="text-left">
            Selecione os grupos que compõem a inadimplência do mês.
            {congelado && fechamento?.valor_total != null && (
              <span className="mt-1 block text-slate-600">
                Valor congelado na evolução: {formatCurrency(fechamento.valor_total)}
                {fechamento.pct != null && ` · ${formatPercent(fechamento.pct)}`}
                {canCongelar && (
                  <span className="mt-1 block text-slate-500">
                    A seleção de grupos continua editável e afeta o KPI do período. Para alterar o
                    valor oficial do mês, use &quot;Atualizar congelamento&quot;.
                  </span>
                )}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="border-y border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {congelado ? 'Total congelado' : 'Total selecionado'}
              </p>
              <p className="text-xl font-bold tabular-nums text-slate-900">
                {formatCurrency(totalExibido.valor)}
              </p>
              <p className="text-xs text-slate-500">
                {congelado ? (
                  <>
                    {formatPercent(totalExibido.pct)} do previsto
                    {recalculoAoVivo != null && (
                      <span className="mt-0.5 block text-amber-700/90">
                        Recálculo ao vivo (grupos atuais): {formatCurrency(recalculoAoVivo.valor)} — não
                        altera o valor congelado
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Original: {formatCurrency(valorOriginal)} · {formatPercent(totalExibido.pct)} do previsto
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canCongelar && (
                <Button
                  type="button"
                  variant={congelado ? 'outline' : 'default'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => void handleCongelar()}
                  disabled={loading || congelando || !!error}
                >
                  {congelando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Snowflake className="h-3.5 w-3.5" />
                  )}
                  {congelado ? 'Atualizar congelamento' : 'Congelar valor'}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={selecionarTodosInad} disabled={!canEditSelecao}>
                Todos inadimplentes
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={limparSelecao} disabled={!canEditSelecao}>
                Limpar
              </Button>
            </div>
          </div>
          {congelarErro && (
            <p className="mt-2 text-xs text-rose-600">{congelarErro}</p>
          )}
        </div>

        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar grupo..."
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando grupos...
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-600">{error}</p>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum grupo encontrado.</p>
          ) : (
            <ul className="space-y-2">
              {filtrados.map((g) => {
                const marcado = incluidos.has(g.grupo_cliente)
                const temInad = g.inadimplencia > 0
                return (
                  <li key={g.grupo_cliente}>
                    <button
                      type="button"
                      onClick={() => canEditSelecao && toggle(g.grupo_cliente)}
                      disabled={!canEditSelecao}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                        marcado
                          ? 'border-slate-300 bg-white shadow-sm'
                          : 'border-slate-200 bg-slate-50/50 opacity-80',
                        !temInad && 'opacity-60',
                        !canEditSelecao && 'cursor-default',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          marcado ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white',
                        )}
                      >
                        {marcado && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{g.grupo_cliente}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {g.qtd_clientes_inad} de {g.qtd_clientes} cliente(s) inadimplente(s) · Faturado{' '}
                          {formatCurrency(g.faturado)}
                          {g.recebido > 0 && (
                            <>
                              {' '}
                              · Recebido {formatCurrency(g.recebido)} · Diferença{' '}
                              {formatCurrency(Math.max(0, g.faturado - g.recebido))}
                            </>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-semibold tabular-nums',
                          temInad ? 'text-slate-900' : 'text-slate-400',
                        )}
                      >
                        {formatCurrency(g.inadimplencia)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <SheetFooter className="px-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {congelado || !canEditSelecao ? 'Fechar' : 'Cancelar'}
          </Button>
          {canEditSelecao && (
            <Button
              type="button"
              onClick={() => {
                onAplicar(mes, grupos, incluidos)
                onOpenChange(false)
              }}
              disabled={loading || !!error}
            >
              Aplicar seleção
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
