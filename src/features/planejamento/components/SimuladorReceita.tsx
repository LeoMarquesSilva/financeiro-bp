import { CheckCircle2, Lock, LockOpen, RotateCcw, Target, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import { AREAS_2027, AREAS_PLANEJAMENTO, soma, variacaoPct, type AreaKey } from '../utils/areasPlanejamento'
import type { BaseAno } from '../utils/planejamentoBase'
import type { PremissaArea, ResultadoSimulacao } from '../utils/planejamentoCalc'
import { fenixMetaEscritorio } from '../fenix/planejamentoFenix'
import { NumInput } from './NumInput'
import { Secao, VarPct, moeda, moedaCurta, pct } from './PlanUi'

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Controle deslizante de %; `marca` desenha um traço de referência (ex.: crescimento 25→26). */
function SliderPct({
  value,
  onChange,
  min,
  max,
  step = 0.5,
  marca,
  apagado,
  ariaLabel,
  grande,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  marca?: { valor: number; rotulo: string } | null
  apagado?: boolean
  ariaLabel: string
  grande?: boolean
}) {
  const pos = (v: number) => `${((limitar(v, min, max) - min) / (max - min)) * 100}%`
  return (
    <div className="relative w-full">
      {marca && marca.valor >= min && marca.valor <= max && (
        <div className="pointer-events-none absolute -top-1 bottom-0 z-10" style={{ left: pos(marca.valor) }} title={marca.rotulo}>
          <div className={cn('-ml-px w-0.5 rounded bg-emerald-500/70', grande ? 'h-6' : 'h-4')} />
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={limitar(value, min, max)}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'w-full cursor-pointer',
          grande ? 'h-2' : 'h-1.5',
          apagado ? 'accent-slate-400 opacity-80' : 'accent-indigo-600',
        )}
      />
    </div>
  )
}

const ATALHOS = [0, 10, 15, 20, 30]

/** Bloco do topo: a meta de crescimento da receita do escritório. */
export function MetaCrescimento({
  resultado,
  crescimentoPct,
  onCrescimento,
  receita2025,
}: {
  resultado: ResultadoSimulacao
  crescimentoPct: number | null
  onCrescimento: (v: number) => void
  /** Receita 2025 do escritório (áreas + sem área), para mostrar o crescimento 25→26 como referência. */
  receita2025: number
}) {
  const d = resultado.desdobramento
  const esc = resultado.escritorio
  const somaAreas = esc.receitaAno
  const efetivo = d.receitaBase > 0 ? (somaAreas / d.receitaBase - 1) * 100 : 0
  const valor = crescimentoPct ?? efetivo
  const meta = d.metaReceita ?? somaAreas
  const hist = receita2025 > 0 ? (d.receitaBase / receita2025 - 1) * 100 : null
  const max = Math.max(60, Math.ceil(((hist ?? 0) + 10) / 10) * 10)
  const encerradas = AREAS_PLANEJAMENTO.filter((a) => a.encerrada)
  const receitaEncerradas = soma(encerradas.map((a) => resultado.areas[a.key].receitaBaseAno))
  const fecha = d.metaReceita != null && Math.abs(d.diferenca) < 1
  const fenix = useFenixAlvo('planejamento.simulador.meta-escritorio', () => fenixMetaEscritorio({ resultado, crescimentoPct }))

  return (
    <section data-fenix={fenix} className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <Target className="mt-0.5 h-5 w-5 text-indigo-600" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Quanto o escritório quer crescer em receita em 2027?</h2>
              <p className="text-xs text-slate-500">
                Sobre a receita 2026 (realizado + Melhor Estimativa). Essa meta é desdobrada nas áreas logo abaixo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <p className={cn('text-5xl font-bold tabular-nums tracking-tight', valor >= 0 ? 'text-indigo-700' : 'text-red-700')}>
              {valor >= 0 ? '+' : ''}
              {pct(valor)}
            </p>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500">
              digitar:
              <NumInput value={Math.round(valor * 100) / 100} onChange={onCrescimento} sufixo="%" className="w-24" ariaLabel="Meta de crescimento da receita do escritório" />
            </label>
          </div>
          <div className="space-y-1">
            <SliderPct
              value={valor}
              onChange={onCrescimento}
              min={-20}
              max={max}
              grande
              marca={hist == null ? null : { valor: hist, rotulo: `Crescimento 2025→2026: ${pct(hist)}` }}
              ariaLabel="Meta de crescimento da receita do escritório"
            />
            <div className="flex justify-between text-[10px] tabular-nums text-slate-400">
              <span>−20%</span>
              <span>0%</span>
              <span>+{max}%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ATALHOS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onCrescimento(v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  crescimentoPct === v ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300',
                )}
              >
                {v === 0 ? 'Manter 2026 (0%)' : `+${v}%`}
              </button>
            ))}
            {hist != null && (
              <button
                type="button"
                onClick={() => onCrescimento(Math.round(hist * 10) / 10)}
                className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                title="Usar o mesmo crescimento de 2025 para 2026"
              >
                Repetir 25→26 ({pct(hist)})
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
            <span>Receita 2026 (realizado + ME)</span>
            <span className="tabular-nums text-slate-700">{moeda(d.receitaBase)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">Meta de receita 2027</span>
            <span className="text-2xl font-bold tabular-nums text-slate-900">{moeda(meta)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
            <span>A mais que 2026</span>
            <span className={cn('font-semibold tabular-nums', meta - d.receitaBase >= 0 ? 'text-emerald-700' : 'text-red-700')}>
              {meta - d.receitaBase >= 0 ? '+' : ''}
              {moeda(meta - d.receitaBase)}
            </span>
          </div>
          {receitaEncerradas > 0 && (
            <p className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
              {encerradas.map((a) => a.nome.replace(' (encerrada)', '')).join(', ')} teve {moedaCurta(receitaEncerradas)} em 2026 e foi encerrada: as outras
              áreas precisam cobrir esse valor.
            </p>
          )}
          {d.metaReceita == null ? (
            <p className="flex items-start gap-1.5 text-[11px] text-sky-800">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Este cenário ainda não tem meta do escritório: o total é a soma das áreas. Mexa no controle para definir a meta.
            </p>
          ) : fecha ? (
            <p className="flex items-start gap-1.5 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              As áreas fecham a meta
              {d.areasAutomaticas.length > 0 ? ` (áreas no automático com ${d.crescimentoAutomaticoPct >= 0 ? '+' : ''}${pct(d.crescimentoAutomaticoPct)})` : ''}.
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-[11px] font-medium text-amber-800">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              A soma das áreas fica {moeda(Math.abs(d.diferenca))} {d.diferenca > 0 ? 'acima' : 'abaixo'} da meta.
              {d.areasAutomaticas.length === 0 ? ' Solte uma área (automático) para ela fechar a diferença.' : ''}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/** Desdobramento da meta por área: % automático (fecha a meta) ou fixado, receita nova e meta em R$. */
export function DesdobramentoAreas({
  resultado,
  base2025,
  areas,
  onArea,
  onSoltarTodas,
}: {
  resultado: ResultadoSimulacao
  base2025: BaseAno
  areas: Record<AreaKey, PremissaArea>
  onArea: (area: AreaKey, mudanca: Partial<PremissaArea>) => void
  onSoltarTodas: () => void
}) {
  const d = resultado.desdobramento
  const maxMeta = Math.max(1, ...AREAS_2027.map((a) => Math.max(resultado.areas[a.key].receitaAno, resultado.areas[a.key].receitaBaseAno)))
  const fixadas = AREAS_2027.filter((a) => areas[a.key].crescimentoPct != null).length
  const esc = resultado.escritorio

  return (
    <Secao
      titulo="Desdobramento da meta por área"
      subtitulo={
        <>
          As áreas no <strong>automático</strong> crescem o mesmo % e se ajustam sozinhas para fechar a meta do escritório. Arraste o controle de uma área
          para <strong>fixar</strong> o % dela; as automáticas se reequilibram. O traço verde marca o crescimento da área de 2025 para 2026.
        </>
      }
      acoes={
        fixadas > 0 ? (
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onSoltarTodas}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Todas no automático
          </Button>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[660px]">
          <div className="grid grid-cols-[minmax(140px,1.1fr)_minmax(110px,1.5fr)_160px_92px_minmax(128px,1fr)] gap-2 border-b border-slate-200 px-2 pb-1.5 text-[11px] font-medium text-slate-500">
            <span>Área · receita 2026</span>
            <span>Crescimento 2027</span>
            <span />
            <span title="Clientes ou serviços novos, além do crescimento %">Receita nova (R$/ano)</span>
            <span className="text-right">Meta de receita 2027</span>
          </div>
          {AREAS_2027.map((a) => {
            const p = areas[a.key]
            const ra = resultado.areas[a.key]
            const fixada = p.crescimentoPct != null
            const valor = ra.crescimentoOrganicoPct ?? 0
            const r25 = soma(base2025.areas[a.key].receita)
            const hist = r25 > 0 ? variacaoPct(ra.receitaBaseAno, r25) : null
            const delta = ra.receitaAno - ra.receitaBaseAno
            const larguraBase = (Math.min(ra.receitaBaseAno, ra.receitaAno) / maxMeta) * 100
            const larguraDelta = (Math.abs(delta) / maxMeta) * 100
            return (
              <div
                key={a.key}
                className={cn(
                  'grid grid-cols-[minmax(140px,1.1fr)_minmax(110px,1.5fr)_160px_92px_minmax(128px,1fr)] items-center gap-2 border-b border-slate-100 px-2 py-2.5',
                  fixada && 'bg-amber-50/40',
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.cor }} aria-hidden />
                    {a.nome}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {moedaCurta(ra.receitaBaseAno)} · 25→26 {hist == null ? <span className="text-slate-400">nova</span> : <VarPct v={hist} />}
                  </p>
                </div>
                <SliderPct
                  value={valor}
                  onChange={(v) => onArea(a.key, { crescimentoPct: v })}
                  min={-50}
                  max={100}
                  apagado={!fixada}
                  marca={hist == null ? null : { valor: hist, rotulo: `25→26: ${pct(hist)}` }}
                  ariaLabel={`Crescimento ${a.nome}`}
                />
                <div className="flex items-center gap-1.5">
                  <NumInput
                    value={Math.round(valor * 100) / 100}
                    onChange={(v) => onArea(a.key, { crescimentoPct: v })}
                    sufixo="%"
                    className="w-[72px]"
                    ariaLabel={`Crescimento % ${a.nome}`}
                  />
                  <button
                    type="button"
                    onClick={() => onArea(a.key, { crescimentoPct: fixada ? null : Math.round(valor * 100) / 100 })}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                      fixada ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300',
                    )}
                    title={fixada ? 'Voltar ao automático (a área passa a fechar a meta)' : 'Fixar este %'}
                  >
                    {fixada ? <Lock className="h-3 w-3" aria-hidden /> : <LockOpen className="h-3 w-3" aria-hidden />}
                    {fixada ? 'fixado' : 'automático'}
                  </button>
                </div>
                <NumInput value={p.receitaNova} onChange={(v) => onArea(a.key, { receitaNova: v })} casas={0} ariaLabel={`Receita nova ${a.nome}`} />
                <div className="text-right">
                  <p className="text-[13px] font-semibold tabular-nums text-slate-900">{moeda(ra.receitaAno)}</p>
                  <p className={cn('text-[11px] tabular-nums', delta >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {delta >= 0 ? '+' : '−'}
                    {moedaCurta(Math.abs(delta))} vs. 2026
                  </p>
                  <div className="mt-1 flex h-1.5 w-full justify-end overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full" style={{ width: `${larguraBase}%`, background: a.cor, opacity: 0.35 }} />
                    <div className={cn('h-full', delta < 0 && 'bg-red-400')} style={{ width: `${larguraDelta}%`, background: delta >= 0 ? a.cor : undefined }} />
                  </div>
                </div>
              </div>
            )
          })}
          {AREAS_PLANEJAMENTO.filter((a) => a.encerrada).map((a) => (
            <div
              key={a.key}
              className="grid grid-cols-[minmax(140px,1.1fr)_minmax(110px,1.5fr)_160px_92px_minmax(128px,1fr)] items-center gap-2 border-b border-slate-100 px-2 py-2 text-slate-400"
            >
              <div>
                <p className="text-sm">{a.nome}</p>
                <p className="text-[11px]">{moedaCurta(resultado.areas[a.key].receitaBaseAno)} em 2026</p>
              </div>
              <span className="col-span-3 text-[11px] italic">Área encerrada: sem receita em 2027. O valor de 2026 fica na base do escritório.</span>
              <p className="text-right text-sm tabular-nums">{moeda(0)}</p>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(140px,1.1fr)_minmax(110px,1.5fr)_160px_92px_minmax(128px,1fr)] items-center gap-2 bg-slate-50 px-2 py-2.5 text-sm font-semibold">
            <div>
              Escritório
              <p className="text-[11px] font-normal text-slate-500">{moedaCurta(d.receitaBase)} em 2026</p>
            </div>
            <div className="text-xs font-normal text-slate-600">
              {d.areasAutomaticas.length > 0 ? (
                <>
                  Automáticas: <span className="font-semibold tabular-nums text-indigo-700">{pct(d.crescimentoAutomaticoPct)}</span> ({d.areasAutomaticas.length}{' '}
                  {d.areasAutomaticas.length === 1 ? 'área' : 'áreas'})
                </>
              ) : (
                'Todas as áreas com % fixado'
              )}
            </div>
            <div className="text-xs">
              <VarPct v={variacaoPct(esc.receitaAno, d.receitaBase)} /> <span className="font-normal text-slate-500">no total</span>
            </div>
            <p className="text-right text-xs tabular-nums">{moeda(soma(AREAS_2027.map((a) => areas[a.key].receitaNova)))}</p>
            <p className="text-right tabular-nums">{moeda(esc.receitaAno)}</p>
          </div>
        </div>
      </div>
    </Secao>
  )
}
