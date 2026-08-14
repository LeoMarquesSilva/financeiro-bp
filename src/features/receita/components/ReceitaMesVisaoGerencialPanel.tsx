import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { ElementCopyButton } from '@/shared/components/ElementCopyButton'
import type {
  ReceitaPrevistoFechamentoItemRow,
  ReceitaPrevistoFechamentoMes,
  ReceitaRecebidoClassificacaoItemRow,
} from '../types/receita.types'
import type { ReceitaRecebidoDetalheKey } from '../utils/recebidoClassificacao'
import {
  agruparRecebidoPorVencimentoEGrupo,
  filtrarItensDetalheRecebido,
} from '../utils/recebidoClassificacao'
import {
  RECEBIDO_GERENCIAL_LINHAS,
  inadimplenciaMesFaturadoNaoPago,
  type FechamentoDrillKey,
} from '../utils/receitaPrevistoFechamento'
import { agruparInadMesPorVencimentoEGrupo } from '../utils/previstoGrupos'
import { ReceitaPrevistoFechamentoContabilPanel } from './ReceitaPrevistoFechamentoContabilPanel'
import { ReceitaVencimentoGrupoDrillTable } from './ReceitaVencimentoGrupoDrillTable'

type Props = {
  fechamento: ReceitaPrevistoFechamentoMes
  itens: ReceitaRecebidoClassificacaoItemRow[]
  previstoMesItens: ReceitaPrevistoFechamentoItemRow[]
  clienteGrupoMap: Map<string, string>
  ano: number
  mes: number
  mesLabel: string
  areaLabel?: string | null
  onDrillContabil?: (key: FechamentoDrillKey) => void
}

