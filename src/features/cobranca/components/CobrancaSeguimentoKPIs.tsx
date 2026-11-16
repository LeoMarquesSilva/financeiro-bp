import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { AlertTriangle, Clock, Users, type LucideIcon } from 'lucide-react'
import type { CobrancaSeguimentoGrupo, CobrancaSeguimentoKpis } from '../types/cobrancaSeguimento.types'
import { CobrancaSeguimentoDepartamentosPie } from './CobrancaSeguimentoDepartamentosPie'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import {
  explicarPontualFaixa31a60,
  explicarPontualGrupos,
  explicarPontualValorEmAberto,
  type PontualFenixContexto,
} from '../fenix/cobrancaFenix'

interface Props {
  kpis: CobrancaSeguimentoKpis
  grupos: CobrancaSeguimentoGrupo[]
  loading?: boolean
  /** Tela e filtros para o Fênix explicar os cards (os grupos vêm de `grupos`). */
  fenixContexto?: Omit<PontualFenixContexto, 'grupos'>
}

type StatCard = {
  label: string
  value: string
  icon: LucideIcon
  color: string
  hint?: string
  fenix?: { chave: string; explicar: FenixExplicar }
}

function kpiValueSizeClass(value: string): string {
  const len = value.length
  if (len <= 6) return 'cobranca-kpi-value cobranca-kpi-value--short'
  if (len <= 13) return 'cobranca-kpi-value'
  return 'cobranca-kpi-value cobranca-kpi-value--long'
}

function CobrancaSeguimentoStatCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
  loading,
  fenix,
}: StatCard & { loading?: boolean }) {
  const fenixId = useFenixAlvo(loading ? undefined : fenix?.chave, fenix?.explicar)
  const displayValue = loading ? '…' : value

  return (
    <Card className="cobranca-kpi-card flex h-full flex-col p-4" data-fenix={fenixId}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={cn('h-4 w-4 shrink-0', color)} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center pt-2">
        <p
          className={cn(
            'font-bold tabular-nums text-slate-900',
            !loading && kpiValueSizeClass(value),
          )}
          title={loading ? undefined : value}
        >
          {displayValue}
        </p>
        {hint && !loading && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    </Card>
  )
}

export function CobrancaSeguimentoKPIs({ kpis, grupos, loading, fenixContexto }: Props) {
  const ctx: PontualFenixContexto | null = fenixContexto ? { ...fenixContexto, grupos } : null
  const cards: StatCard[] = [
    {
      label: 'Valor em aberto',
      value: formatCurrency(kpis.valor_total),
      icon: AlertTriangle,
      color: 'text-red-600',
      fenix: ctx
        ? { chave: 'pontual.resumo.valor-aberto', explicar: () => explicarPontualValorEmAberto(ctx, kpis.valor_total) }
        : undefined,
    },
    {
      label: 'Grupos devedores',
      value: String(kpis.qtd_grupos),
      icon: Users,
      color: 'text-slate-700',
      fenix: ctx
        ? { chave: 'pontual.resumo.grupos', explicar: () => explicarPontualGrupos(ctx, kpis.qtd_grupos) }
        : undefined,
    },
    {
      label: 'Faixa 31–60 dias',
      value: formatCurrency(kpis.valor_faixa_31_60),
      icon: Clock,
      color: 'text-amber-600',
      hint: `${kpis.media_dias_atraso} dias (média)`,
      fenix: ctx
        ? {
            chave: 'pontual.resumo.faixa-31-60',
            explicar: () => explicarPontualFaixa31a60(ctx, kpis.valor_faixa_31_60, kpis.media_dias_atraso),
          }
        : undefined,
    },
  ]

  return (
    <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.slice(0, 2).map((c) => (
        <CobrancaSeguimentoStatCard key={c.label} {...c} loading={loading} />
      ))}

      <CobrancaSeguimentoDepartamentosPie
        grupos={grupos}
        loading={loading}
        fenixContexto={ctx ? { ...ctx, valorEmAberto: kpis.valor_total } : undefined}
      />

      {cards.slice(2).map((c) => (
        <CobrancaSeguimentoStatCard key={c.label} {...c} loading={loading} />
      ))}
    </div>
  )
}
