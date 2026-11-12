import { useMemo, useState, type ReactNode } from 'react'
import { BadgeCheck, Copy, Download, FilePlus2, Save, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/shared/utils/format'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import { AREAS_2027, MESES_ABREV, areaNome, soma, variacaoPct, type AreaKey } from '../utils/areasPlanejamento'
import { controladoriaNaoRateada, taxaEfetivaEscritorio, totaisArea, somarAreas, type BaseAno } from '../utils/planejamentoBase'
import { simular, type PremissaArea, type Premissas, type PremissasEscritorio, type ResultadoSimulacao } from '../utils/planejamentoCalc'
import { INFLACAO_MODELOS_PCT, REAJUSTE_MODELOS_PCT, type Historico, type ModeloCenario } from '../utils/planejamentoModelos'
import type { PlanCenarioRow } from '../types'
import { useIndicadoresOperacionais } from '../hooks/useIndicadores'
import { usePlanPessoas } from '../hooks/usePlanejamento'
import { fenixResultadoEscritorio, fenixSimulacaoArea } from '../fenix/planejamentoFenix'
import { NumInput } from './NumInput'
import type { ResumoInadimplencia } from '../utils/inadimplenciaResumo'
import { AreaChips, Aviso, CarregandoBloco, PlanKpi, Secao, TabelaMeses, VarPct, moeda, moedaCurta, pct } from './PlanUi'
import { DesdobramentoAreas, MetaCrescimento } from './SimuladorReceita'
import { SimuladorPessoas } from './SimuladorPessoas'
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
  modelos: ModeloCenario[]
  historico: Historico | null
  onAplicarModelo: (m: ModeloCenario) => void
  /** Inadimplência de 2026 (e 2025) como referência para a meta de 2027. */
  inadimplencia?: { r26: ResumoInadimplencia; r25: ResumoInadimplencia } | null
}

