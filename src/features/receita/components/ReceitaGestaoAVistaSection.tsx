import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, LayoutDashboard, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RECEITA_DEPARTAMENTO_CORES } from '../constants'
import type { ReceitaDepartamentoCoresConfig, ReceitaMesRow } from '../types/receita.types'
import { buildReceitaMetaAreaSlices } from '../utils/departamentoAreaCores'
import { isMesFuturo } from '../utils/receitaMes'
import { useReceitaGestaoVista } from '../hooks/useReceitaGestaoVista'
import type { GestaoVistaMesRow } from '../types/receita.types'
import { ReceitaAreaRecebidoGrupoSheet } from './ReceitaAreaRecebidoGrupoSheet'
import { ReceitaGestaoAVistaKpis } from './ReceitaGestaoAVistaKpis'
import { ReceitaGestaoAVistaTabela } from './ReceitaGestaoAVistaTabela'
import { ReceitaGestaoAVistaTrendChart } from './ReceitaGestaoAVistaTrendChart'
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
  const [detalheConsolidado, setDetalheConsolidado] = useState<GestaoVistaMesRow | null>(null)
  const [detalheArea, setDetalheArea] = useState<GestaoVistaMesRow | null>(null)

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

  const handleMesClick = (row: GestaoVistaMesRow) => {
    if (isMesFuturo(ano, row.mes)) return
    if (row.recebido == null || row.recebido <= 0) return
    if (areaKey && areaSelecionada) {
      setDetalheArea(row)
    } else {
      setDetalheConsolidado(row)
    }
  }

  const rowConsolidado = detalheConsolidado
    ? rows.find((r) => r.mes === detalheConsolidado.mes)
    : null

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
            {expandido ? (
              <p className="mt-1 text-sm text-slate-500">
                Previsto = vencimento · Recebido = caixa · Inad. = snapshot congelado por mês
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-400">Clique para expandir</p>
            )}
          </div>
        </button>

        {expandido && (
          <div className="flex flex-wrap items-center gap-2 pl-8">
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
          <ReceitaGestaoAVistaKpis
            resumo={resumo}
            areaLabel={areaSelecionada?.label}
            loading={loading}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <ReceitaGestaoAVistaTabela
                meses={meses}
                totalYtd={totalYtd}
                onMesClick={handleMesClick}
                loading={loading}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Clique em um mês com recebido para ver a composição do caixa.
              </p>
            </div>
            <div className="xl:col-span-2">
              <ReceitaGestaoAVistaTrendChart meses={meses} loading={loading} />
            </div>
          </div>
        </>
      )}

      {detalheConsolidado && rowConsolidado && (
        <ReceitaRecebidoClassificacaoSheet
          open={!!detalheConsolidado}
          onOpenChange={(open) => {
            if (!open) setDetalheConsolidado(null)
          }}
          ano={ano}
          mes={detalheConsolidado.mes}
          mesLabel={detalheConsolidado.mesLabel}
          totalRecebido={detalheConsolidado.recebido ?? rowConsolidado.recebido}
          totalPrevisto={detalheConsolidado.previsto}
          inadimplenciaMes={detalheConsolidado.inadimplencia}
        />
      )}

      {detalheArea && areaSelecionada && (
        <ReceitaAreaRecebidoGrupoSheet
          open={!!detalheArea}
          onOpenChange={(open) => {
            if (!open) setDetalheArea(null)
          }}
          ano={ano}
          mes={detalheArea.mes}
          mesLabel={detalheArea.mesLabel}
          areaKey={areaSelecionada.key}
          areaLabel={areaSelecionada.label}
          totalRecebido={detalheArea.recebido ?? 0}
        />
      )}
    </section>
  )
}
