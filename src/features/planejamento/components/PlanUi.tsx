import type { ReactNode } from 'react'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact } from '@/shared/utils/format'
import { AREAS_PLANEJAMENTO, MESES_ABREV, soma } from '../utils/areasPlanejamento'

export function moeda(v: number): string {
  return formatCurrency(v)
}

export function moedaCurta(v: number): string {
  return formatCurrencyCompact(v)
}

export function pct(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

export function PlanKpi({
  rotulo,
  valor,
  sub,
  tom = 'neutro',
  fenixChave,
  explicar,
}: {
  rotulo: string
  valor: string
  sub?: ReactNode
  tom?: 'neutro' | 'bom' | 'ruim' | 'destaque'
  fenixChave?: string
  explicar?: FenixExplicar
}) {
  const fenixId = useFenixAlvo(fenixChave, explicar)
  return (
    <div
      data-fenix={fenixId}
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm',
        tom === 'destaque' && 'border-indigo-200 bg-indigo-50/60',
        tom === 'bom' && 'border-emerald-200',
        tom === 'ruim' && 'border-red-200',
        tom === 'neutro' && 'border-slate-200',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums text-slate-900',
          tom === 'bom' && 'text-emerald-700',
          tom === 'ruim' && 'text-red-700',
        )}
      >
        {valor}
      </p>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export function Secao({ titulo, subtitulo, acoes, children, className }: {
  titulo: string
  subtitulo?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  )
}

export function Aviso({ children, tom = 'ambar' }: { children: ReactNode; tom?: 'ambar' | 'azul' }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2 text-xs',
        tom === 'ambar' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900',
      )}
    >
      {children}
    </div>
  )
}

/** Escritório + 7 áreas. */
export function AreaChips({
  value,
  onChange,
  incluirEscritorio = true,
  areas,
}: {
  value: string
  onChange: (v: string) => void
  incluirEscritorio?: boolean
  areas?: readonly { key: string; nome: string }[]
}) {
  const lista = [
    ...(incluirEscritorio ? [{ key: 'escritorio', nome: 'Escritório' }] : []),
    ...(areas ?? AREAS_PLANEJAMENTO.map((a) => ({ key: a.key, nome: a.nome }))),
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => onChange(a.key)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === a.key
              ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
        >
          {a.nome}
        </button>
      ))}
    </div>
  )
}

export type LinhaMeses = {
  rotulo: string
  valores: readonly (number | null)[]
  /** Total da linha; padrão = soma (moeda) ou nada (pct). */
  total?: number | null
  formato?: 'moeda' | 'pct' | 'num'
  destaque?: boolean
  projetado?: readonly boolean[]
  sub?: boolean
}

function fmt(v: number | null | undefined, formato: LinhaMeses['formato']): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (formato === 'pct') return pct(v)
  if (formato === 'num') return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  return formatCurrency(v).replace(/\s/g, ' ')
}

/** Tabela mês a mês (jan–dez + total). Células projetadas aparecem em itálico. */
export function TabelaMeses({ linhas, rotuloTotal = 'Total', ano }: { linhas: LinhaMeses[]; rotuloTotal?: string; ano?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="sticky left-0 z-10 bg-white px-2 py-1.5 text-left font-medium">{ano ? String(ano) : ''}</th>
            {MESES_ABREV.map((m) => (
              <th key={m} className="px-2 py-1.5 text-right font-medium">
                {m}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right font-semibold text-slate-700">{rotuloTotal}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const total =
              l.total !== undefined
                ? l.total
                : l.formato === 'pct'
                  ? null
                  : soma(l.valores.map((v) => (v == null ? 0 : v)))
            return (
              <tr key={l.rotulo} className={cn('border-b border-slate-100', l.destaque && 'bg-slate-50 font-semibold')}>
                <td
                  className={cn(
                    'sticky left-0 z-10 whitespace-nowrap px-2 py-1.5 text-left text-slate-700',
                    l.destaque ? 'bg-slate-50' : 'bg-white',
                    l.sub && 'pl-5 font-normal text-slate-500',
                  )}
                >
                  {l.rotulo}
                </td>
                {l.valores.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      'whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-800',
                      l.projetado?.[i] && 'italic text-indigo-700',
                    )}
                  >
                    {fmt(v, l.formato)}
                  </td>
                ))}
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                  {fmt(total, l.formato)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function CarregandoBloco({ altura = 'h-64' }: { altura?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-slate-100', altura)} />
}

export function ErroBloco({ erro, contexto }: { erro: unknown; contexto: string }) {
  return (
    <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
      Erro ao carregar {contexto}: {erro instanceof Error ? erro.message : String((erro as { message?: string })?.message ?? erro)}
    </p>
  )
}

export function VarPct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-400">—</span>
  return <span className={cn('tabular-nums', v >= 0 ? 'text-emerald-700' : 'text-red-700')}>{v >= 0 ? '+' : ''}{pct(v)}</span>
}
