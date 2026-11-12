import type { ReactNode } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AREAS_2027, MESES_ABREV, soma, variacaoPct, type AreaKey } from '../utils/areasPlanejamento'
import { novaContratacao, type Contratacao, type PremissaArea, type PremissasEscritorio, type ResultadoSimulacao } from '../utils/planejamentoCalc'
import type { PlanPessoasRow } from '../types'
import { NumInput } from './NumInput'
import { Secao, VarPct, moeda, moedaCurta, pct } from './PlanUi'

const MESES_OPC = MESES_ABREV.map((m, i) => ({ v: i + 1, l: m }))

function SeletorMes({ value, onChange, ariaLabel, prefixo = '' }: { value: number; onChange: (m: number) => void; ariaLabel: string; prefixo?: string }) {
  return (
    <select
      value={value}
      onChange={(ev) => onChange(Number(ev.target.value))}
      className="h-7 rounded-md border border-amber-300 bg-amber-50 px-1 text-xs"
      aria-label={ariaLabel}
    >
      {MESES_OPC.map((m) => (
        <option key={m.v} value={m.v}>
          {prefixo}
          {m.l}
        </option>
      ))}
    </select>
  )
}

/** Headcount mais recente de 2026 (até o último mês fechado) por área. */
function headcountAtual(rows: readonly PlanPessoasRow[] | undefined, area: string, ultimoMesFechado: number): number | null {
  for (let m = ultimoMesFechado; m >= 1; m--) {
    const v = (rows ?? []).filter((r) => r.area_key === area && r.mes === m && r.headcount != null)
    if (v.length) return soma(v.map((r) => r.headcount ?? 0))
  }
  return null
}

function Linha({ rotulo, valor, sinal, forte, children }: { rotulo: ReactNode; valor: number; sinal?: '+' | '='; forte?: boolean; children?: ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 py-1 text-xs', forte && 'border-t border-slate-200 pt-1.5 font-semibold text-slate-900')}>
      <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
        {sinal && <span className="w-3 shrink-0 text-center text-slate-400">{sinal}</span>}
        {rotulo}
        {children}
      </span>
      <span className={cn('shrink-0 tabular-nums', !forte && valor === 0 && 'text-slate-400')}>{moeda(valor)}</span>
    </div>
  )
}

