import { useFenixAlvo } from '@/shared/fenix/useFenix'
import { cn } from '@/lib/utils'
import {
  INDICADORES,
  formatarIndicador,
  metaEfetivaArea,
  quantoFalta,
  type IndicadorDef,
  type ValorIndicador,
} from '../utils/indicadoresOperacionais'
import type { MetaOperacionalPremissa } from '../utils/planejamentoCalc'
import type { ValoresAno } from '../hooks/useIndicadores'
import { fenixValor } from '../fenix/planejamentoFenix'

type Props = {
  areaKey: string
  areaNome: string
  v25: ValoresAno
  v26: ValoresAno
  rotulo26: string
  operacionais: Record<string, MetaOperacionalPremissa>
  editavel?: boolean
  onChangeMeta?: (indicador: string, area: string | null, valor: number | null) => void
}

function parseMeta(s: string): number | null {
  const t = s.trim().replace(/\./g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function MetaInput({ valor, placeholder, onChange, unidade }: {
  valor: number | null
  placeholder?: string
  onChange: (v: number | null) => void
  unidade: string
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        key={String(valor)}
        defaultValue={valor == null ? '' : String(valor).replace('.', ',')}
        placeholder={placeholder}
        onBlur={(e) => onChange(parseMeta(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        inputMode="decimal"
        className="h-7 w-20 rounded-md border border-amber-300 bg-amber-50 px-1.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
      <span className="w-6 text-[10px] text-slate-400">{unidade}</span>
    </div>
  )
}

function Linha({ def, v25, v26, rotulo26, areaKey, areaNome, premissa, editavel, onChangeMeta }: {
  def: IndicadorDef
  v25: ValorIndicador | undefined
  v26: ValorIndicador | undefined
  rotulo26: string
  areaKey: string
  areaNome: string
  premissa: MetaOperacionalPremissa | undefined
  editavel: boolean
  onChangeMeta?: Props['onChangeMeta']
}) {
  const a25 = v25?.acumulado ?? null
  const a26 = v26?.acumulado ?? null
  const ehEscritorio = areaKey === 'escritorio'
  const meta27 = ehEscritorio ? premissa?.escritorio ?? null : metaEfetivaArea(premissa, areaKey)
  const propria = !ehEscritorio && premissa?.areas[areaKey] != null
  const falta = quantoFalta(meta27, a26)
  const fenixId = useFenixAlvo(`planejamento.operacional.${def.id}.${areaKey}`, () =>
    fenixValor({
      tela: 'Operacional',
      titulo: `${def.nome} — ${areaNome}`,
      valor: formatarIndicador(a26, def.unidade),
      resumo: `${def.formula}. 2025 = ano inteiro; ${rotulo26} = acumulado até o último mês fechado.`,
      formula: def.formula,
      conta: [
        { rotulo: '2025', valor: formatarIndicador(a25, def.unidade) },
        { rotulo: rotulo26, valor: formatarIndicador(a26, def.unidade) },
        { rotulo: 'Meta atual', valor: formatarIndicador(def.metaAtual, def.unidade) },
        { rotulo: 'Meta 2027', valor: formatarIndicador(meta27, def.unidade), tipo: 'total' },
      ],
      regras: [
        'Acumulado = soma dos numeradores ÷ soma dos denominadores dos meses (não é média dos %).',
        ...(def.unidade === 'h' ? ['Horas: os dois anos comparam os mesmos meses (janeiro até o último mês fechado).'] : []),
        ...(!ehEscritorio ? ['Área sem meta própria usa a meta 2027 do escritório.'] : []),
      ],
      fonteTecnica: 'eficienciaService.getOverview / eficiencia_ops_legais_* / planejamento_timesheet_mensal',
    }),
  )
  if (!ehEscritorio && !def.porArea) return null
  return (
    <tr className="border-b border-slate-100">
      <td className="px-2 py-1.5 text-slate-800">
        {def.nome}
        <span className="ml-1 text-[10px] text-slate-400">{def.grupo}</span>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">{formatarIndicador(a25, def.unidade)}</td>
      <td data-fenix={fenixId} className="px-2 py-1.5 text-right font-semibold tabular-nums">
        {formatarIndicador(a26, def.unidade)}
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{formatarIndicador(def.metaAtual, def.unidade)}</td>
      <td className="px-2 py-1.5 text-right">
        {editavel && onChangeMeta ? (
          <MetaInput
            valor={ehEscritorio ? premissa?.escritorio ?? null : premissa?.areas[areaKey] ?? null}
            placeholder={
              ehEscritorio
                ? def.metaAtual != null
                  ? String(def.metaAtual)
                  : ''
                : premissa?.escritorio != null
                  ? String(premissa.escritorio).replace('.', ',')
                  : ''
            }
            unidade={def.unidade}
            onChange={(v) => onChangeMeta(def.id, ehEscritorio ? null : areaKey, v)}
          />
        ) : (
          <span className={cn('tabular-nums', propria && 'font-semibold text-indigo-700')}>
            {formatarIndicador(meta27, def.unidade)}
          </span>
        )}
      </td>
      <td
        className={cn(
          'px-2 py-1.5 text-right tabular-nums',
          falta != null && (falta <= 0 ? 'text-emerald-700' : 'text-red-700'),
        )}
      >
        {falta == null ? '—' : falta <= 0 ? 'já atinge' : `+${formatarIndicador(falta, def.unidade)}`}
      </td>
    </tr>
  )
}

/** Indicadores operacionais: 2025, 2026 YTD, meta atual, meta 2027 (editável no simulador) e quanto falta. */
export function TabelaIndicadores({ areaKey, areaNome, v25, v26, rotulo26, operacionais, editavel = false, onChangeMeta }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">Indicador</th>
            <th className="px-2 py-1.5 text-right font-medium">2025</th>
            <th className="px-2 py-1.5 text-right font-medium">{rotulo26}</th>
            <th className="px-2 py-1.5 text-right font-medium">Meta atual</th>
            <th className="px-2 py-1.5 text-right font-medium">
              Meta 2027{editavel && areaKey !== 'escritorio' ? ' (própria da área)' : ''}
            </th>
            <th className="px-2 py-1.5 text-right font-medium">Falta vs. 2026</th>
          </tr>
        </thead>
        <tbody>
          {INDICADORES.map((def) => (
            <Linha
              key={def.id}
              def={def}
              v25={v25[def.id]}
              v26={v26[def.id]}
              rotulo26={rotulo26}
              areaKey={areaKey}
              areaNome={areaNome}
              premissa={operacionais[def.id]}
              editavel={editavel}
              onChangeMeta={onChangeMeta}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
