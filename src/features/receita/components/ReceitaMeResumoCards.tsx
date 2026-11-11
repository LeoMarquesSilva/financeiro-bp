import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import type { ReceitaMeGapMeta, ReceitaMeMesAMes } from '../utils/receitaMeCalc'
import { receitaMeMesRotulo } from '../utils/receitaMeLabels'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import {
  explicarMeAtingimento,
  explicarMeComposicao,
  explicarMeFora,
  explicarMeGap,
  explicarMeMeta,
  explicarMeProjecao,
  type ReceitaMeFenixContexto,
} from '../fenix/receitaFenix'

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
  /** Contexto para o Fênix explicar os cards (escritório ou área). */
  fenix?: {
    escopo: string
    pctArea?: number
    linhas: readonly ReceitaMeMesAMes[]
  }
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
  fenix,
}: {
  label: string
  value: string
  title?: string
  hint?: React.ReactNode
  tone?: 'negativo' | 'positivo'
  fenix?: { chave: string; explicar: FenixExplicar }
}) {
  const fenixId = useFenixAlvo(fenix?.chave, fenix?.explicar)
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4" data-fenix={fenixId}>
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
export function ReceitaMeResumoCards({
  ano,
  gap,
  periodoMeta,
  periodoMe,
  mesCorrente,
  metaHint,
  composicao: c,
  fenix,
}: Props) {
  const ctx: ReceitaMeFenixContexto | null = fenix
    ? { ano, gap, periodoMeta, periodoMe, mesCorrente, composicao: c, ...fenix }
    : null
  /** Liga o card ao Fênix com a explicação montada a partir dos mesmos valores. */
  const alvo = (chave: string, explicar: (ctx: ReceitaMeFenixContexto) => ReturnType<FenixExplicar>) =>
    ctx ? { chave: `receita.me.${chave}`, explicar: () => explicar(ctx) } : undefined
  const composicaoId = useFenixAlvo(ctx ? 'receita.me.composicao' : undefined, ctx ? () => explicarMeComposicao(ctx) : undefined)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card label={`Meta ${periodoMeta}`} value={formatCurrencyCompact(gap.metaTotal)} title={formatCurrency(gap.metaTotal)} hint={metaHint} fenix={alvo('meta', explicarMeMeta)} />
        <Card
          label={`Projeção ${periodoMeta}`}
          value={formatCurrencyCompact(gap.projecao)}
          title={formatCurrency(gap.projecao)}
          hint={`Realizado ${formatCurrencyCompact(gap.realizadoFechado)} + ME ${formatCurrencyCompact(gap.meAberto)}`}
          fenix={alvo('projecao', explicarMeProjecao)}
        />
        <Card
          label="Atingimento projetado"
          value={pct(gap.atingimentoPct)}
          tone={gap.atingimentoPct >= 100 ? 'positivo' : undefined}
          fenix={alvo('atingimento', explicarMeAtingimento)}
        />
        <Card
          label="Gap para a meta"
          value={formatCurrencyCompact(Math.max(0, gap.gap))}
          title={formatCurrency(gap.gap)}
          tone={gap.gap > 0 ? 'negativo' : 'positivo'}
          hint={gap.gap > 0 ? undefined : 'Meta coberta pela projeção'}
          fenix={alvo('gap', explicarMeGap)}
        />
        <Card
          label="(−) Fora da estimativa"
          value={formatCurrencyCompact(c.fora)}
          title={formatCurrency(c.fora)}
          tone="negativo"
          fenix={alvo('fora', explicarMeFora)}
          hint={
            <>
              <p>Inadimplência (em atraso): {formatCurrencyCompact(c.foraAtraso)}</p>
              <p>Não deve pagar: {formatCurrencyCompact(c.foraNaoPaga)}</p>
            </>
          }
        />
      </div>
      <p className="w-fit text-xs text-slate-500" data-fenix={composicaoId}>
        Melhor estimativa {periodoMe}:{' '}
        {mesCorrente != null && <>recebido em {receitaMeMesRotulo(ano, mesCorrente)} {formatCurrencyCompact(c.recebido)} + </>}
        em aberto {formatCurrencyCompact(c.aberto)} − fora da estimativa {formatCurrencyCompact(c.fora)} + novas receitas{' '}
        {formatCurrencyCompact(c.novas)} = <span className="font-semibold text-slate-700">{formatCurrencyCompact(c.me)}</span>
        {c.potencial > 0 && ` · potencial com chance baixa: ${formatCurrencyCompact(c.potencial)}`}
      </p>
    </div>
  )
}
