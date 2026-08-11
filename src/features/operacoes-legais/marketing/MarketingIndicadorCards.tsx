import { FileText, Heart, Smartphone, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketingIndicadorKpi } from './computeMarketingIndicadores'

function IndicadorCard({
  kpi,
  icon: Icon,
  iconWrapClass,
  showCrescimento,
}: {
  kpi: MarketingIndicadorKpi
  icon: typeof Smartphone
  iconWrapClass: string
  showCrescimento?: boolean
}) {
  return (
    <article className="flex min-h-[180px] flex-col gap-1.5 rounded-[10px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-base',
            iconWrapClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {kpi.titulo}
        </h3>
      </div>

      <p
        className="text-[26px] font-bold tabular-nums leading-tight"
        style={{ color: kpi.corValor }}
      >
        {kpi.valorPrincipal}{' '}
        <span className="text-[22px]">({kpi.pctMetaFormatado})</span>
      </p>

      {showCrescimento && kpi.crescimento ? (
        <div className="mt-0.5 flex items-center justify-between rounded-md bg-slate-50 px-2 py-1">
          <span className="text-[10px] font-medium text-slate-500">Crescimento:</span>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: kpi.crescimento.cor }}
          >
            {kpi.crescimento.texto}
          </span>
        </div>
      ) : (
        <div className="h-[39px]" aria-hidden />
      )}

      <p className="text-[11px] leading-snug text-slate-400">{kpi.descricao}</p>

      <p className="mt-1.5 text-[11px] text-slate-500">
        Meta:{' '}
        <span className="font-semibold text-emerald-600">{kpi.metaLabel}</span>
      </p>
    </article>
  )
}

export function MarketingIndicadorCards({
  kpis,
  loading,
  copyAttr,
}: {
  kpis: {
    posts: MarketingIndicadorKpi
    engajamento: MarketingIndicadorKpi
    pautas: MarketingIndicadorKpi
    alcance: MarketingIndicadorKpi
  }
  loading?: boolean
  /** Inclui no “COPIAR” do Overview Ops Legais. */
  copyAttr?: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[180px] animate-pulse rounded-[10px] bg-slate-100" />
        ))}
      </div>
    )
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      {...(copyAttr ? { 'data-overview-copy-card': true } : {})}
    >
      <IndicadorCard
        kpi={kpis.posts}
        icon={Smartphone}
        iconWrapClass="bg-rose-50 text-rose-700"
      />
      <IndicadorCard
        kpi={kpis.engajamento}
        icon={Heart}
        iconWrapClass="bg-rose-50 text-rose-700"
      />
      <IndicadorCard
        kpi={kpis.pautas}
        icon={FileText}
        iconWrapClass="bg-rose-50 text-rose-700"
      />
      <IndicadorCard
        kpi={kpis.alcance}
        icon={Users}
        iconWrapClass="bg-sky-50 text-sky-700"
        showCrescimento
      />
    </div>
  )
}
