import { AlertTriangle, Crosshair, Database, ListChecks, MousePointerClick, Sigma, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FenixExplicacao, FenixLinha } from './fenix.types'
import { FENIX_UI_ATRIBUTO } from './fenixContext'
import { useFenix } from './useFenix'

const LOGO_FENIX = '/fenix.png'
const uiProps = { [FENIX_UI_ATRIBUTO]: '' }

/** Telas que já têm números explicados — aparece na tela inicial do painel. */
const TELAS_COM_FENIX = [
  'Receita › Resumo, Gestão à vista, Inadimplência e Custos e resultado',
  'Receita › gráficos Comparativo mensal, Recebido por área, Valores acumulados e OPEX mês a mês',
  'Receita › Melhor estimativa (por área e escritório)',
  'DL › Visão geral, Por área e Resultado de caixa',
  'OPEX › Resumo, Projeção de despesas fixas e gráficos (mensal, detalhe, departamentos, orçamento)',
  'Escritório › Levantamento e Rentabilidade',
  'Cobrança › Painel de cobrança e Indicadores (D+1)',
  'Inadimplência › Painel, Comitê e Pontual',
  'Inadimplência judicializada',
  'Timesheet › Resumo e gráfico de horas por mês',
  'Eficiência › Overview, SLAs, Protocolo, Agendamento, Desenvolvimento, Retenção, PDI, NPS, Receita bruta e Inadimplência (cards, evolução mensal e rankings)',
  'Operações legais › Overview, Protocolo, Publicações, Cadastro, Desenvolvimento, Retenção, PDI, Financeiro e Marketing (cards e gráficos)',
]

function LinhaConta({ linha }: { linha: FenixLinha }) {
  const tipo = linha.tipo ?? 'parcela'
  return (
    <div
      className={cn(
        'grid grid-cols-[1rem_1fr_auto] items-baseline gap-x-2 py-1.5',
        tipo === 'total' && 'mt-1 border-t border-slate-300 pt-2 font-semibold text-slate-900',
        tipo === 'info' && 'text-slate-500',
      )}
    >
      <span className="text-center font-mono text-xs text-slate-400">{linha.operador ?? ''}</span>
      <span className={cn('min-w-0 text-[13px]', tipo === 'info' && 'italic')}>
        {linha.rotulo}
        {linha.detalhe && <span className="block text-[11px] font-normal not-italic text-slate-400">{linha.detalhe}</span>}
      </span>
      <span className="text-right text-[13px] tabular-nums">{linha.valor}</span>
    </div>
  )
}

function Secao({ icon: Icon, titulo, children }: { icon: React.ElementType; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {titulo}
      </h4>
      {children}
    </section>
  )
}

function Explicacao({ exp }: { exp: FenixExplicacao }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{exp.tela}</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{exp.titulo}</h3>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{exp.valor}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{exp.resumo}</p>
      </div>

      {exp.filtros && exp.filtros.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {exp.filtros.map((f) => (
            <span
              key={`${f.rotulo}:${f.valor}`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-600"
            >
              <span className="text-slate-400">{f.rotulo}:</span> {f.valor}
            </span>
          ))}
        </div>
      )}

      {(exp.formula || (exp.conta && exp.conta.length > 0)) && (
        <Secao icon={Sigma} titulo="Como a conta é feita">
          {exp.formula && (
            <p className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[13px] font-medium text-amber-950">
              {exp.formula}
            </p>
          )}
          {exp.conta && exp.conta.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-1">
              {exp.conta.map((l, i) => (
                <LinhaConta key={`${i}:${l.rotulo}`} linha={l} />
              ))}
            </div>
          )}
        </Secao>
      )}

      {exp.regras && exp.regras.length > 0 && (
        <Secao icon={ListChecks} titulo="Regras aplicadas">
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-slate-600">
            {exp.regras.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Secao>
      )}

      {exp.fonte && (
        <Secao icon={Database} titulo="De onde vem o dado">
          <p className="text-[13px] leading-relaxed text-slate-600">{exp.fonte}</p>
          {exp.fonteTecnica && (
            <p className="break-words rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">{exp.fonteTecnica}</p>
          )}
        </Secao>
      )}

      {exp.detalhe && (
        <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-900">
          <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {exp.detalhe}
        </p>
      )}
    </div>
  )
}

