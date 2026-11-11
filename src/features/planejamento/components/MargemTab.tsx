import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import { AREAS_PLANEJAMENTO, MESES_ABREV, areaNome, soma, type AreaKey } from '../utils/areasPlanejamento'
import { margemArea, somarAreas, totaisArea, type BaseAno, type BaseArea, type TotaisArea } from '../utils/planejamentoBase'
import { fenixMargem } from '../fenix/planejamentoFenix'
import { AreaChips, Aviso, Secao, TabelaMeses, VarPct, moeda, pct } from './PlanUi'

type Props = { base2025: BaseAno; base2026: BaseAno; ultimoMesFechado: number }

function areaDe(base: BaseAno, sel: string): BaseArea {
  return sel === 'escritorio' ? somarAreas(base) : base.areas[sel as AreaKey]
}

function CelulaMargem({ t, rotulo, area, ano, impostoEstimado, avisos }: {
  t: TotaisArea
  rotulo: string
  area: string
  ano: number
  impostoEstimado: boolean
  avisos: string[]
}) {
  const id = useFenixAlvo(`planejamento.margem.${ano}.${area}`, () =>
    fenixMargem({ titulo: `Margem de contribuição ${rotulo} — ${area}`, areaNome: area, ano, periodo: rotulo, t, impostoEstimado, avisos }),
  )
  return (
    <span data-fenix={id} className={cn('tabular-nums', t.margem < 0 && 'text-red-700')}>
      {moeda(t.margem)}
    </span>
  )
}