const sinalPct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${pct(v)}`)

function CartaoModelo({ m, ativo, base2026, onClick }: { m: ModeloCenario; ativo: boolean; base2026: BaseAno; onClick: () => void }) {
  const r = useMemo(() => simular(base2026, m.premissas).escritorio, [base2026, m.premissas])
  const item = (rotulo: string, valor: ReactNode, tom?: string) => (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className={cn('text-xs font-semibold tabular-nums text-slate-800', tom)}>{valor}</p>
    </div>
  )
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'rounded-lg border p-3 text-left transition-colors',
        ativo ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{m.rotulo}</span>
        <span className={cn('text-lg font-bold tabular-nums', m.crescimentoPct >= 0 ? 'text-indigo-700' : 'text-red-700')}>
          {m.crescimentoPct >= 0 ? '+' : ''}
          {m.crescimentoPct}%
        </span>
      </div>
      <p className="mt-0.5 min-h-[30px] text-[11px] leading-snug text-slate-500">{m.descricao}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
        {item('Receita', moedaCurta(r.receitaAno))}
        {item('Margem', moedaCurta(r.margemAno))}
        {item('Resultado', moedaCurta(r.resultadoAno), r.resultadoAno < 0 ? 'text-red-700' : 'text-emerald-700')}
      </div>
    </button>
  )
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

/** Inadimplência de 2026 ao lado da meta de 2027, com atalho para usar o valor. */
function ReferenciaInadimplencia({
  dados,
  onUsar,
}: {
  dados: { r26: ResumoInadimplencia; r25: ResumoInadimplencia } | null
  onUsar: (v: number) => void
}) {
  if (!dados || dados.r26.meses.length === 0) {
    return <span className="block text-[10px] text-slate-400">Carregando a inadimplência de 2026…</span>
  }
  const { r26, r25 } = dados
  const ate = (MESES_ABREV[Math.max(...r26.meses) - 1] ?? '').toLowerCase()
  const usar = (v: number | null) =>
    v == null ? null : (
      <button
        type="button"
        onClick={() => onUsar(Math.round(v * 10) / 10)}
        className="ml-1 rounded px-1 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
        title="Usar este valor como meta de 2027"
      >
        usar
      </button>
    )
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] leading-5 text-slate-600">
      <p className="font-medium text-slate-700">Inadimplência 2026 (jan–{ate})</p>
      <p title={`Σ do que estava em aberto no fechamento de cada mês ÷ Σ previsto. Média simples dos meses: ${pct(r26.mediaSimplesPct)}.`}>
        Média no fechamento do mês: <strong className="tabular-nums text-slate-900">{pct(r26.mediaFechamentoPct)}</strong>
        {usar(r26.mediaFechamentoPct)}
      </p>
      <p title="Títulos vencidos no período que ainda não foram pagos hoje (acumulado do painel de Inadimplência). É menor porque parte do atraso é paga depois.">
        Ainda em aberto hoje: <strong className="tabular-nums text-slate-900">{pct(r26.emAbertoHojePct)}</strong>
        {usar(r26.emAbertoHojePct)}
        {r25.emAbertoHojePct != null && <span className="text-slate-400"> · 2025: {pct(r25.emAbertoHojePct)}</span>}
      </p>
    </div>
  )
}

export function SimuladorTab(props: Props) {
  const { base2025, base2026, ultimoMesFechado, premissas, onPremissas, resultado, cenarios, cenarioId } = props
  const e = premissas.escritorio
  const [selRes, setSelRes] = useState('escritorio')
  const [selOp, setSelOp] = useState('escritorio')
  const indicadores = useIndicadoresOperacionais(selOp, ultimoMesFechado)
  const pessoas26 = usePlanPessoas(2026)
  const atual = cenarios.find((c) => c.id === cenarioId) ?? null

  const setE = <K extends keyof PremissasEscritorio>(k: K, v: PremissasEscritorio[K]) =>
    onPremissas({ ...premissas, escritorio: { ...e, [k]: v } })
  const mudarE = (mudanca: Partial<PremissasEscritorio>) => onPremissas({ ...premissas, escritorio: { ...e, ...mudanca } })
  const mudarA = (area: AreaKey, mudanca: Partial<PremissaArea>) =>
    onPremissas({ ...premissas, areas: { ...premissas.areas, [area]: { ...premissas.areas[area], ...mudanca } } })
  const soltarTodas = () =>
    onPremissas({
      ...premissas,
      areas: Object.fromEntries(
        Object.entries(premissas.areas).map(([k, v]) => [k, { ...v, crescimentoPct: null }]),
      ) as Record<AreaKey, PremissaArea>,
    })
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
        {props.modelos.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden />
              Cenários prontos
              <span className="font-normal text-slate-500">
                — a partir do crescimento de 2025 para 2026 ({sinalPct(props.historico?.receitaPct)} na receita). Clique para carregar, ajuste o que
                quiser e salve.
              </span>
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {props.modelos.map((m) => (
                <CartaoModelo
                  key={m.id}
                  m={m}
                  base2026={base2026}
                  ativo={JSON.stringify(m.premissas) === JSON.stringify(premissas)}
                  onClick={() => props.onAplicarModelo(m)}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Nos três: áreas no automático; reajuste salarial de {REAJUSTE_MODELOS_PCT}% em janeiro; custo de pessoas crescendo na mesma proporção de
              25→26 (pessoas das áreas {sinalPct(props.historico?.pessoasPct)} para receita {sinalPct(props.historico?.receitaPct)}), com o que passa do
              reajuste em &quot;ajustes na equipe atual&quot;; demais despesas, Controladoria e estrutura +{INFLACAO_MODELOS_PCT}% (Acelerar: 10%, 8% e 8%).
            </p>
          </div>
        )}
      </Secao>

      <MetaCrescimento
        resultado={resultado}
        crescimentoPct={e.crescimentoReceitaPct}
        onCrescimento={(v) => setE('crescimentoReceitaPct', v)}
        historicoPct={props.historico?.receitaPct ?? null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
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
          sub={
            props.inadimplencia?.r26.mediaFechamentoPct != null
              ? `para receber a meta com ${pct(e.inadimplenciaMetaPct)} de inadimplência · 2026: ${pct(props.inadimplencia.r26.mediaFechamentoPct)} no fechamento do mês`
              : `para receber a meta com ${pct(e.inadimplenciaMetaPct)} de inadimplência`
          }
        />
      </div>

      <DesdobramentoAreas resultado={resultado} base2025={base2025} areas={premissas.areas} onArea={mudarA} onSoltarTodas={soltarTodas} />

      <SimuladorPessoas
        resultado={resultado}
        escritorio={e}
        areas={premissas.areas}
        pessoas2026={pessoas26.data}
        ultimoMesFechado={ultimoMesFechado}
        onEscritorio={mudarE}
        onArea={mudarA}
      />

      <Secao titulo="Outras premissas" subtitulo="Imposto, demais despesas, Controladoria, estrutura e inadimplência. Campos em amarelo são editáveis; tudo recalcula na hora.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-600">
              <span className="block font-medium">Alíquota de imposto 2027 (sobre a receita)</span>
              <NumInput value={e.aliquotaPct} onChange={(v) => setE('aliquotaPct', v)} sufixo="%" min={0} max={99} />
              <span className="block text-[10px] text-slate-400">
                Taxa efetiva 2026 jan–{(MESES_ABREV[ultimoMesFechado - 1] ?? '').toLowerCase()}:{' '}
                {pct(taxaEfetivaEscritorio(base2026, Array.from({ length: ultimoMesFechado }, (_, i) => i + 1)) * 100, 2)}. Ajuste para o Lucro Presumido.
              </span>
            </label>
            <div className="space-y-1 text-xs text-slate-600">
              <label className="block space-y-1">
                <span className="block font-medium">Meta de inadimplência</span>
                <NumInput value={e.inadimplenciaMetaPct} onChange={(v) => setE('inadimplenciaMetaPct', v)} sufixo="%" min={0} max={99} />
                <span className="block text-[10px] text-slate-400">Usada no faturamento necessário.</span>
              </label>
              <ReferenciaInadimplencia dados={props.inadimplencia ?? null} onUsar={(v) => setE('inadimplenciaMetaPct', v)} />
            </div>
            <label className="space-y-1 text-xs text-slate-600">
              <span className="block font-medium">Variação da Controladoria (Ops Legais)</span>
              <NumInput value={e.variacaoControladoriaPct} onChange={(v) => setE('variacaoControladoriaPct', v)} sufixo="%" />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              <span className="block font-medium">Variação da estrutura</span>
              <NumInput value={e.variacaoEstruturaPct} onChange={(v) => setE('variacaoEstruturaPct', v)} sufixo="%" />
              <span className="block text-[10px] text-slate-400">Facilities, Financeiro, Marketing, RH, TI e Comercial.</span>
            </label>
            <label className="space-y-1 text-xs text-slate-600 sm:col-span-2">
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
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Demais despesas por área (tudo que não é pessoas)</p>
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Área</th>
                  <th className="px-2 py-1 text-right font-medium">2026</th>
                  <th className="px-2 py-1 text-right font-medium">Variação</th>
                  <th className="px-2 py-1 text-right font-medium">2027</th>
                </tr>
              </thead>
              <tbody>
                {AREAS_2027.map((a) => (
                  <tr key={a.key} className="border-b border-slate-100">
                    <td className="px-2 py-1 text-slate-800">{a.nome}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{moeda(soma(base2026.areas[a.key].demais))}</td>
                    <td className="w-24 px-1 py-1">
                      <NumInput
                        value={premissas.areas[a.key].variacaoDemaisPct}
                        onChange={(v) => mudarA(a.key, { variacaoDemaisPct: v })}
                        sufixo="%"
                        ariaLabel={`Variação demais despesas ${a.nome}`}
                      />
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{moeda(soma(resultado.areas[a.key].demais))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Secao>

      <Secao titulo="Resultado 2027 por área" subtitulo="Margem de contribuição = receita − imposto − pessoas − demais despesas − Controladoria. Margem % sobre a receita líquida, como no DL.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Área</th>
                <th className="px-2 py-1.5 text-right font-medium">Receita 2027</th>
                <th className="px-2 py-1.5 text-right font-medium">Imposto</th>
                <th className="px-2 py-1.5 text-right font-medium">Pessoas</th>
                <th className="px-2 py-1.5 text-right font-medium">Demais</th>
                <th className="px-2 py-1.5 text-right font-medium">Controladoria</th>
                <th className="px-2 py-1.5 text-right font-medium">Margem 2027</th>
                <th className="px-2 py-1.5 text-right font-medium">Margem %</th>
                <th className="px-2 py-1.5 text-right font-medium">Margem 2026</th>
              </tr>
            </thead>
            <tbody>
              {AREAS_2027.map((a) => {
                const ra = resultado.areas[a.key]
                const m26 = totaisArea(base2026.areas[a.key])
                return (
                  <tr key={a.key} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 text-slate-800">{a.nome}</td>
                    <td className="px-2 py-1.5 text-right">
                      <CelulaMeta area={a.key} p={premissas.areas[a.key]} e={e} r={resultado} />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(ra.impostos))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(ra.pessoas))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(ra.demais))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(ra.controladoria))}</td>
                    <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', ra.margemAno < 0 && 'text-red-700')}>{moeda(ra.margemAno)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{pct(ra.margemPct)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                      {moeda(m26.margem)} <span className="text-[10px]">({pct(m26.margemPct)})</span>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-2 py-1.5">Total das áreas</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(esc.receitaAno)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(esc.impostos))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(esc.pessoas))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(esc.demais))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(soma(esc.controladoria))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{moeda(esc.margemAno)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{pct(margem27Pct)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{moeda(t26.margem)}</td>
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
