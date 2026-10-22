import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import type { ReceitaMeGapMeta } from '../utils/receitaMeCalc'
import { receitaMeMesRotulo } from '../utils/receitaMeLabels'

export type ReceitaMeComposicao = {
  recebido: number
  aberto: number
  fora: number
  /** Vencido sem pagamento (inadimplência do mês), fora por padrão. */
  foraAtraso: number
  /** Marcado pelo gerente como "não deve pagar". */
  foraNaoPaga: number
  novas: number
  potencial: number
  me: number
}

type Props = {
  ano: number
  gap: ReceitaMeGapMeta
  /** Ex.: "Jun/26–Dez/26". */
  periodoMeta: string
  /** Ex.: "Out/26–Dez/26". */
  periodoMe: string
  mesCorrente: number | null
  metaHint: string
  composicao: ReceitaMeComposicao
}

function pct(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function Card({
  label,
  value,
  title,
  hint,
  tone,
}: {
  label: string
  value: string
  title?: string
  hint?: React.ReactNode
  tone?: 'negativo' | 'positivo'
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums text-slate-900',
          tone === 'negativo' && 'text-red-600',
          tone === 'positivo' && 'text-emerald-700',
        )}
        title={title}
      >
        {value}
      </p>
      {hint && <div className="mt-1 text-[10px] leading-snug text-slate-500">{hint}</div>}
    </div>
  )
}

/** Cards de resumo da ME: os mesmos no escritório e na área (com os números de cada um). */
export function ReceitaMeResumoCards({ ano, gap, periodoMeta, periodoMe, mesCorrente, metaHint, composicao: c }: Props) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card label={`Meta ${periodoMeta}`} value={formatCurrencyCompact(gap.metaTotal)} title={formatCurrency(gap.metaTotal)} hint={metaHint} />
        <Card
          label={`Projeção ${periodoMeta}`}
          value={formatCurrencyCompact(gap.projecao)}
          title={formatCurrency(gap.projecao)}
          hint={`Realizado ${formatCurrencyCompact(gap.realizadoFechado)} + ME ${formatCurrencyCompact(gap.meAberto)}`}
        />
        <Card
          label="Atingimento projetado"
          value={pct(gap.atingimentoPct)}
          tone={gap.atingimentoPct >= 100 ? 'positivo' : undefined}
        />
        <Card
          label="Gap para a meta"
          value={formatCurrencyCompact(Math.max(0, gap.gap))}
          title={formatCurrency(gap.gap)}
          tone={gap.gap > 0 ? 'negativo' : 'positivo'}
          hint={gap.gap > 0 ? undefined : 'Meta coberta pela projeção'}
        />
        <Card
          label="(−) Fora da estimativa"
          value={formatCurrencyCompact(c.fora)}
          title={formatCurrency(c.fora)}
          tone="negativo"
          hint={
            <>
              <p>Inadimplência (em atraso): {formatCurrencyCompact(c.foraAtraso)}</p>
              <p>Não deve pagar: {formatCurrencyCompact(c.foraNaoPaga)}</p>
            </>
          }
        />
      </div>
      <p className="text-xs text-slate-500">
        Melhor estimativa {periodoMe}:{' '}
        {mesCorrente != null && <>recebido em {receitaMeMesRotulo(ano, mesCorrente)} {formatCurrencyCompact(c.recebido)} + </>}
        em aberto {formatCurrencyCompact(c.aberto)} − fora da estimativa {formatCurrencyCompact(c.fora)} + novas receitas{' '}
        {formatCurrencyCompact(c.novas)} = <span className="font-semibold text-slate-700">{formatCurrencyCompact(c.me)}</span>
        {c.potencial > 0 && ` · potencial com chance baixa: ${formatCurrencyCompact(c.potencial)}`}
      </p>
    </div>
  )
}