export function MargemTab({ base2025, base2026, ultimoMesFechado }: Props) {
  const [sel, setSel] = useState('escritorio')
  const [anoMes, setAnoMes] = useState<2025 | 2026>(2026)
  const nomeSel = sel === 'escritorio' ? 'Escritório (áreas)' : areaNome(sel)
  const rotuloFechado = (MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()

  const reclass2025 = soma(somarAreas(base2025).reclassificado)
  const semMatch2025 = soma(base2025.pessoasSemMatch)
  const herdados2025 = [...new Set(base2025.origemControladoria.filter((o) => o.startsWith('herdado')))]
  const herdados2026 = base2026.origemControladoria
    .map((o, i) => (o.startsWith('herdado') && i + 1 <= ultimoMesFechado ? `${MESES_ABREV[i]} (${o.replace('herdado ', 'usa ')})` : null))
    .filter(Boolean)

  const avisos2025 = [
    'Imposto de 2025 estimado: o VIOS não tem número de NF em 2025 (99% dos títulos com "N/A"), então aplica-se a taxa efetiva de 2026 da área (imposto ÷ receita).',
    `Folha e custos de pessoas de 2025 lançados em Facilities foram para a área de cada pessoa (${moeda(reclass2025)}), pelo departamento da folha de 2026 ou pelo cadastro de RH.`,
    ...(herdados2025.length ? [`Rateio da Controladoria em 2025: não existe Fechamento Legal Ops; ${herdados2025.join(', ')}.`] : []),
  ]
  const avisos2026 = [
    `Nov–dez/26 projetados: receita pela Melhor Estimativa, imposto pela taxa efetiva do ano e despesas repetindo ${rotuloFechado}/26.`,
    ...(herdados2026.length ? [`Rateio da Controladoria herdado em: ${herdados2026.join(', ')}.`] : []),
  ]

  const linhas = useMemo(
    () =>
      [...AREAS_PLANEJAMENTO.map((a) => ({ key: a.key as string, nome: a.nome })), { key: 'escritorio', nome: 'Total das áreas' }].map((a) => ({
        ...a,
        t25: totaisArea(areaDe(base2025, a.key)),
        t26: totaisArea(areaDe(base2026, a.key)),
      })),
    [base2025, base2026],
  )

  const baseMes = anoMes === 2025 ? base2025 : base2026
  const a = areaDe(baseMes, sel)
  const margem = margemArea(a)
  const liquida = a.receita.map((r, i) => r - a.impostos[i])

  return (
    <div className="space-y-4">
      <Aviso tom="azul">
        Margem de contribuição = receita − imposto − despesas da própria área (pessoas e demais) − rateio da Controladoria (Ops Legais).
        É o resultado do DL antes do rateio da estrutura (Facilities, Financeiro, RH, TI, Marketing, Comercial). Margem % = margem ÷
        receita líquida, como no DL.
      </Aviso>

      <Secao titulo="Margem de contribuição por área — 2025 × 2026" subtitulo={`2026 = realizado até ${rotuloFechado} + projeção de nov–dez.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th rowSpan={2} className="px-2 py-1.5 text-left font-medium">
                  Área
                </th>
                <th colSpan={4} className="border-l border-slate-100 px-2 py-1 text-center font-medium">
                  2025
                </th>
                <th colSpan={4} className="border-l border-slate-100 px-2 py-1 text-center font-medium">
                  2026 (com projeção)
                </th>
                <th rowSpan={2} className="border-l border-slate-100 px-2 py-1.5 text-right font-medium">
                  Var. margem
                </th>
              </tr>
              <tr>
                {['Receita', 'Despesas da área', 'Margem', 'Margem %', 'Receita', 'Despesas da área', 'Margem', 'Margem %'].map((h, i) => (
                  <th key={i} className={cn('px-2 py-1 text-right font-medium', i % 4 === 0 && 'border-l border-slate-100')}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.key} className={cn('border-b border-slate-100', l.key === 'escritorio' && 'bg-slate-50 font-semibold')}>
                  <td className="px-2 py-1.5 text-slate-800">{l.nome}</td>
                  <td className="border-l border-slate-100 px-2 py-1.5 text-right tabular-nums">{moeda(l.t25.receita)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(l.t25.impostos + l.t25.opex + l.t25.controladoria)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <CelulaMargem t={l.t25} rotulo="2025" area={l.nome} ano={2025} impostoEstimado avisos={avisos2025} />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{pct(l.t25.margemPct)}</td>
                  <td className="border-l border-slate-100 px-2 py-1.5 text-right tabular-nums">{moeda(l.t26.receita)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moeda(l.t26.impostos + l.t26.opex + l.t26.controladoria)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <CelulaMargem t={l.t26} rotulo="2026 (com projeção)" area={l.nome} ano={2026} impostoEstimado={false} avisos={avisos2026} />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{pct(l.t26.margemPct)}</td>
                  <td className="border-l border-slate-100 px-2 py-1.5 text-right">
                    {l.t25.receita <= 0 ? (
                      <span className="text-slate-400">nova em 2026</span>
                    ) : (
                      <VarPct v={l.t25.margem ? ((l.t26.margem - l.t25.margem) / Math.abs(l.t25.margem)) * 100 : null} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">“Despesas da área” = imposto + pessoas + demais + Controladoria. Clique no valor da margem com o Fênix para ver a conta.</p>
      </Secao>

      <div className="space-y-2">
        <Aviso>
          <strong>2025:</strong> {avisos2025.join(' ')}
          {semMatch2025 > 0 && (
            <>
              {' '}
              Custos de pessoas sem nome de colaborador (encargos, guias) continuam na estrutura: {moeda(semMatch2025)}.
            </>
          )}
        </Aviso>
        <Aviso>
          <strong>2026:</strong> {avisos2026.join(' ')}
        </Aviso>
      </div>

      <Secao
        titulo={`Demonstrativo mês a mês — ${nomeSel}`}
        acoes={
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {([2025, 2026] as const).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setAnoMes(y)}
                className={cn('rounded-md px-3 py-1 text-xs font-medium', anoMes === y ? 'bg-indigo-600 text-white' : 'text-slate-600')}
              >
                {y}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-3">
          <AreaChips value={sel} onChange={setSel} />
        </div>
        <TabelaMeses
          ano={anoMes}
          linhas={[
            { rotulo: 'Receita bruta', valores: a.receita, projetado: baseMes.projetado },
            { rotulo: anoMes === 2025 ? '(−) Imposto (estimado)' : '(−) Imposto', valores: a.impostos, projetado: baseMes.projetado },
            { rotulo: '(=) Receita líquida', valores: liquida, destaque: true, projetado: baseMes.projetado },
            { rotulo: '(−) Pessoas da área', valores: a.pessoas, projetado: baseMes.projetado },
            ...(anoMes === 2025 ? [{ rotulo: 'reclassificado de Facilities', valores: a.reclassificado, sub: true }] : []),
            { rotulo: '(−) Demais despesas da área', valores: a.demais, projetado: baseMes.projetado },
            { rotulo: '(−) Controladoria (rateio)', valores: a.controladoria, projetado: baseMes.projetado },
            { rotulo: '(=) Margem de contribuição', valores: margem, destaque: true, projetado: baseMes.projetado },
            {
              rotulo: 'Margem %',
              valores: margem.map((m, i) => (liquida[i] > 0 ? (m / liquida[i]) * 100 : null)),
              formato: 'pct',
              total: totaisArea(a).margemPct,
            },
          ]}
        />
      </Secao>
    </div>
  )
}
