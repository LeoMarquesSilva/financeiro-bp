import { Activity, Eye, Info, Link2, TrendingUp, UserRoundCheck, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MarketingAccountChart } from './MarketingCharts'
import type {
  InstagramAccountInsight,
  InstagramAccountStats,
  InstagramDemographic,
} from './types'

const compact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

function Metric({ label, value, icon: Icon, sub }: { label: string; value: string; icon: typeof Eye; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icon className="h-3.5 w-3.5 text-teal-700" />{label}</div>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
    </div>
  )
}

const countryNames: Record<string, string> = {
  BR: 'Brasil', US: 'Estados Unidos', PT: 'Portugal', AR: 'Argentina', ES: 'Espanha',
  FR: 'França', IT: 'Itália', DE: 'Alemanha', GB: 'Reino Unido', MX: 'México',
}

function DemographicBars({
  title,
  data,
  color,
  format = (value) => value,
}: {
  title: string
  data: InstagramDemographic[]
  color: string
  format?: (value: string) => string
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0) || 1
  const max = Math.max(...data.map((row) => row.value), 1)
  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      {data.length === 0 ? <p className="text-xs text-slate-400">Sem dados disponíveis.</p> : (
        <div className="space-y-2.5">
          {data.slice(0, 8).map((row) => (
            <div key={`${row.breakdown}-${row.label}`}>
              <div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="truncate text-slate-700">{format(row.label)}</span><span className="tabular-nums text-slate-500">{((row.value / total) * 100).toFixed(1)}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${(row.value / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MarketingAudience({
  insights,
  demographics,
  accountHistory,
}: {
  insights: InstagramAccountInsight[]
  demographics: InstagramDemographic[]
  accountHistory: InstagramAccountStats[]
}) {
  const totals = insights.reduce(
    (acc, row) => ({
      reach: acc.reach + row.reach,
      views: acc.views + row.views,
      engaged: acc.engaged + row.accounts_engaged,
      interactions: acc.interactions + row.total_interactions,
      links: acc.links + row.profile_links_taps,
    }),
    { reach: 0, views: 0, engaged: 0, interactions: 0, links: 0 },
  )
  const days = Math.max(insights.length, 1)
  const first = accountHistory[0]
  const latest = accountHistory[accountHistory.length - 1]
  const followerDelta = (latest?.followers_count ?? 0) - (first?.followers_count ?? latest?.followers_count ?? 0)
  const followerRows = demographics.filter((row) => row.kind === 'followers')
  const by = (breakdown: InstagramDemographic['breakdown']) => followerRows.filter((row) => row.breakdown === breakdown).sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950">
        <div className="flex gap-2.5"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /><div><p className="font-semibold">Histórico da conta e limite da Meta</p><p className="mt-1 text-xs leading-relaxed text-sky-900/80">As métricas diárias ficam disponíveis na API por uma janela limitada. A sincronização a cada seis horas persiste os snapshots para que o histórico deste dashboard continue crescendo.</p></div></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Alcance médio/dia" value={compact(totals.reach / days)} icon={Eye} sub={`${insights.length} dias armazenados`} />
        <Metric label="Views médias/dia" value={compact(totals.views / days)} icon={TrendingUp} sub="média da janela" />
        <Metric label="Contas engajadas/dia" value={compact(totals.engaged / days)} icon={UserRoundCheck} sub="média diária" />
        <Metric label="Interações/dia" value={compact(totals.interactions / days)} icon={Activity} sub="média diária" />
        <Metric label="Cliques no perfil" value={compact(totals.links)} icon={Link2} sub="soma da janela" />
        <Metric label="Crescimento seguidores" value={`${followerDelta >= 0 ? '+' : ''}${followerDelta}`} icon={Users} sub="entre snapshots salvos" />
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tendência da conta</CardTitle><p className="text-xs text-slate-500">Cada ponto representa o valor coletado naquele dia</p></CardHeader>
        <CardContent>{insights.length ? <MarketingAccountChart data={insights} /> : <p className="py-20 text-center text-sm text-slate-500">Sincronize a conta para iniciar a série diária.</p>}</CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base">Demografia dos seguidores</CardTitle><p className="text-xs text-slate-500">Snapshot atual fornecido pela Meta para contas elegíveis</p></CardHeader>
        <CardContent className="grid gap-7 md:grid-cols-2 xl:grid-cols-4">
          <DemographicBars title="Gênero" data={by('gender')} color="bg-violet-500" format={(value) => value === 'M' ? 'Masculino' : value === 'F' ? 'Feminino' : value} />
          <DemographicBars title="Faixa etária" data={by('age')} color="bg-sky-500" />
          <DemographicBars title="Países" data={by('country')} color="bg-emerald-500" format={(value) => countryNames[value.toUpperCase()] ?? value} />
          <DemographicBars title="Cidades" data={by('city')} color="bg-amber-500" />
        </CardContent>
      </Card>
    </div>
  )
}
