import { useState } from 'react'
import { Banknote, CalendarClock, ChevronRight, Receipt, Target, TrendingUp } from 'lucide-react'
import { formatCurrency, formatCurrencyCompact, formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { ReceitaMesRow } from '../types/receita.types'
import { mesAbrev, RECEITA_COLORS } from '../constants'
import { isMesFuturo } from '../utils/receitaMes'
import { ReceitaPrevistoDetalheSheet } from './ReceitaPrevistoDetalheSheet'
import { ReceitaRecebidoKpiDetalheSheet } from './ReceitaRecebidoKpiDetalheSheet'
import { ReceitaEncargosKpiDetalheSheet } from './ReceitaEncargosKpiDetalheSheet'

type Props = {
  rows: ReceitaMesRow[]
  ano: number
  loading?: boolean
}

interface KPIItemProps {
  icon: React.ElementType
  label: string
  value: string
  valueTitle?: string
  valueClassName?: string
  periodo?: string
  hint?: React.ReactNode
  iconColor: string
  valueColor?: string
  accent?: 'sky' | 'violet' | 'amber'
  onClick?: () => void
}

function periodoAnoLabel(meses: number[], ano: number): string {
  const sorted = [...meses].sort((a, b) => a - b)
  if (sorted.length === 0) return String(ano)
  const cap = (m: number) => {
    const abrev = mesAbrev(m)
    return abrev.charAt(0).toUpperCase() + abrev.slice(1)
  }
  const ini = cap(sorted[0])
  const fim = cap(sorted[sorted.length - 1]!)
  if (sorted.length === 1) return `${ini}/${ano}`
  if (sorted.length === 12 && sorted[0] === 1 && sorted[11] === 12) return `Jan–Dez/${ano}`
  return `${ini}–${fim}/${ano}`
}

function KPIItem({
  icon: Icon,
  label,
  value,
  valueTitle,
  valueClassName,
  periodo,
  hint,
  iconColor,
  valueColor = 'text-slate-900',
  accent = 'violet',
  onClick,
}: KPIItemProps) {
  const interactive = Boolean(onClick)
  const Tag = interactive ? 'button' : 'div'
  const accentHover =
    accent === 'sky'
      ? 'hover:border-sky-200 hover:bg-sky-50/30 focus-visible:ring-sky-400/60'
      : accent === 'amber'
        ? 'hover:border-orange-200 hover:bg-orange-50/30 focus-visible:ring-orange-400/60'
        : 'hover:border-violet-200 hover:bg-violet-50/30 focus-visible:ring-violet-400/60'
  const chevronAccent =
    accent === 'sky' ? 'text-sky-500' : accent === 'amber' ? 'text-orange-500' : 'text-violet-500'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative w-full rounded-xl border border-slate-200/60 bg-white p-3 text-left shadow-sm sm:p-4',
        interactive &&
          cn(
            'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2',
            accentHover,
          ),
      )}
    >
      <div
        className={cn(
          'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg sm:right-4 sm:top-4 sm:h-9 sm:w-9',
          iconColor,
        )}
      >
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
      </div>
      <div className="min-w-0 pr-10 sm:pr-11">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-[11px]">
          {label}
        </p>
        <p
          className={cn(
            'mt-1 text-sm font-bold tabular-nums leading-tight sm:text-base',
            valueColor,
            valueClassName,
          )}
          title={valueTitle ?? value}
        >
          {value}
        </p>
        {periodo != null && periodo !== '' && (
          <p className="mt-0.5 text-[10px] font-medium text-slate-600 sm:text-[11px]">{periodo}</p>
        )}
        {hint != null && hint !== '' && (
          <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
            {hint}
            {interactive && (
              <ChevronRight className={cn('h-3 w-3 shrink-0', chevronAccent)} aria-hidden />
            )}
          </p>
        )}
      </div>
    </Tag>
  )
}