function Inicio() {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <p>Ficou com dúvida sobre algum número? O Fênix mostra a conta que gerou o valor, com os números de verdade.</p>
      <ol className="space-y-2">
        {[
          'Clique em "Apontar um número".',
          'Os números que o Fênix explica ficam com contorno dourado. Clique no que gerou a dúvida. Em gráfico, pare o mouse no mês e clique.',
          'Veja a fórmula, a memória de cálculo, os filtros e as regras aplicadas.',
        ].map((passo, i) => (
          <li key={passo} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
              {i + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Já disponível em</p>
        <ul className="mt-1 list-disc pl-4 text-[13px]">
          {TELAS_COM_FENIX.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Aba na lateral direita, painel de explicação e aviso do modo de apontar. */
export function FenixAssistente() {
  const fenix = useFenix()
  if (!fenix) return null
  const { painelAberto, inspecionando, selecionado, erro, semAlvos, avisoSemAlvo } = fenix

  return (
    <>
      {!painelAberto && !inspecionando && (
        <button
          type="button"
          {...uiProps}
          onClick={fenix.iniciarInspecao}
          className="group fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-l-2xl border border-r-0 border-white/10 bg-[#101f2e] py-2.5 pl-2.5 pr-2 text-white shadow-lg shadow-slate-900/20 transition-all hover:pl-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          aria-label="Fênix IA: apontar um número"
          title="Fênix IA: clique e aponte o número que você quer entender"
        >
          <img src={LOGO_FENIX} alt="" className="h-7 w-7 object-contain" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-200 group-hover:max-w-[6rem] group-hover:opacity-100 group-focus-visible:max-w-[6rem] group-focus-visible:opacity-100">
            Fênix IA
          </span>
        </button>
      )}

      {inspecionando && (
        <div
          {...uiProps}
          role="status"
          className="fixed left-1/2 top-3 z-[60] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#101f2e] py-1.5 pl-2 pr-1.5 text-sm text-white shadow-xl"
        >
          <img src={LOGO_FENIX} alt="" className="h-6 w-6 shrink-0 object-contain" />
          <span className="font-medium">
            {avisoSemAlvo
              ? 'Esse ponto ainda não tem explicação. Clique num número com contorno dourado.'
              : 'Clique no número que você quer entender. Em gráfico, pare o mouse no mês e clique.'}
          </span>
          <button
            type="button"
            onClick={fenix.cancelarInspecao}
            className="shrink-0 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
          >
            Cancelar (Esc)
          </button>
        </div>
      )}

      {painelAberto && (
        <aside
          {...uiProps}
          aria-label="Fênix IA"
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[420px]"
        >
          <header className="glass-sidebar flex items-center gap-3 px-4 py-3 text-white">
            <img src={LOGO_FENIX} alt="" className="h-9 w-9 object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-tight">Fênix IA</h2>
              <p className="text-xs text-white/60">Explica como cada número do SIOE foi calculado</p>
            </div>
            <button
              type="button"
              onClick={fenix.fecharPainel}
              className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Fechar Fênix"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {semAlvos && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Esta tela ainda não tem números explicados pelo Fênix.
              </p>
            )}
            {erro && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {erro}
              </p>
            )}
            {selecionado ? <Explicacao exp={selecionado} /> : !erro && <Inicio />}
          </div>

          <footer className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={fenix.iniciarInspecao}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#101f2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a3046] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <Crosshair className="h-4 w-4" aria-hidden />
              {selecionado ? 'Apontar outro número' : 'Apontar um número'}
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Em breve: perguntas em texto livre, respondidas por IA.
            </p>
          </footer>
        </aside>
      )}
    </>
  )
}
