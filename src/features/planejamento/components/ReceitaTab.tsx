import { useMemo, useRef, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'
import { useFenixGrafico } from '@/shared/fenix/useFenix'
import { cn } from '@/lib/utils'
import { usePlanPrevisto } from '../hooks/usePlanejamento'
import { AREAS_PLANEJAMENTO, MESES_ABREV, areaNome, soma, variacaoPct, type AreaKey } from '../utils/areasPlanejamento'
import type { BaseAno } from '../utils/planejamentoBase'
import type { ResultadoSimulacao } from '../utils/planejamentoCalc'
import { fenixCrescimento, fenixReceitaAno, fenixValor } from '../fenix/planejamentoFenix'
import { ClassificarReceitaDialog } from './ClassificarReceitaDialog'
import { AreaChips, Aviso, PlanKpi, Secao, TabelaMeses, VarPct, moeda, moedaCurta, pct } from './PlanUi'

type Props = {
  base2025: BaseAno
  base2026: BaseAno
  ultimoMesFechado: number
  /** Meta do escritório 2026 por mês (meta base da Receita). */
  metaBasePorMes: Record<number, number>
  /** % da meta por chave da Receita. */
  contribuicaoMeta: Record<string, number>
  oficial2027: ResultadoSimulacao | null
  nomeOficial: string | null
}

function receitaDe(base: BaseAno, sel: string): number[] {
  if (sel === 'escritorio') {
    const out = base.semArea.slice()
    for (const a of AREAS_PLANEJAMENTO) base.areas[a.key].receita.forEach((v, i) => (out[i] += v))
    return out
  }
  return base.areas[sel as AreaKey]?.receita.slice() ?? Array(12).fill(0)
}

/** Ajuste provisório da receita (controle financeiro − VIOS) do filtro escolhido; nulo sem ajuste. */
function ajusteDe(base: BaseAno, sel: string): number[] | null {
  const aj = base.ajusteReceita
  if (!aj) return null
  if (sel === 'escritorio') return aj.total.slice()
  return aj.areas[sel as AreaKey]?.slice() ?? null
}

function metaDe(sel: string, metaBasePorMes: Record<number, number>, contribuicao: Record<string, number>): (number | null)[] {
  const area = AREAS_PLANEJAMENTO.find((a) => a.key === sel)
  const fator = sel === 'escritorio' ? 1 : area && area.receitaKey !== 'outras' ? (contribuicao[area.receitaKey] ?? 0) / 100 : 0
  return Array.from({ length: 12 }, (_, i) => {
    const m = metaBasePorMes[i + 1]
    return m && fator > 0 ? m * fator : null
  })
}

/** "jun–dez" para meses seguidos; senão a lista ("jan, mar, jun"). */
function rotuloPeriodo(meses: readonly number[]): string {
  if (meses.length === 0) return ''
  const seguidos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1)
  const nome = (m: number) => MESES_ABREV[m - 1].toLowerCase()
  if (meses.length === 1) return nome(meses[0])
  return seguidos ? `${nome(meses[0])}–${nome(meses[meses.length - 1])}` : meses.map(nome).join(', ')
}

function acumulado(valores: readonly (number | null)[]): (number | null)[] {
  let s = 0
  return valores.map((v) => {
    if (v == null) return null
    s += v
    return s
  })
}