function ContratacaoLinha({ c, onChange, onRemover, area }: { c: Contratacao; onChange: (c: Contratacao) => void; onRemover: () => void; area: string }) {
  return (
    <div className="grid grid-cols-[52px_minmax(0,1fr)_96px_auto_auto] items-center gap-1.5">
      <NumInput value={c.qtd} onChange={(v) => onChange({ ...c, qtd: Math.max(0, Math.round(v)) })} casas={0} min={0} ariaLabel={`Quantidade ${area}`} />
      <input
        value={c.descricao}
        onChange={(ev) => onChange({ ...c, descricao: ev.target.value })}
        placeholder="cargo (ex.: advogado pleno)"
        className="h-7 min-w-0 rounded-md border border-amber-300 bg-amber-50 px-1.5 text-xs"
        aria-label={`Cargo ${area}`}
      />
      <NumInput value={c.custoMensal} onChange={(v) => onChange({ ...c, custoMensal: v })} casas={0} min={0} ariaLabel={`Custo mensal por pessoa ${area}`} />
      <SeletorMes value={c.mesInicio} onChange={(m) => onChange({ ...c, mesInicio: m })} ariaLabel={`Mês de início ${area}`} prefixo="a partir de " />
      <button type="button" onClick={onRemover} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remover contratação ${area}`}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

/**
 * Pessoas por área no simulador: custo 2026 → 2027 aberto em reajuste, ajustes na equipe atual e
 * contratações (uma linha por cargo), com o headcount de hoje e o de dez/27.
 */
export function SimuladorPessoas({
  resultado,
  escritorio,
  areas,
  pessoas2026,
  ultimoMesFechado,
  onEscritorio,
  onArea,
}: {
  resultado: ResultadoSimulacao
  escritorio: PremissasEscritorio
  areas: Record<AreaKey, PremissaArea>
  pessoas2026: readonly PlanPessoasRow[] | undefined
  ultimoMesFechado: number
  onEscritorio: (mudanca: Partial<PremissasEscritorio>) => void
  onArea: (area: AreaKey, mudanca: Partial<PremissaArea>) => void
}) {
  const mesReaj = (MESES_ABREV[escritorio.mesReajuste - 1] ?? '').toLowerCase()
  const rotuloHoje = (MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()
  const linhas = AREAS_2027.map((a) => {
    const ra = resultado.areas[a.key]
    const hoje = headcountAtual(pessoas2026, a.key, ultimoMesFechado)
    const novos = ra.novasPessoas[11] ?? 0
    return { a, ra, hoje, novos, custo27: soma(ra.pessoas) }
  })
  const tot26 = soma(linhas.map((l) => l.ra.pontePessoas.base))
  const tot27 = soma(linhas.map((l) => l.custo27))
  const hojeTot = linhas.every((l) => l.hoje == null) ? null : soma(linhas.map((l) => l.hoje ?? 0))
  const novosTot = soma(linhas.map((l) => l.novos))

  return (
    <Secao
      titulo="Pessoas por área"
      subtitulo={
        <>
          Custo de pessoas 2027 = custo 2026 + reajuste salarial + ajustes na equipe atual + contratações novas. O custo de pessoas é o que a área lança em
          pessoal no VIOS (folha, encargos e benefícios).
        </>
      }
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs font-semibold text-slate-800">Reajuste salarial (vale para a equipe atual de todas as áreas)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <NumInput value={escritorio.reajustePct} onChange={(v) => onEscritorio({ reajustePct: v })} sufixo="%" className="w-24" ariaLabel="Reajuste salarial" />
            <SeletorMes value={escritorio.mesReajuste} onChange={(m) => onEscritorio({ mesReajuste: m })} ariaLabel="Mês do reajuste" prefixo="a partir de " />
            <span className="text-[11px] text-slate-500">Contratações novas não recebem o reajuste: informe o custo já no valor de 2027.</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Custo 2026</p>
            <p className="text-sm font-bold tabular-nums text-slate-900">{moedaCurta(tot26)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Custo 2027</p>
            <p className="text-sm font-bold tabular-nums text-slate-900">{moedaCurta(tot27)}</p>
            <p className="text-[10px]">
              <VarPct v={variacaoPct(tot27, tot26)} />
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Pessoas</p>
            <p className="text-sm font-bold tabular-nums text-slate-900">
              {hojeTot ?? '—'} → {hojeTot == null ? `+${novosTot}` : hojeTot + novosTot}
            </p>
            <p className="text-[10px] text-slate-500">
              {rotuloHoje}/26 → dez/27
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {linhas.map(({ a, ra, hoje, novos, custo27 }) => {
          const p = areas[a.key]
          const ponte = ra.pontePessoas
          const pctReceita26 = ra.receitaBaseAno > 0 ? (ponte.base / ra.receitaBaseAno) * 100 : null
          const pctReceita27 = ra.receitaAno > 0 ? (custo27 / ra.receitaAno) * 100 : null
          const setContratacoes = (lista: Contratacao[]) => onArea(a.key, { contratacoes: lista })
          return (
            <div key={a.key} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.cor }} aria-hidden />
                  {a.nome}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-slate-500" title={`Headcount de ${rotuloHoje}/26 e em dez/27 com as contratações`}>
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {hoje == null ? '—' : hoje} hoje
                  {novos > 0 && (
                    <>
                      {' '}
                      → <span className="font-semibold text-slate-800">{hoje == null ? `+${novos}` : hoje + novos}</span> em dez/27
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-md bg-slate-50 px-2.5 py-1.5">
                <Linha rotulo="Custo de pessoas 2026" valor={ponte.base}>
                  <span className="text-[10px] text-slate-400">({pct(pctReceita26)} da receita)</span>
                </Linha>
                <Linha rotulo={`Reajuste ${pct(escritorio.reajustePct)} a partir de ${mesReaj}`} valor={ponte.reajuste} sinal="+" />
                <Linha rotulo="Ajustes na equipe atual" valor={ponte.ajustes} sinal="+">
                  <NumInput
                    value={p.variacaoPessoasPct}
                    onChange={(v) => onArea(a.key, { variacaoPessoasPct: v })}
                    sufixo="%"
                    className="w-20"
                    ariaLabel={`Ajustes na equipe atual ${a.nome}`}
                  />
                </Linha>
                <Linha rotulo={`Contratações (${novos} ${novos === 1 ? 'pessoa' : 'pessoas'})`} valor={ponte.contratacoes} sinal="+" />
                <Linha rotulo="Custo de pessoas 2027" valor={custo27} sinal="=" forte>
                  <span className="text-[10px] font-normal">
                    <VarPct v={variacaoPct(custo27, ponte.base)} /> · {pct(pctReceita27)} da receita
                  </span>
                </Linha>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Ajustes na equipe atual: promoções, mérito ou saídas, além do reajuste (negativo reduz o custo).</p>

              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">Contratações 2027</p>
                  {p.contratacoes.length > 0 && <p className="text-[10px] text-slate-400">qtd · cargo · custo/mês por pessoa · início</p>}
                </div>
                {p.contratacoes.length === 0 && <p className="text-[11px] text-slate-400">Nenhuma contratação prevista.</p>}
                {p.contratacoes.map((c, idx) => (
                  <ContratacaoLinha
                    key={idx}
                    c={c}
                    area={a.nome}
                    onChange={(nova) => setContratacoes(p.contratacoes.map((x, j) => (j === idx ? nova : x)))}
                    onRemover={() => setContratacoes(p.contratacoes.filter((_, j) => j !== idx))}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setContratacoes([...p.contratacoes, novaContratacao(1)])}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar contratação
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Secao>
  )
}