export function ReceitaMesVisaoGerencialPanel({
  fechamento,
  itens,
  previstoMesItens,
  clienteGrupoMap,
  ano,
  mes,
  mesLabel,
  areaLabel = null,
  onDrillContabil,
}: Props) {
  const [contabilAberto, setContabilAberto] = useState(false)
  const [recebidoExpandido, setRecebidoExpandido] = useState<ReceitaRecebidoDetalheKey | null>(
    null,
  )
  const [inadGrupoExpandido, setInadGrupoExpandido] = useState(false)
  const [vencExpandidoRecebido, setVencExpandidoRecebido] = useState<string | null>(null)
  const [vencExpandidoInad, setVencExpandidoInad] = useState<string | null>(null)
  const composicaoRecebidoRef = useRef<HTMLDivElement>(null)
  const inadExportRef = useRef<HTMLDivElement>(null)

  const totalRecebido = fechamento.recebido_classificado
  const inadMes = inadimplenciaMesFaturadoNaoPago(fechamento)
  const pctPrevistoCaixa =
    fechamento.previsto > 0
      ? (fechamento.recebido_previsto_caixa / fechamento.previsto) * 100
      : null
  const pctInadPrevisto =
    fechamento.previsto > 0 ? (inadMes / fechamento.previsto) * 100 : null

  const somaLinhas = RECEBIDO_GERENCIAL_LINHAS.reduce(
    (s, linha) => s + fechamento[linha.valorKey],
    0,
  )
  const recebidoFecha = Math.abs(somaLinhas - totalRecebido) < 0.02

  const recebidoVencimentosPorLinha = useMemo(() => {
    const map = new Map<ReceitaRecebidoDetalheKey, ReturnType<typeof agruparRecebidoPorVencimentoEGrupo>>()
    for (const linha of RECEBIDO_GERENCIAL_LINHAS) {
      const filtrados = filtrarItensDetalheRecebido(itens, linha.key, ano, mes)
      map.set(linha.key, agruparRecebidoPorVencimentoEGrupo(filtrados, clienteGrupoMap))
    }
    return map
  }, [itens, clienteGrupoMap, ano, mes])

  const inadVencimentos = useMemo(
    () =>
      agruparInadMesPorVencimentoEGrupo(previstoMesItens, clienteGrupoMap, ano, mes).filter(
        (v) => v.inadimplencia > 0,
      ),
    [previstoMesItens, clienteGrupoMap, ano, mes],
  )

  const toggleRecebidoLinha = (key: ReceitaRecebidoDetalheKey) => {
    setRecebidoExpandido((prev) => {
      if (prev === key) {
        setVencExpandidoRecebido(null)
        return null
      }
      setVencExpandidoRecebido(null)
      return key
    })
  }

  const toggleInadGrupo = () => {
    setInadGrupoExpandido((v) => {
      if (v) setVencExpandidoInad(null)
      return !v
    })
  }

  const contextoMesAreas = `${mesLabel} / ${ano} · ${areaLabel ?? 'Todas as áreas'}`

  const inadHeaderConteudo = (options: { interactive?: boolean } = {}) => (
    <>
      <div className="flex items-center justify-between gap-2">
        {options.interactive ? (
          <button
            type="button"
            onClick={toggleInadGrupo}
            className="group min-w-0 flex-1 text-left"
            aria-expanded={inadGrupoExpandido}
          >
            <div className="flex items-center gap-1.5">
              {inadGrupoExpandido ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
              ) : (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-red-400 group-hover:text-red-600"
                  aria-hidden
                />
              )}
              <h3 className="text-sm font-semibold uppercase tracking-wide text-red-900">
                Inadimplência do mês — por grupo
              </h3>
            </div>
          </button>
        ) : (
          <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-red-900">
            Inadimplência do mês — por grupo
          </h3>
        )}
        {options.interactive ? (
          <div className="shrink-0" data-chart-export-ignore>
            <ElementCopyButton
              containerRef={inadExportRef}
              preserveBackground
              className="border-red-200/80 bg-white/80 hover:bg-white"
            />
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-red-800">{contextoMesAreas}</p>
        {pctInadPrevisto != null ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium tabular-nums text-red-900">
            {formatPercent(pctInadPrevisto)} do previsto
          </span>
        ) : null}
      </div>
    </>
  )

  const inadTotalRodape = (
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-red-200/60 pt-2 text-xs font-semibold text-red-900">
      <span className="whitespace-nowrap">= Total inad. mês</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{formatCurrency(inadMes)}</span>
    </div>
  )

  return (
    <div className="mb-4 space-y-4">
      <section
        ref={composicaoRecebidoRef}
        data-chart-export-preserve-bg
        data-chart-export-bg="#eff6ff"
        className="overflow-hidden rounded-xl border border-sky-200/70 bg-sky-50/40 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 text-sm font-semibold uppercase tracking-wide text-sky-900">
            Composição do recebido
          </h3>
          <div className="shrink-0" data-chart-export-ignore>
            <ElementCopyButton
              containerRef={composicaoRecebidoRef}
              preserveBackground
              className="border-sky-200/80 bg-white/80 hover:bg-white"
            />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="min-w-0 text-xs font-medium text-sky-800">{contextoMesAreas}</p>
          {pctPrevistoCaixa != null ? (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium tabular-nums text-sky-900">
              {formatPercent(pctPrevistoCaixa)} do previsto (venc. mês)
            </span>
          ) : null}
        </div>

        <ul className="mt-3 space-y-1">
          {RECEBIDO_GERENCIAL_LINHAS.map((linha) => {
            const valor = fechamento[linha.valorKey]
            if (Math.abs(valor) < 0.01) return null
            const pct = totalRecebido > 0 ? (valor / totalRecebido) * 100 : 0
            const expandido = recebidoExpandido === linha.key
            const vencimentos = recebidoVencimentosPorLinha.get(linha.key) ?? []
            return (
              <li key={linha.key}>
                <button
                  type="button"
                  onClick={() => toggleRecebidoLinha(linha.key)}
                  className="group w-full rounded-lg px-1 py-2 text-left transition-colors hover:bg-white/60"
                  aria-expanded={expandido}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {expandido ? (
                          <ChevronDown
                            className="h-4 w-4 shrink-0 text-sky-600"
                            aria-hidden
                          />
                        ) : (
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-600"
                            aria-hidden
                          />
                        )}
                        <p className="text-sm font-medium text-slate-800">{linha.label}</p>
                      </div>
                      <p className="mt-0.5 pl-5 text-[10px] leading-snug text-slate-500">
                        {linha.hint}
                      </p>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          linha.valorClassName,
                        )}
                      >
                        {formatCurrency(valor)}
                      </span>
                      <span className="text-[10px] font-medium tabular-nums text-slate-500">
                        {formatPercent(pct)}
                      </span>
                    </span>
                  </div>
                </button>
                {expandido ? (
                  <div className="mb-2 mt-1 pl-1">
                    <ReceitaVencimentoGrupoDrillTable
                      variant="recebido"
                      vencimentos={vencimentos}
                      vencExpandido={vencExpandidoRecebido}
                      onToggleVenc={(key) =>
                        setVencExpandidoRecebido((prev) => (prev === key ? null : key))
                      }
                      accent="sky"
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-sky-200/60 pt-2 text-xs font-semibold text-sky-900">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="whitespace-nowrap">= Total recebido</span>
            {recebidoFecha ? (
              <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                fecha
              </span>
            ) : null}
          </span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{formatCurrency(totalRecebido)}</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-red-200/80 bg-red-50/60 p-3">
        {inadHeaderConteudo({ interactive: true })}
        {inadGrupoExpandido ? (
          <div className="mt-3">
            <ReceitaVencimentoGrupoDrillTable
              variant="inad"
              vencimentos={inadVencimentos}
              vencExpandido={vencExpandidoInad}
              onToggleVenc={(key) =>
                setVencExpandidoInad((prev) => (prev === key ? null : key))
              }
            />
          </div>
        ) : null}
        {inadTotalRodape}
      </section>

      <div
        ref={inadExportRef}
        aria-hidden
        data-chart-export-ignore
        data-chart-export-preserve-bg
        data-chart-export-bg="#fef2f2"
        data-chart-export-fit-content
        className="pointer-events-none fixed top-0 -left-[10000px] z-[-1] w-[640px] rounded-xl border border-red-200/80 p-3"
        style={{ backgroundColor: '#fef2f2' }}
      >
        {inadHeaderConteudo()}
        <div className="mt-3">
          <ReceitaVencimentoGrupoDrillTable
            variant="inad"
            vencimentos={inadVencimentos}
            vencExpandido={null}
            onToggleVenc={() => {}}
            expandAllVencimentos
          />
        </div>
        {inadTotalRodape}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/40">
        <button
          type="button"
          onClick={() => setContabilAberto((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
          aria-expanded={contabilAberto}
        >
          <span className="min-w-0 text-xs font-semibold uppercase leading-normal tracking-wide text-slate-600">
            Validação contábil do previsto
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-slate-400 transition-transform',
              contabilAberto && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {contabilAberto ? (
          <div className="border-t border-slate-200/60 px-3 pb-3">
            <ReceitaPrevistoFechamentoContabilPanel
              fechamento={fechamento}
              onDrillDown={onDrillContabil}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