export function ReceitaTab({ base2025, base2026, ultimoMesFechado, metaBasePorMes, contribuicaoMeta, oficial2027, nomeOficial }: Props) {
  const [sel, setSel] = useState('escritorio')
  const [classificar, setClassificar] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const previsto2027 = usePlanPrevisto(2027)
  const nomeSel = sel === 'escritorio' ? 'Escritório' : areaNome(sel)
  const fechados = Array.from({ length: ultimoMesFechado }, (_, i) => i + 1)
  // A meta de 2026 só existe em parte do ano (jun–dez): atingimento e gap comparam esses meses.
  const mesesMetaAno = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => (metaBasePorMes[m] ?? 0) > 0)
  const periodoMeta = rotuloPeriodo(mesesMetaAno)
  const periodoSemMeta = rotuloPeriodo(Array.from({ length: Math.max(0, (mesesMetaAno[0] ?? 1) - 1) }, (_, i) => i + 1))

  const r25 = useMemo(() => receitaDe(base2025, sel), [base2025, sel])
  const r26 = useMemo(() => receitaDe(base2026, sel), [base2026, sel])
  const meta26 = useMemo(() => metaDe(sel, metaBasePorMes, contribuicaoMeta), [sel, metaBasePorMes, contribuicaoMeta])
  const meta27 = useMemo(() => {
    if (!oficial2027) return null
    if (sel === 'escritorio') return oficial2027.escritorio.receita
    return oficial2027.areas[sel as AreaKey]?.receita ?? null
  }, [oficial2027, sel])

  const ytd25 = soma(fechados.map((m) => r25[m - 1]))
  const ytd26 = soma(fechados.map((m) => r26[m - 1]))
  const ano25 = soma(r25)
  const ano26 = soma(r26)
  const mesesMeta = meta26.map((v, i) => (v != null ? i + 1 : 0)).filter(Boolean)
  const metaTotal = soma(meta26.map((v) => v ?? 0))
  const realMeta = soma(mesesMeta.map((m) => r26[m - 1]))
  const semArea2025 = soma(base2025.semArea)
  // O aviso de "sem área" fala do VIOS (o que dá para classificar por cliente), sem o ajuste do controle.
  const semArea2025Vios = semArea2025 - soma(base2025.ajusteReceita?.semArea ?? [])
  const aj25 = useMemo(() => ajusteDe(base2025, sel), [base2025, sel])
  const ajusteTotal2025 = soma(base2025.ajusteReceita?.total ?? [])
  const receitaEscritorio2025 = soma(receitaDe(base2025, 'escritorio'))

  const dadosGrafico = useMemo(() => {
    const a25 = acumulado(r25)
    const a26 = acumulado(r26)
    const a27 = meta27 ? acumulado(meta27) : null
    return MESES_ABREV.map((m, i) => ({
      mes: m,
      a2025: a25[i],
      real2026: i + 1 <= ultimoMesFechado ? a26[i] : null,
      me2026: i + 1 >= ultimoMesFechado ? a26[i] : null,
      meta2027: a27 ? a27[i] : null,
    }))
  }, [r25, r26, meta27, ultimoMesFechado])

  const grafico = useFenixGrafico('planejamento.receita.acumulado', (ponto) => {
    const i = ponto?.indice ?? 11
    const d = dadosGrafico[i]
    return fenixValor({
      tela: 'Receita › Acumulado mês a mês',
      titulo: `Receita acumulada até ${MESES_ABREV[i]} — ${nomeSel}`,
      valor: moeda(d.real2026 ?? d.me2026 ?? 0),
      resumo: 'Soma da receita de janeiro até o mês. 2026 usa a Melhor Estimativa depois do último mês fechado (linha tracejada).',
      conta: [
        { rotulo: `2025 até ${MESES_ABREV[i]}`, valor: moeda(d.a2025 ?? 0) },
        { rotulo: `2026 até ${MESES_ABREV[i]}`, valor: moeda(d.real2026 ?? d.me2026 ?? 0) },
        ...(d.meta2027 != null ? [{ rotulo: `Meta 2027 até ${MESES_ABREV[i]}`, valor: moeda(d.meta2027) }] : []),
      ],
      fonteTecnica: 'planejamento_receita_mensal + Melhor Estimativa (receitaMeCalc)',
    })
  })

  const linhasArea = useMemo(
    () =>
      AREAS_PLANEJAMENTO.map((a) => {
        const rr25 = base2025.areas[a.key].receita
        const rr26 = base2026.areas[a.key].receita
        const m26 = metaDe(a.key, metaBasePorMes, contribuicaoMeta)
        const ytdReal = soma(fechados.map((m) => rr26[m - 1]))
        const me = soma(rr26.filter((_, i) => i + 1 > ultimoMesFechado))
        const metaA = soma(m26.map((v) => v ?? 0))
        // Realizado + ME só nos meses com meta (jun–dez), para todas as áreas — as sem meta própria
        // (Tributário, ADD) também contam na meta do escritório.
        const realNaMeta = soma(mesesMetaAno.map((m) => rr26[m - 1]))
        return {
          a,
          ano25: soma(rr25),
          ytd25: soma(fechados.map((m) => rr25[m - 1])),
          ytdReal,
          me,
          fechamento: soma(rr26),
          realNaMeta,
          meta: metaA,
          atingimento: metaA > 0 ? (realNaMeta / metaA) * 100 : null,
          gap: metaA > 0 ? realNaMeta - metaA : null,
        }
      }),
    [base2025, base2026, metaBasePorMes, contribuicaoMeta, fechados, mesesMetaAno, ultimoMesFechado],
  )

  const carteira2027 = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of previsto2027.data ?? []) {
      const a = AREAS_PLANEJAMENTO.find((x) => x.departamento === r.departamento)
      const k = a?.key ?? 'outros'
      out[k] = (out[k] ?? 0) + r.total
    }
    return out
  }, [previsto2027.data])

  const rotuloFechado = MESES_ABREV[ultimoMesFechado - 1] ?? ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AreaChips value={sel} onChange={setSel} />
        <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setClassificar(true)}>
          <Tags className="h-4 w-4" aria-hidden />
          Classificar receita sem área
        </Button>
      </div>

      {base2025.ajusteReceita && (
        <Aviso>
          <strong>Receita 2025 provisória.</strong> O VIOS ainda não tem toda a receita de 2025: o painel usa o total mensal do controle
          financeiro ({moeda(receitaEscritorio2025)}), e o VIOS tem {moeda(receitaEscritorio2025 - ajusteTotal2025)}. A diferença de{' '}
          {moeda(ajusteTotal2025)} foi para a área de cada recebimento: ligado a um título do VIOS, a área do título; sem título, o rateio
          ou o centro de custo do controle; o que não tem área, pela proporção do VIOS no mês.
          {sel !== 'escritorio' && aj25 && ` Nesta área: ${moeda(soma(aj25))}.`} O ajuste sai quando o VIOS for corrigido.
        </Aviso>
      )}

      {semArea2025Vios > 0 && (
        <Aviso>
          Em 2025, {moeda(semArea2025Vios)} de honorários estão em departamentos que não são área no VIOS (Facilities, Financeiro, BP…).
          Esse valor entra no total do escritório, mas fica fora das áreas até ser classificado em “Classificar receita sem área”.
        </Aviso>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PlanKpi
          rotulo="Receita 2025"
          valor={moedaCurta(ano25)}
          sub={moeda(ano25)}
          fenixChave="planejamento.receita.2025"
          explicar={() => fenixReceitaAno({ titulo: `Receita 2025 — ${nomeSel}`, ano: 2025, areaNome: nomeSel, porMes: r25, ajuste: aj25 })}
        />
        <PlanKpi
          rotulo={`Realizado 2026 (jan–${rotuloFechado.toLowerCase()})`}
          valor={moedaCurta(ytd26)}
          sub={
            <>
              vs. mesmo período de 2025: <VarPct v={variacaoPct(ytd26, ytd25)} />
            </>
          }
          fenixChave="planejamento.receita.ytd"
          explicar={() =>
            fenixCrescimento({
              titulo: `Crescimento YTD — ${nomeSel}`,
              areaNome: nomeSel,
              anterior: ytd25,
              atual: ytd26,
              rotuloAnterior: `2025 jan–${rotuloFechado.toLowerCase()}`,
              rotuloAtual: `2026 jan–${rotuloFechado.toLowerCase()}`,
            })
          }
        />
        <PlanKpi
          rotulo="2026 com Melhor Estimativa"
          valor={moedaCurta(ano26)}
          tom="destaque"
          sub={
            <>
              vs. 2025: <VarPct v={variacaoPct(ano26, ano25)} />
            </>
          }
          fenixChave="planejamento.receita.2026"
          explicar={() =>
            fenixReceitaAno({
              titulo: `Receita 2026 (realizado + ME) — ${nomeSel}`,
              ano: 2026,
              areaNome: nomeSel,
              porMes: r26,
              projetado: base2026.projetado,
            })
          }
        />
        <PlanKpi
          rotulo="Meta 2026 (meses com meta)"
          valor={metaTotal > 0 ? moedaCurta(metaTotal) : '—'}
          sub={
            metaTotal > 0
              ? `${rotuloPeriodo(mesesMeta)} (${mesesMeta.length} meses) · realizado + ME no período: ${moedaCurta(realMeta)}`
              : 'Área sem meta na Receita'
          }
        />
        <PlanKpi
          rotulo="Atingimento projetado da meta"
          valor={metaTotal > 0 ? pct((realMeta / metaTotal) * 100) : '—'}
          tom={metaTotal > 0 ? (realMeta >= metaTotal ? 'bom' : 'ruim') : 'neutro'}
          sub={metaTotal > 0 ? `Gap: ${moeda(realMeta - metaTotal)}` : undefined}
          fenixChave="planejamento.receita.atingimento"
          explicar={() =>
            fenixValor({
              tela: 'Receita',
              titulo: `Atingimento projetado da meta 2026 — ${nomeSel}`,
              valor: metaTotal > 0 ? pct((realMeta / metaTotal) * 100) : '—',
              resumo: `A meta de 2026 vale só de ${periodoMeta}. Realizado nos meses fechados + Melhor Estimativa nos meses abertos, só nesses meses, dividido pela meta desses meses.`,
              formula: `Atingimento = (realizado + ME de ${periodoMeta}) ÷ meta de ${periodoMeta} × 100`,
              conta: [
                { rotulo: `Realizado + ME (${periodoMeta})`, valor: moeda(realMeta), numero: realMeta },
                { rotulo: `Meta (${periodoMeta})`, valor: moeda(metaTotal), numero: metaTotal, operador: '÷' },
              ],
              regras: [
                'Meta = meta mensal da Receita (Configurações › Metas); por área, × a contribuição da área na meta.',
                'A receita de jan–mai não entra no atingimento: nesses meses não havia meta.',
                'ADD e Tributário não têm meta própria na Receita.',
              ],
              fonteTecnica: 'app_settings.receita_metas × RECEITA_META_CONTRIBUICAO_AREA',
            })
          }
        />
      </div>

      <Secao
        titulo={`Receita bruta acumulada mês a mês — ${nomeSel}`}
        subtitulo={`2026 até ${rotuloFechado.toLowerCase()} é realizado; depois, Melhor Estimativa (tracejado).${meta27 ? ` Meta 2027: cenário oficial “${nomeOficial ?? ''}”.` : ''}`}
        acoes={<ChartCopyButton containerRef={chartRef} />}
      >
        <div ref={chartRef} data-fenix={grafico.fenixId} className="h-80 bg-white">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico} onMouseMove={grafico.onMouseMove} onMouseLeave={grafico.onMouseLeave}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => moedaCurta(v)} tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v) => moeda(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="a2025" name="2025" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="real2026" name="2026 realizado" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
              <Line
                type="monotone"
                dataKey="me2026"
                name="2026 Melhor Estimativa"
                stroke="#4f46e5"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
              {meta27 && (
                <Line type="monotone" dataKey="meta2027" name="Meta 2027 (oficial)" stroke="#059669" strokeWidth={2} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Secao>

      <Secao titulo={`Mês a mês — ${nomeSel}`} subtitulo="Em itálico: Melhor Estimativa (meses ainda não fechados).">
        <TabelaMeses
          linhas={[
            { rotulo: 'Receita 2025', valores: r25 },
            ...(aj25 ? [{ rotulo: 'dos quais: ajuste do controle', valores: aj25, sub: true }] : []),
            { rotulo: 'Receita 2026', valores: r26, projetado: base2026.projetado, destaque: true },
            { rotulo: 'Meta 2026', valores: meta26 },
            {
              rotulo: 'Crescimento 26/25',
              valores: r26.map((v, i) => variacaoPct(v, r25[i])),
              formato: 'pct',
              total: variacaoPct(ano26, ano25),
            },
            ...(meta27 ? [{ rotulo: 'Meta 2027 (oficial)', valores: meta27 }] : []),
          ]}
        />
      </Secao>

      <Secao
        titulo="Meta × Melhor Estimativa × Realizado por área — 2026"
        subtitulo={`Realizado até ${rotuloFechado.toLowerCase()}; ME nos meses abertos. A meta de 2026 vale só de ${periodoMeta}: atingimento e gap comparam o realizado + ME desses meses com a meta desses meses${periodoSemMeta ? ` (${periodoSemMeta} fica fora)` : ''}.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Área</th>
                <th className="px-2 py-1.5 text-right font-medium">Realizado jan–{rotuloFechado.toLowerCase()}</th>
                <th className="px-2 py-1.5 text-right font-medium">Melhor Estimativa</th>
                <th className="px-2 py-1.5 text-right font-medium">Fechamento 2026</th>
                <th className="border-l border-slate-200 px-2 py-1.5 text-right font-medium">Realizado + ME {periodoMeta}</th>
                <th className="px-2 py-1.5 text-right font-medium">Meta {periodoMeta}</th>
                <th className="px-2 py-1.5 text-right font-medium">Atingimento</th>
                <th className="px-2 py-1.5 text-right font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              {linhasArea.map((l) => (
                <tr key={l.a.key} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-800">{l.a.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(l.ytdReal)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums italic text-indigo-700">{moeda(l.me)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(l.fechamento)}</td>
                  <td className="border-l border-slate-200 px-2 py-1.5 text-right font-semibold tabular-nums">{moeda(l.realNaMeta)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.meta > 0 ? moeda(l.meta) : '—'}</td>
                  <td
                    className={cn(
                      'px-2 py-1.5 text-right tabular-nums',
                      l.atingimento != null && (l.atingimento >= 100 ? 'text-emerald-700' : 'text-red-700'),
                    )}
                  >
                    {pct(l.atingimento)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.gap != null ? moeda(l.gap) : '—'}</td>
                </tr>
              ))}
              {(() => {
                const realTot = soma(linhasArea.map((l) => l.realNaMeta))
                const metaTot = soma(linhasArea.map((l) => l.meta))
                const ating = metaTot > 0 ? (realTot / metaTot) * 100 : null
                return (
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-2 py-1.5">Total das áreas</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(linhasArea.map((l) => l.ytdReal)))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(linhasArea.map((l) => l.me)))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(linhasArea.map((l) => l.fechamento)))}</td>
                    <td className="border-l border-slate-200 px-2 py-1.5 text-right tabular-nums">{moeda(realTot)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{metaTot > 0 ? moeda(metaTot) : '—'}</td>
                    <td
                      className={cn('px-2 py-1.5 text-right tabular-nums', ating != null && (ating >= 100 ? 'text-emerald-700' : 'text-red-700'))}
                    >
                      {pct(ating)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{metaTot > 0 ? moeda(realTot - metaTot) : '—'}</td>
                  </tr>
                )
              })()}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Tributário e Distressed Deals não têm meta própria (a meta do escritório é dividida entre as outras cinco áreas), mas a
          receita delas de {periodoMeta} conta no total do escritório — por isso o total bate com o atingimento do painel da Receita.
        </p>
      </Secao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Crescimento por área" subtitulo={`Ano: 2026 com ME × 2025. YTD: jan–${rotuloFechado.toLowerCase()} de cada ano.`}>
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Área</th>
                <th className="px-2 py-1.5 text-right font-medium">2025</th>
                <th className="px-2 py-1.5 text-right font-medium">2026 (com ME)</th>
                <th className="px-2 py-1.5 text-right font-medium">Ano</th>
                <th className="px-2 py-1.5 text-right font-medium">YTD</th>
              </tr>
            </thead>
            <tbody>
              {linhasArea.map((l) => (
                <tr key={l.a.key} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 text-slate-800">{l.a.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moedaCurta(l.ano25)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moedaCurta(l.fechamento)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {l.ano25 > 0 ? <VarPct v={variacaoPct(l.fechamento, l.ano25)} /> : <span className="text-slate-400">nova em 2026</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">{l.ytd25 > 0 ? <VarPct v={variacaoPct(l.ytdReal, l.ytd25)} /> : '—'}</td>
                </tr>
              ))}
              {semArea2025 > 0 && (
                <tr className="border-b border-slate-100 text-slate-500">
                  <td className="px-2 py-1.5">Sem área (2025)</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moedaCurta(semArea2025)}</td>
                  <td className="px-2 py-1.5 text-right">—</td>
                  <td className="px-2 py-1.5" />
                  <td className="px-2 py-1.5" />
                </tr>
              )}
            </tbody>
          </table>
        </Secao>

        <Secao
          titulo="Carteira 2027 já lançada no VIOS"
          subtitulo="Títulos de honorários com vencimento em 2027 já cadastrados (recorrentes, parcelamentos e acordos). É valor a vencer: parte pode não ser paga."
        >
          {previsto2027.isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-50" />
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {[...AREAS_PLANEJAMENTO.map((a) => ({ k: a.key as string, nome: a.nome })), { k: 'outros', nome: 'Outros departamentos' }].map((a) => (
                  <tr key={a.k} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-800">{a.nome}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(carteira2027[a.k] ?? 0)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-2 py-1.5">Total</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(Object.values(carteira2027)))}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Secao>
      </div>

      <ClassificarReceitaDialog ano={2025} open={classificar} onOpenChange={setClassificar} />
    </div>
  )
}
