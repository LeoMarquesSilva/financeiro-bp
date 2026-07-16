import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { MESES_ABREV } from '../constants'
import { receitaInadimplenciaService } from '../services/receitaInadimplenciaService'
import type { ReceitaInadimplenciaClienteTituloPeriodo } from '../types/receitaInadimplencia.types'
import { departamentoMatchesAreaKey } from '../utils/receitaInadimplenciaAreaFilter'

function mesLabel(mes: number, ano: number): string {
  const abrev = MESES_ABREV[mes - 1] ?? String(mes)
  return `${abrev}/${ano}`
}

function groupTitulosPorMes(titulos: ReceitaInadimplenciaClienteTituloPeriodo[]) {
  const map = new Map<number, ReceitaInadimplenciaClienteTituloPeriodo[]>()
  for (const t of titulos) {
    const list = map.get(t.mes) ?? []
    list.push(t)
    map.set(t.mes, list)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}

function fimMesIso(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function statusNoPeriodo(
  t: ReceitaInadimplenciaClienteTituloPeriodo,
  ano: number,
  mes: number,
): string {
  const fimMes = fimMesIso(ano, mes)
  if (
    t.data_pagamento &&
    t.data_pagamento <= fimMes &&
    t.valor_pago_item > 0 &&
    t.inadimplencia > 0 &&
    t.inadimplencia < t.valor_item - 0.01
  ) {
    return 'Pago parcial no mês'
  }
  if (t.data_pagamento && t.data_pagamento <= fimMes && t.inadimplencia <= 0.01) {
    return 'Quitado no mês'
  }
  return 'Inadimplente no mês'
}

type Props = {
  ano: number
  mesInicio: number
  mesFim: number
  cliente: string
  valorPeriodo: number
  escalaInadimplencia?: number
  areaKey?: string
  notaArea?: string
}

export function ReceitaInadimplenciaClienteTitulosDetalhe({
  ano,
  mesInicio,
  mesFim,
  cliente,
  valorPeriodo,
  escalaInadimplencia = 1,
  areaKey,
  notaArea,
}: Props) {
  const [titulos, setTitulos] = useState<ReceitaInadimplenciaClienteTituloPeriodo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    receitaInadimplenciaService
      .fetchClienteDetalhePeriodo(ano, mesInicio, mesFim, cliente, true)
      .then((data) => {
        if (!cancelled) setTitulos(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === 'object' && e !== null && 'message' in e
                ? String((e as { message: unknown }).message)
                : 'Erro ao carregar títulos.'
          setError(msg)
          setTitulos([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ano, mesInicio, mesFim, cliente])

  const titulosFiltrados = useMemo(() => {
    const base = titulos ?? []
    if (!areaKey) return base
    return base.filter(
      (t) => t.departamento != null && departamentoMatchesAreaKey(t.departamento, areaKey),
    )
  }, [titulos, areaKey])

  const porMes = useMemo(() => groupTitulosPorMes(titulosFiltrados), [titulosFiltrados])
  const somaItens = useMemo(
    () =>
      titulosFiltrados.reduce((s, t) => {
        const valor =
          areaKey != null
            ? t.inadimplencia
            : Math.round(t.inadimplencia * escalaInadimplencia * 100) / 100
        return s + valor
      }, 0),
    [titulosFiltrados, areaKey, escalaInadimplencia],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 pl-9 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando títulos...
      </div>
    )
  }

  if (error) {
    return <p className="py-2 pl-9 text-xs text-rose-600">{error}</p>
  }

  if (porMes.length === 0) {
    return (
      <p className="py-2 pl-9 text-xs text-slate-500">Nenhum título em aberto no período.</p>
    )
  }

  return (
    <div className="mb-2 mt-1 space-y-3 border-l-2 border-slate-200 pl-3 ml-7">
      {Math.abs(somaItens - valorPeriodo) > 1 && (
        <p className="text-[11px] text-amber-800">
          O total por título ({formatCurrency(somaItens)}) difere do valor na lista (
          {formatCurrency(valorPeriodo)}) por arredondamento ou recebimento parcial no período.
        </p>
      )}
      {!areaKey && (
        <p className="text-[11px] text-slate-500">
          {notaArea ??
            'Títulos com vencimento no período (valor proporcional conforme vencimento — regra planilha VIOS).'}
        </p>
      )}
      {porMes.map(([mes, itens]) => {
        const totalMes = itens.reduce((s, t) => {
          const valor =
            areaKey != null
              ? t.inadimplencia
              : Math.round(t.inadimplencia * escalaInadimplencia * 100) / 100
          return s + valor
        }, 0)
        return (
          <div key={mes}>
            <p className="mb-1 text-xs font-semibold capitalize text-slate-700">
              Venc. {mesLabel(mes, ano)}
              <span className="ml-2 font-normal text-slate-500">{formatCurrency(totalMes)}</span>
            </p>
            <ul className="space-y-1.5">
              {itens.map((t) => {
                const inadExibicao =
                  areaKey != null
                    ? t.inadimplencia
                    : Math.round(t.inadimplencia * escalaInadimplencia * 100) / 100
                return (
                  <li
                    key={`${t.mes}-${t.ci_titulo}-${t.departamento ?? ''}`}
                    className="rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          Título {t.nro_titulo}
                          <span className="ml-1.5 font-normal text-amber-800">
                            · {statusNoPeriodo(t, ano, mes)}
                          </span>
                        </p>
                        {t.descricao && (
                          <p className="mt-0.5 truncate text-slate-600">{t.descricao}</p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          Venc. {formatDate(t.data_vencimento)}
                          {t.qtd_itens > 1 && <span> · {t.qtd_itens} itens no título</span>}
                          {t.data_pagamento &&
                            t.data_pagamento <= fimMesIso(ano, mes) &&
                            t.valor_pago_item > 0 &&
                            t.inadimplencia > 0 && (
                              <span>
                                {' '}
                                · Pago {formatCurrency(t.valor_pago_item)} em{' '}
                                {formatDate(t.data_pagamento)}
                              </span>
                            )}
                          {t.plano_contas && <span> · {t.plano_contas}</span>}
                          {t.departamento && <span> · {t.departamento}</span>}
                        </p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="font-semibold text-rose-800">
                          {formatCurrency(inadExibicao)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          inad. {mesLabel(mes, ano)}
                          {!areaKey && escalaInadimplencia !== 1 && (
                            <span> · título {formatCurrency(t.inadimplencia)}</span>
                          )}
                          {t.valor_item !== t.inadimplencia && (
                            <span> · faturado {formatCurrency(t.valor_item)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
