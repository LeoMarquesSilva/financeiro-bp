import { useState } from 'react'
import { BadgeCheck, Copy, Download, FilePlus2, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/shared/utils/format'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import { AREAS_2027, AREAS_PLANEJAMENTO, MESES_ABREV, areaNome, soma, variacaoPct, type AreaKey } from '../utils/areasPlanejamento'
import { controladoriaNaoRateada, taxaEfetivaEscritorio, totaisArea, somarAreas, type BaseAno } from '../utils/planejamentoBase'
import type { PremissaArea, Premissas, PremissasEscritorio, ResultadoSimulacao } from '../utils/planejamentoCalc'
import type { PlanCenarioRow } from '../types'
import { useIndicadoresOperacionais } from '../hooks/useIndicadores'
import { fenixResultadoEscritorio, fenixSimulacaoArea } from '../fenix/planejamentoFenix'
import { NumInput } from './NumInput'
import { AreaChips, Aviso, CarregandoBloco, PlanKpi, Secao, TabelaMeses, VarPct, moeda, moedaCurta, pct } from './PlanUi'
import { TabelaIndicadores } from './TabelaIndicadores'

type Props = {
  base2025: BaseAno
  base2026: BaseAno
  ultimoMesFechado: number
  premissas: Premissas
  onPremissas: (p: Premissas) => void
  resultado: ResultadoSimulacao
  cenarios: PlanCenarioRow[]
  cenarioId: string | null
  nome: string
  onNome: (n: string) => void
  alterado: boolean
  ocupado: boolean
  onSelecionar: (id: string | null) => void
  onNovo: () => void
  onSalvar: () => void
  onDuplicar: () => void
  onExcluir: () => void
  onOficializar: () => void
  onExportar: () => void
  exportando: boolean
}

function CelulaMeta({ area, p, e, r }: { area: AreaKey; p: PremissaArea; e: PremissasEscritorio; r: ResultadoSimulacao }) {
  const ra = r.areas[area]
  const id = useFenixAlvo(`planejamento.simulador.${area}`, () => fenixSimulacaoArea({ areaNome: areaNome(area), p, e, r: ra }))
  return (
    <span data-fenix={id} className="font-semibold tabular-nums text-slate-900">
      {moeda(ra.receitaAno)}
    </span>
  )
}

const MESES_OPC = MESES_ABREV.map((m, i) => ({ v: i + 1, l: m }))

export function SimuladorTab(props: Props) {
  const { base2025, base2026, ultimoMesFechado, premissas, onPremissas, resultado, cenarios, cenarioId } = props
  const e = premissas.escritorio
  const [selRes, setSelRes] = useState('escritorio')
  const [selOp, setSelOp] = useState('escritorio')
  const indicadores = useIndicadoresOperacionais(selOp, ultimoMesFechado)
  const atual = cenarios.find((c) => c.id === cenarioId) ?? null

  const setE = <K extends keyof PremissasEscritorio>(k: K, v: PremissasEscritorio[K]) =>
    onPremissas({ ...premissas, escritorio: { ...e, [k]: v } })
  const setA = <K extends keyof PremissaArea>(area: AreaKey, k: K, v: PremissaArea[K]) =>
    onPremissas({ ...premissas, areas: { ...premissas.areas, [area]: { ...premissas.areas[area], [k]: v } } })
  const setMetaOp = (indicador: string, area: string | null, valor: number | null) => {
    const atualOp = premissas.operacionais[indicador] ?? { escritorio: null, areas: {} }
    const novo = area == null ? { ...atualOp, escritorio: valor } : { ...atualOp, areas: { ...atualOp.areas, [area]: valor } }
    onPremissas({ ...premissas, operacionais: { ...premissas.operacionais, [indicador]: novo } })
  }

  const t26 = totaisArea(somarAreas(base2026))
  const esc = resultado.escritorio
  const margem27Pct = esc.receitaAno - soma(esc.impostos) > 0 ? (esc.margemAno / (esc.receitaAno - soma(esc.impostos))) * 100 : null
  const resultado26 = t26.margem - soma(base2026.estrutura) - soma(controladoriaNaoRateada(base2026))
  const fenixResultado = useFenixAlvo('planejamento.simulador.resultado', () => fenixResultadoEscritorio({ r: esc, e }))

  const res = selRes === 'escritorio' ? null : resultado.areas[selRes as AreaKey]
  const linhasRes =
    res == null
      ? [
          { rotulo: 'Receita', valores: esc.receita, destaque: true },
          { rotulo: '(−) Imposto', valores: esc.impostos },
          { rotulo: '(−) Pessoas das áreas', valores: esc.pessoas },
          { rotulo: '(−) Demais despesas das áreas', valores: esc.demais },
          { rotulo: '(−) Controladoria rateada', valores: esc.controladoria },
          { rotulo: '(=) Margem de contribuição', valores: esc.margem, destaque: true },
          { rotulo: '(−) Estrutura', valores: esc.estrutura },
          { rotulo: '(−) Controladoria não rateada', valores: esc.controladoriaNaoRateada },
          { rotulo: '(=) Resultado do escritório', valores: esc.resultado, destaque: true },
          { rotulo: 'Faturamento necessário', valores: esc.faturamentoNecessario, sub: true },
        ]
      : [
          { rotulo: 'Receita', valores: res.receita, destaque: true },
          { rotulo: 'Peso do mês', valores: res.pesos.map((w) => w * 100), formato: 'pct' as const, total: 100, sub: true },
          { rotulo: '(−) Imposto', valores: res.impostos },
          { rotulo: '(−) Pessoas', valores: res.pessoas },
          { rotulo: 'contratações', valores: res.contratacoes, sub: true },
          { rotulo: '(−) Demais despesas', valores: res.demais },
          { rotulo: '(−) Controladoria', valores: res.controladoria },
          { rotulo: '(=) Margem de contribuição', valores: res.margem, destaque: true },
        ]

  return (
    <div className="space-y-4">
      <Secao
        titulo="Cenário"
        subtitulo={
          atual ? (
            <>
              Criado por {atual.created_by_email ?? '—'} · última edição por {atual.updated_by_email ?? '—'} em {formatDateTime(atual.updated_at)}
              {atual.oficial && atual.oficializado_em
                ? ` · oficializado por ${atual.oficializado_por_email ?? '—'} em ${formatDateTime(atual.oficializado_em)}`
                : ''}
            </>
          ) : (
            'Cenário novo, ainda não salvo.'
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cenarioId ?? ''}
            onChange={(ev) => props.onSelecionar(ev.target.value || null)}
            className="h-8 max-w-[260px] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium"
            aria-label="Cenário"
          >
            {cenarioId == null && <option value="">(novo cenário)</option>}
            {cenarios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.oficial ? '★ ' : ''}
                {c.nome}
              </option>
            ))}
          </select>
          <input
            value={props.nome}
            onChange={(ev) => props.onNome(ev.target.value)}
            placeholder="Nome do cenário"
            className="h-8 w-56 rounded-md border border-slate-200 px-2 text-xs"
            aria-label="Nome do cenário"
          />
          {atual?.oficial && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Oficial 2027
            </span>
          )}
          {props.alterado && <span className="text-[11px] font-medium text-amber-700">alterações não salvas</span>}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={props.onNovo} disabled={props.ocupado}>
              <FilePlus2 className="h-4 w-4" aria-hidden /> Novo
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={props.onSalvar} disabled={props.ocupado || !props.nome.trim()}>
              <Save className="h-4 w-4" aria-hidden /> Salvar
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={props.onDuplicar} disabled={props.ocupado || !props.nome.trim()}>
              <Copy className="h-4 w-4" aria-hidden /> Salvar como novo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="success"
              className="gap-1.5"
              onClick={props.onOficializar}
              disabled={props.ocupado || cenarioId == null || props.alterado}
              title={props.alterado ? 'Salve antes de oficializar' : undefined}
            >
              <BadgeCheck className="h-4 w-4" aria-hidden /> Oficializar
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={props.onExportar} disabled={props.exportando}>
              <Download className="h-4 w-4" aria-hidden /> {props.exportando ? 'Gerando…' : 'Exportar Excel'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-red-600"
              onClick={props.onExcluir}
              disabled={props.ocupado || cenarioId == null || Boolean(atual?.oficial)}
              title={atual?.oficial ? 'O cenário oficial não pode ser excluído' : undefined}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </Secao>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlanKpi
          rotulo="Meta de receita 2027"
          valor={moedaCurta(esc.receitaAno)}
          tom="destaque"
          sub={
            <>
              vs. 2026 (real + ME) {moedaCurta(esc.receitaBaseAno)}: <VarPct v={variacaoPct(esc.receitaAno, esc.receitaBaseAno)} />
            </>
          }
        />
        <PlanKpi
          rotulo="Margem de contribuição 2027"
          valor={moedaCurta(esc.margemAno)}
          sub={
            <>
              {pct(margem27Pct)} da líquida · 2026: {moedaCurta(t26.margem)} ({pct(t26.margemPct)})
            </>
          }
        />
        <div data-fenix={fenixResultado}>
          <PlanKpi
            rotulo="Resultado do escritório 2027"
            valor={moedaCurta(esc.resultadoAno)}
            tom={esc.resultadoAno >= 0 ? 'bom' : 'ruim'}
            sub={
              <>
                2026: {moedaCurta(resultado26)} · <VarPct v={variacaoPct(esc.resultadoAno, resultado26)} />
              </>
            }
          />
        </div>
        <PlanKpi
          rotulo="Faturamento necessário 2027"
          valor={moedaCurta(esc.faturamentoNecessarioAno)}
          sub={`para receber a meta com ${pct(e.inadimplenciaMetaPct)} de inadimplência`}
        />
      </div>

      <Secao titulo="Premissas do escritório" subtitulo="Campos em amarelo são editáveis; tudo recalcula na hora.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-slate-600">
            <span className="block font-medium">Alíquota de imposto 2027 (sobre a receita)</span>
            <NumInput value={e.aliquotaPct} onChange={(v) => setE('aliquotaPct', v)} sufixo="%" min={0} max={99} />
            <span className="block text-[10px] text-slate-400">
              Taxa efetiva 2026 jan–{(MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()} (regra do DL: alíquota × títulos com NF):{' '}
              {pct(taxaEfetivaEscritorio(base2026, Array.from({ length: ultimoMesFechado }, (_, i) => i + 1)) * 100, 2)}. Ajuste para o
              Lucro Presumido.
            </span>
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span className="block font-medium">Reajuste da folha</span>
            <div className="flex gap-2">
              <NumInput value={e.reajustePct} onChange={(v) => setE('reajustePct', v)} sufixo="%" className="w-24" />
              <select
                value={e.mesReajuste}
                onChange={(ev) => setE('mesReajuste', Number(ev.target.value))}
                className="h-7 rounded-md border border-amber-300 bg-amber-50 px-1.5 text-xs"
                aria-label="Mês do reajuste"
              >
                {MESES_OPC.map((m) => (
                  <option key={m.v} value={m.v}>
                    a partir de {m.l}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span className="block font-medium">Variação da Controladoria (Ops Legais)</span>
            <NumInput value={e.variacaoControladoriaPct} onChange={(v) => setE('variacaoControladoriaPct', v)} sufixo="%" />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span className="block font-medium">Variação da estrutura</span>
            <NumInput value={e.variacaoEstruturaPct} onChange={(v) => setE('variacaoEstruturaPct', v)} sufixo="%" />
            <span className="block text-[10px] text-slate-400">Facilities, Financeiro, Marketing, RH, TI e Comercial.</span>
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span className="block font-medium">Meta de inadimplência</span>
            <NumInput value={e.inadimplenciaMetaPct} onChange={(v) => setE('inadimplenciaMetaPct', v)} sufixo="%" min={0} max={99} />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            <span className="block font-medium">Distribuição mensal da receita</span>
            <select
              value={e.distribuicao}
              onChange={(ev) => setE('distribuicao', ev.target.value === 'linear' ? 'linear' : 'sazonal')}
              className="h-7 w-full rounded-md border border-amber-300 bg-amber-50 px-1.5 text-xs"
            >
              <option value="sazonal">Sazonalidade de 2026 de cada área</option>
              <option value="linear">Linear (1/12 por mês)</option>
            </select>
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Premissas e metas por área"
        subtitulo="Base = 2026 (realizado + Melhor Estimativa). Pessoas: variação da área × reajuste do escritório + contratações (quantidade × custo mensal, a partir do mês)."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Área</th>
                <th className="px-2 py-1.5 text-right font-medium">Receita 2026</th>
                <th className="px-2 py-1.5 text-right font-medium">25→26</th>
                <th className="px-2 py-1.5 text-right font-medium">Crescimento</th>
                <th className="px-2 py-1.5 text-right font-medium">Receita nova (R$/ano)</th>
                <th className="px-2 py-1.5 text-right font-medium">Var. pessoas</th>
                <th className="px-2 py-1.5 text-right font-medium">Var. demais</th>
                <th className="px-2 py-1.5 text-right font-medium">Contratações</th>
                <th className="px-2 py-1.5 text-right font-medium">Custo/mês</th>
                <th className="px-2 py-1.5 text-right font-medium">Início</th>
                <th className="px-2 py-1.5 text-right font-medium">Meta receita 2027</th>
                <th className="px-2 py-1.5 text-right font-medium">Margem 2027</th>
                <th className="px-2 py-1.5 text-right font-medium">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {AREAS_2027.map((a) => {
                const p = premissas.areas[a.key]
                const ra = resultado.areas[a.key]
                const r25 = soma(base2025.areas[a.key].receita)
                return (
                  <tr key={a.key} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-800">{a.nome}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moedaCurta(ra.receitaBaseAno)}</td>
                    <td className="px-2 py-1.5 text-right">{r25 > 0 ? <VarPct v={variacaoPct(ra.receitaBaseAno, r25)} /> : <span className="text-slate-400">nova</span>}</td>
                    <td className="w-24 px-1 py-1">
                      <NumInput value={p.crescimentoPct} onChange={(v) => setA(a.key, 'crescimentoPct', v)} sufixo="%" ariaLabel={`Crescimento ${a.nome}`} />
                    </td>
                    <td className="w-32 px-1 py-1">
                      <NumInput value={p.receitaNova} onChange={(v) => setA(a.key, 'receitaNova', v)} casas={0} ariaLabel={`Receita nova ${a.nome}`} />
                    </td>
                    <td className="w-24 px-1 py-1">
                      <NumInput value={p.variacaoPessoasPct} onChange={(v) => setA(a.key, 'variacaoPessoasPct', v)} sufixo="%" />
                    </td>
                    <td className="w-24 px-1 py-1">
                      <NumInput value={p.variacaoDemaisPct} onChange={(v) => setA(a.key, 'variacaoDemaisPct', v)} sufixo="%" />
                    </td>
                    <td className="w-16 px-1 py-1">
                      <NumInput value={p.contratacoes} onChange={(v) => setA(a.key, 'contratacoes', Math.round(v))} casas={0} min={0} />
                    </td>
                    <td className="w-28 px-1 py-1">
                      <NumInput value={p.custoContratacao} onChange={(v) => setA(a.key, 'custoContratacao', v)} casas={0} min={0} />
                    </td>
                    <td className="px-1 py-1 text-right">
                      <select
                        value={p.mesInicioContratacao}
                        onChange={(ev) => setA(a.key, 'mesInicioContratacao', Number(ev.target.value))}
                        className="h-7 rounded-md border border-amber-300 bg-amber-50 px-1 text-xs"
                        aria-label={`Mês de início das contratações ${a.nome}`}
                      >
                        {MESES_OPC.map((m) => (
                          <option key={m.v} value={m.v}>
                            {m.l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <CelulaMeta area={a.key} p={p} e={e} r={resultado} />
                      <div className="text-[10px]">
                        <VarPct v={ra.crescimentoReceitaPct} />
                      </div>
                    </td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', ra.margemAno < 0 && 'text-red-700')}>{moeda(ra.margemAno)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{pct(ra.margemPct)}</td>
                  </tr>
                )
              })}
              {AREAS_PLANEJAMENTO.filter((a) => a.encerrada).map((a) => (
                <tr key={a.key} className="border-b border-slate-100 text-slate-400">
                  <td className="px-2 py-1.5">{a.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{moedaCurta(resultado.areas[a.key].receitaBaseAno)}</td>
                  <td colSpan={8} className="px-2 py-1.5 italic">Área encerrada: sem projeção nem meta em 2027.</td>
                  <td className="px-2 py-1.5 text-right">—</td>
                  <td className="px-2 py-1.5 text-right">—</td>
                  <td className="px-2 py-1.5 text-right">—</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-2 py-1.5">Total</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moedaCurta(esc.receitaBaseAno)}</td>
                <td colSpan={8} />
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(esc.receitaAno)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(esc.margemAno)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{pct(margem27Pct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao titulo={`Resultado 2027 mês a mês — ${selRes === 'escritorio' ? 'Escritório' : areaNome(selRes)}`}>
        <div className="mb-3">
          <AreaChips value={selRes} onChange={setSelRes} areas={AREAS_2027.map((a) => ({ key: a.key, nome: a.nome }))} />
        </div>
        <TabelaMeses ano={2027} linhas={linhasRes} />
      </Secao>

      <Secao
        titulo="Metas operacionais 2027"
        subtitulo="Meta do escritório por indicador; em cada área dá para pôr uma meta própria (vazio = herda a do escritório). Salve o cenário para guardar."
      >
        <div className="mb-3">
          <AreaChips value={selOp} onChange={setSelOp} areas={AREAS_2027.map((a) => ({ key: a.key, nome: a.nome }))} />
        </div>
        {selOp === 'escritorio' ? null : (
          <div className="mb-2">
            <Aviso tom="azul">Deixe vazio para a área usar a meta do escritório (aparece como sugestão no campo).</Aviso>
          </div>
        )}
        {indicadores.isLoading ? (
          <CarregandoBloco altura="h-48" />
        ) : (
          <TabelaIndicadores
            areaKey={selOp}
            areaNome={selOp === 'escritorio' ? 'Escritório' : areaNome(selOp)}
            v25={indicadores.v25}
            v26={indicadores.v26}
            rotulo26={`2026 (jan–${(MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()})`}
            operacionais={premissas.operacionais}
            editavel
            onChangeMeta={setMetaOp}
          />
        )}
      </Secao>
    </div>
  )
}
