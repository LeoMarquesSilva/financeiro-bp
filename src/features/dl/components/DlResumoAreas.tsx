import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { calcularDemonstrativo, totalDemonstrativo } from '../utils/dlCalc'
import type { DlArea, DlGestor, DlGestorAreaMes, DlMesCalculado, DlMesRow } from '../types/dl.types'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import {
  explicarDlGestoresResumo,
  explicarDlLinha,
  explicarDlResultado,
  periodoDl,
  type DlFenixArea,
  type DlFenixContexto,
} from '../fenix/dlFenix'

type Props = {
  areas: DlArea[]
  rows: DlMesRow[]
  meses: number[]
  dlGestor: DlGestorAreaMes[]
  onSelecionarArea: (areaKey: string) => void
  /** Contexto para o Fênix explicar os números (ano, mês parcial, gestores). */
  fenix?: { ano: number; mesParcial: number | null; gestores: DlGestor[] }
}

type FenixAlvo = { chave: string; explicar: FenixExplicar }

function fenixArea(a: DlArea): DlFenixArea {
  return {
    key: a.area_key,
    nome: a.nome,
    departamento: a.departamento,
    referencia: a.referencia_mercado,
    regra_negativo: a.regra_negativo,
  }
}

function Kpi({
  label,
  value,
  sub,
  negativo,
  fenix,
}: {
  label: string
  value: string
  sub?: string
  negativo?: boolean
  fenix?: FenixAlvo
}) {
  const fenixId = useFenixAlvo(fenix?.chave, fenix?.explicar)
  return (
    <div data-fenix={fenixId} className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm sm:p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums sm:text-2xl', negativo ? 'text-rose-700' : 'text-slate-900')}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function LinhaArea({
  area,
  t,
  onSelecionarArea,
  fenix,
}: {
  area: DlArea
  t: DlMesCalculado
  onSelecionarArea: (areaKey: string) => void
  fenix?: FenixAlvo
}) {
  const fenixId = useFenixAlvo(fenix?.chave, fenix?.explicar)
  const ref = area.referencia_mercado
  const abaixo = ref != null && t.receita_liquida > 0 && t.margem_pct < ref
  return (
    <tr
      data-fenix={fenixId}
      className="cursor-pointer border-b border-slate-100 tabular-nums hover:bg-slate-50"
      onClick={() => onSelecionarArea(area.area_key)}
    >
      <td className="py-2 pr-3 text-left font-medium text-slate-800">{area.nome}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(t.receita_liquida)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(t.margem)}</td>
      <td className={cn('whitespace-nowrap px-3 py-2 text-right font-semibold', abaixo ? 'text-rose-700' : 'text-emerald-700')}>
        {t.receita_liquida > 0 ? formatPercent(t.margem_pct * 100) : '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">
        {ref != null ? formatPercent(ref * 100) : '—'}
      </td>
      <td className={cn('whitespace-nowrap px-3 py-2 text-right font-semibold', t.resultado < 0 && 'text-rose-700')}>
        {formatCurrency(t.resultado)}
      </td>
      <td className="whitespace-nowrap py-2 pl-3 text-right text-amber-800">{formatCurrency(t.dl_gestor)}</td>
    </tr>
  )
}

export function DlResumoAreas({ areas, rows, meses, dlGestor, onSelecionarArea, fenix }: Props) {
  const porArea = areas.map((a) => ({
    area: a,
    t: totalDemonstrativo(calcularDemonstrativo(rows, [a.area_key], meses, dlGestor)),
  }))
  const geralMeses = calcularDemonstrativo(rows, areas.map((a) => a.area_key), meses, dlGestor)
  const geral = totalDemonstrativo(geralMeses)

  const ctx: DlFenixContexto | null = fenix
    ? {
        ano: fenix.ano,
        meses,
        areasNomes: areas.map((a) => a.nome),
        mesParcial: fenix.mesParcial,
        rows,
        gestores: fenix.gestores,
      }
    : null
  const telaTabela = 'DL › Visão geral › Resultado por área'
  const alvo = (chave: string, explicar: FenixExplicar): FenixAlvo | undefined =>
    ctx ? { chave, explicar } : undefined
  const fenixTotal = useFenixAlvo(
    ctx ? 'dl.resumo.total' : undefined,
    ctx
      ? () =>
          explicarDlResultado(geral, { ...ctx, tela: telaTabela }, `Total do escritório — ${periodoDl(ctx.ano, meses)}`)
      : undefined,
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Receita líquida"
          value={formatCurrency(geral.receita_liquida)}
          sub={`Bruta: ${formatCurrency(geral.receita_bruta)}`}
          fenix={alvo('dl.resumo.receita_liquida', () => explicarDlLinha('receita_liquida', geralMeses, geral, ctx!))}
        />
        <Kpi
          label="Margem de contribuição"
          value={formatCurrency(geral.margem)}
          sub={`${formatPercent(geral.margem_pct * 100)} da receita líquida (ref. 58%)`}
          fenix={alvo('dl.resumo.margem', () => explicarDlLinha('margem', geralMeses, geral, ctx!))}
        />
        <Kpi
          label="Resultado das áreas"
          value={formatCurrency(geral.resultado)}
          negativo={geral.resultado < 0}
          fenix={alvo('dl.resumo.resultado', () => explicarDlResultado(geral, ctx!, `Resultado das áreas — ${periodoDl(ctx!.ano, meses)}`))}
        />
        <Kpi
          label="DL Gestores"
          value={formatCurrency(geral.dl_gestor)}
          sub="% de cada gestor sobre o resultado da carteira de clientes"
          fenix={alvo('dl.resumo.dl_gestor', () =>
            explicarDlGestoresResumo(
              porArea.map(({ area, t }) => ({ area: fenixArea(area), dl: t.dl_gestor })),
              geral.dl_gestor,
              ctx!,
            ),
          )}
        />
      </div>

      <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Resultado por área</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 text-left font-medium">Área</th>
                <th className="px-3 py-2 text-right font-medium">Receita líquida</th>
                <th className="px-3 py-2 text-right font-medium">Margem</th>
                <th className="px-3 py-2 text-right font-medium">Margem %</th>
                <th className="px-3 py-2 text-right font-medium">Ref. mercado</th>
                <th className="px-3 py-2 text-right font-medium">Resultado</th>
                <th className="py-2 pl-3 text-right font-medium">DL Gestor</th>
              </tr>
            </thead>
            <tbody>
              {porArea.map(({ area, t }) => (
                <LinhaArea
                  key={area.area_key}
                  area={area}
                  t={t}
                  onSelecionarArea={onSelecionarArea}
                  fenix={alvo(`dl.resumo.area.${area.area_key}`, () =>
                    explicarDlResultado(
                      t,
                      { ...ctx!, area: fenixArea(area), tela: telaTabela },
                      `${area.nome} — resultado de ${periodoDl(ctx!.ano, meses)}`,
                    ),
                  )}
                />
              ))}
              <tr data-fenix={fenixTotal} className="bg-slate-50 font-semibold tabular-nums text-slate-900">
                <td className="py-2 pr-3 text-left">Total</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(geral.receita_liquida)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(geral.margem)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatPercent(geral.margem_pct * 100)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">58,00%</td>
                <td className={cn('whitespace-nowrap px-3 py-2 text-right', geral.resultado < 0 && 'text-rose-700')}>
                  {formatCurrency(geral.resultado)}
                </td>
                <td className="whitespace-nowrap py-2 pl-3 text-right text-amber-800">{formatCurrency(geral.dl_gestor)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Clique numa área para abrir o demonstrativo mês a mês.</p>
      </section>
    </div>
  )
}
