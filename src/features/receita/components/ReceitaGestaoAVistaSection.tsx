import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, LayoutDashboard, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RECEITA_DEPARTAMENTO_CORES } from '../constants'
import type { ReceitaDepartamentoCoresConfig, ReceitaMesRow } from '../types/receita.types'
import { buildReceitaMetaAreaSlices } from '../utils/departamentoAreaCores'
import { isMesFuturo } from '../utils/receitaMes'
import { useReceitaGestaoVista } from '../hooks/useReceitaGestaoVista'
import type { GestaoVistaMesRow } from '../types/receita.types'
import { ReceitaGestaoAVistaKpis } from './ReceitaGestaoAVistaKpis'
import {
  ReceitaGestaoAVistaTabela,
  type GestaoVistaMesClickColuna,
} from './ReceitaGestaoAVistaTabela'
import { ReceitaRecebidoClassificacaoSheet } from './ReceitaRecebidoClassificacaoSheet'

type Props = {
  ano: number
  rows: ReceitaMesRow[]
  departamentoCores?: ReceitaDepartamentoCoresConfig
  loading?: boolean
}

export function ReceitaGestaoAVistaSection({
  ano,
  rows,
  departamentoCores = RECEITA_DEPARTAMENTO_CORES,
  loading: dashLoading,
}: Props) {
  const [areaKey, setAreaKey] = useState<string | null>(null)
  const [expandido, setExpandido] = useState(true)
  const [detalheMes, setDetalheMes] = useState<GestaoVistaMesRow | null>(null)

  const metaAreaSlices = useMemo(
    () => buildReceitaMetaAreaSlices(departamentoCores),
    [departamentoCores],
  )

  const { meses, resumo, totalYtd, areaSelecionada, isLoading, error } = useReceitaGestaoVista(
    ano,
    rows,
    areaKey,
    metaAreaSlices,
  )

  const loading = Boolean(dashLoading || isLoading)

  useEffect(() => {
    setDetalheMes(null)
  }, [areaKey])

  const handleMesClick = (row: GestaoVistaMesRow, coluna: GestaoVistaMesClickColuna) => {
    if (isMesFuturo(ano, row.mes)) return

    if (coluna === 'recebido') {
      if (row.recebido == null || row.recebido <= 0) return
    } else if (row.previsto <= 0) {
      return
    }

    setDetalheMes(row)
  }

  const rowConsolidado = detalheMes ? rows.find((r) => r.mes === detalheMes.mes) : null

  return (
    <section className="space-y-4">
      <header className="space-y-3">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
          className={cn(
            'group flex w-full items-start gap-2 rounded-lg text-left transition-colors',
            'hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60',
          )}
        >
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 group-hover:text-slate-600"
            aria-hidden
          >
            {expandido ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <LayoutDashboard className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              Gestão à vista · {ano}
            </h2>
            {!expandido && (
              <p className="mt-0.5 text-xs text-slate-400">Clique para expandir</p>
            )}
          </div>
        </button>

        {expandido && (
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setAreaKey(null)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                areaKey == null
                  ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              Todas
            </button>
            {metaAreaSlices.map((area) => {
              const ativo = areaKey === area.key
              return (
                <button
                  key={area.key}
                  type="button"
                  onClick={() => setAreaKey((prev) => (prev === area.key ? null : area.key))}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                    ativo
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  )}
                  style={
                    ativo
                      ? { backgroundColor: area.color, borderColor: area.color }
                      : undefined
                  }
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: area.color }}
                    aria-hidden
                  />
                  {area.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {expandido && error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar gestão à vista: {error.message}
        </p>
      )}

      {expandido && loading && !resumo && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando gestão à vista…
        </div>
      )}

      {expandido && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <ReceitaGestaoAVistaKpis
                resumo={resumo}
                areaLabel={areaSelecionada?.label}
                loading={loading}
                layout="column"
              />
            </div>
            <div className="min-w-0 xl:col-span-3">
              <ReceitaGestaoAVistaTabela
                meses={meses}
                totalYtd={totalYtd}
                onMesClick={handleMesClick}
                loading={loading}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Clique em <strong className="font-medium text-slate-600">Previsto</strong> ou{' '}
                <strong className="font-medium text-slate-600">Recebido</strong> para abrir a visão
                do mês
                {areaKey ? ` (${areaSelecionada?.label})` : ''}.
              </p>
            </div>
          </div>
        </>
      )}

      {detalheMes && (
        <ReceitaRecebidoClassificacaoSheet
          open={!!detalheMes}
          onOpenChange={(open) => {
            if (!open) setDetalheMes(null)
          }}
          ano={ano}
          mes={detalheMes.mes}
          mesLabel={detalheMes.mesLabel}
          totalRecebido={detalheMes.recebido ?? rowConsolidado?.recebido ?? 0}
          totalPrevisto={detalheMes.previsto}
          metaMes={detalheMes.meta}
          areaKey={areaSelecionada?.key ?? null}
          areaLabel={areaSelecionada?.label ?? null}
        />
      )}
    </section>
  )
}