function KPISkeleton() {
  return (
    <div className="relative rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <div className="absolute right-3 top-3 h-8 w-8 animate-pulse rounded-lg bg-slate-100 sm:right-4 sm:top-4 sm:h-9 sm:w-9" />
      <div className="min-w-0 pr-10 sm:pr-11">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-5 w-24 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

export function ReceitaKpis({ rows, ano, loading }: Props) {
  const [recebidoAberto, setRecebidoAberto] = useState(false)
  const [encargosAberto, setEncargosAberto] = useState(false)
  const [previstoAberto, setPrevistoAberto] = useState(false)

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <KPISkeleton key={i} />
        ))}
      </div>
    )
  }

  const rowsComDados = rows.filter((r) => !isMesFuturo(ano, r.mes))
  const totalRecebido = rowsComDados.reduce((s, r) => s + r.recebido, 0)
  const totalPrevisto = rows.reduce((s, r) => s + r.previsto, 0)
  const metaAcumulada = rowsComDados.reduce((s, r) => s + r.meta, 0)
  const pctMeta = metaAcumulada > 0 ? (totalRecebido / metaAcumulada) * 100 : 0
  const totalEncargos = rowsComDados.reduce((s, r) => s + r.encargos, 0)

  const metaMensal = rows[0]?.meta ?? 0

  const mesesComEncargos = rowsComDados.filter((r) => r.encargos > 0).map((r) => r.mes)
  const encargosPeriodo = periodoAnoLabel(mesesComEncargos, ano)

  const pctColor =
    pctMeta >= 100
      ? RECEITA_COLORS.meta.textStrong
      : pctMeta >= 80
        ? RECEITA_COLORS.meta.text
        : 'text-emerald-600'
  const pctIcon =
    pctMeta >= 100
      ? 'bg-emerald-100 text-emerald-700'
      : pctMeta >= 80
        ? RECEITA_COLORS.meta.bgIcon
        : 'bg-emerald-50/80 text-emerald-600'

  const mesesNoResumo = rows.map((r) => r.mes)
  const previstoPeriodo = periodoAnoLabel(mesesNoResumo, ano)
  const mesesComRecebido = rowsComDados.filter((r) => r.recebido > 0).map((r) => r.mes)
  const recebidoPeriodo = periodoAnoLabel(mesesComRecebido, ano)

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Resumo {ano}</h2>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KPIItem
          icon={Banknote}
          label="Recebido"
          value={formatCurrency(totalRecebido)}
          valueClassName="text-[11px] min-[420px]:text-xs sm:text-sm"
          periodo={recebidoPeriodo}
          hint="Honorários líquidos · sem encargos · ver detalhe"
          iconColor="bg-sky-50 text-sky-600"
          valueColor={RECEITA_COLORS.recebido.textStrong}
          accent="sky"
          onClick={() => setRecebidoAberto(true)}
        />
        <KPIItem
          icon={Receipt}
          label="Encargos"
          value={formatCurrency(totalEncargos)}
          valueClassName="text-[11px] min-[420px]:text-xs sm:text-sm"
          periodo={encargosPeriodo}
          hint="Boleto e juros · pago − fluxo · ver detalhe"
          iconColor={RECEITA_COLORS.encargos.bgIcon}
          valueColor={RECEITA_COLORS.encargos.textStrong}
          accent="amber"
          onClick={() => setEncargosAberto(true)}
        />
        <KPIItem
          icon={CalendarClock}
          label="Previsto"
          value={formatCurrency(totalPrevisto)}
          valueClassName="text-[11px] min-[420px]:text-xs sm:text-sm"
          periodo={previstoPeriodo}
          hint="Por vencimento · inclui inativos · ver detalhe"
          iconColor="bg-violet-50 text-violet-600"
          valueColor={RECEITA_COLORS.previsto.textStrong}
          accent="violet"
          onClick={() => setPrevistoAberto(true)}
        />
        <KPIItem
          icon={Target}
          label="Meta acumulada"
          value={formatCurrencyCompact(metaAcumulada)}
          valueTitle={formatCurrency(metaAcumulada)}
          hint={metaMensal > 0 ? `${formatCurrencyCompact(metaMensal)}/mês` : undefined}
          iconColor={RECEITA_COLORS.meta.bgIcon}
          valueColor={RECEITA_COLORS.meta.textStrong}
        />
        <KPIItem
          icon={TrendingUp}
          label="Atingimento da meta"
          value={formatPercent(pctMeta)}
          hint={totalRecebido >= metaAcumulada ? 'Meta atingida no período' : 'Recebido ÷ meta acumulada'}
          iconColor={pctIcon}
          valueColor={pctColor}
        />
      </div>

      <ReceitaRecebidoKpiDetalheSheet
        open={recebidoAberto}
        onOpenChange={setRecebidoAberto}
        ano={ano}
        rows={rows}
        totalRecebido={totalRecebido}
      />

      <ReceitaEncargosKpiDetalheSheet
        open={encargosAberto}
        onOpenChange={setEncargosAberto}
        ano={ano}
        rows={rows}
        totalEncargos={totalEncargos}
      />

      <ReceitaPrevistoDetalheSheet
        open={previstoAberto}
        onOpenChange={setPrevistoAberto}
        ano={ano}
        rows={rows}
        totalPrevisto={totalPrevisto}
      />
    </section>
  )
}
