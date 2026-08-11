import { useMemo, useState, type ReactNode } from 'react'
import { Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  buildMonthlyIndicadoresSeries,
  computeMarketingIndicadores,
} from './computeMarketingIndicadores'
import { filterPostsByPeriod } from './instagramAnalytics'
import { resolveInstagramPeriod } from './instagramPeriod'
import { MarketingIndicadorCards } from './MarketingIndicadorCards'
import { MarketingIndicadorSeriesChart } from './MarketingCharts'
import type { InstagramPost } from './types'

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

const BTN =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function MarketingIndicadores({ allPosts }: { allPosts: InstagramPost[] }) {
  const anos = useMemo(() => {
    const set = new Set(
      allPosts.flatMap((p) => (p.published_at ? [Number(p.published_at.slice(0, 4))] : [])),
    )
    const list = [...set].filter((n) => Number.isFinite(n)).sort((a, b) => b - a)
    return list.length ? list : [new Date().getFullYear()]
  }, [allPosts])

  const [ano, setAno] = useState(() => anos[0] ?? new Date().getFullYear())
  const [mes, setMes] = useState<number | null>(null)

  const anoEfetivo = anos.includes(ano) ? ano : anos[0]

  const range = resolveInstagramPeriod(
    mes == null
      ? { kind: 'year', year: anoEfetivo }
      : { kind: 'month', year: anoEfetivo, month: mes },
  )
  const posts = filterPostsByPeriod(allPosts, range)
  const kpis = computeMarketingIndicadores(posts, allPosts, range)
  const series = buildMonthlyIndicadoresSeries(allPosts, anoEfetivo, mes)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Indicadores de Marketing</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Cards e evolução mensal vs metas do BI no período selecionado.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Ano
          </span>
          {anos.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setAno(y)
                setMes(null)
              }}
              className={cn(BTN, y === anoEfetivo ? BTN_ON : BTN_OFF)}
              aria-pressed={y === anoEfetivo}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ml-5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Mês
          </span>
          <button
            type="button"
            onClick={() => setMes(null)}
            className={cn(BTN, mes == null ? BTN_ON : BTN_OFF)}
            aria-pressed={mes == null}
          >
            Todos os meses
          </button>
          {MESES_CURTOS.map((label, idx) => {
            const m = idx + 1
            return (
              <button
                key={label}
                type="button"
                onClick={() => setMes(m)}
                className={cn(BTN, mes === m ? BTN_ON : BTN_OFF)}
                aria-pressed={mes === m}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <MarketingIndicadorCards kpis={kpis} />

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Posts — acompanhamento mensal"
          subtitle="Volume publicado vs ritmo da meta anual (12 posts/mês)"
        >
          <MarketingIndicadorSeriesChart
            data={series}
            valueKey="posts"
            metaKey="postsMetaMensal"
            valueName="Posts"
            metaName="Meta mensal"
            formatValue={(n) => Math.round(n).toLocaleString('pt-BR')}
          />
        </ChartCard>
        <ChartCard
          title="Engajamento — acompanhamento mensal"
          subtitle="Taxa média do mês vs meta de 3,50%"
        >
          <MarketingIndicadorSeriesChart
            data={series}
            valueKey="engajamentoPct"
            metaKey="engajamentoMeta"
            valueName="Engajamento"
            metaName="Meta 3,50%"
            percent
          />
        </ChartCard>
        <ChartCard
          title="Pautas — acompanhamento mensal"
          subtitle="Realizadas no mês vs meta de 10 pautas/mês"
        >
          <MarketingIndicadorSeriesChart
            data={series}
            valueKey="pautas"
            metaKey="pautasMeta"
            valueName="Pautas"
            metaName="Meta 10"
            formatValue={(n) => Math.round(n).toLocaleString('pt-BR')}
          />
        </ChartCard>
        <ChartCard
          title="Alcance — acompanhamento mensal"
          subtitle="Alcance do mês vs meta de 15.000 pessoas"
        >
          <MarketingIndicadorSeriesChart
            data={series}
            valueKey="alcance"
            metaKey="alcanceMeta"
            valueName="Alcance"
            metaName="Meta 15.000"
            formatValue={(n) => Math.round(n).toLocaleString('pt-BR')}
          />
        </ChartCard>
      </div>
    </div>
  )
}
