import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { parseDateAsLocal } from '@/shared/utils/format'
import {
  MESES_EFICIENCIA,
  isDiaFiltro,
  isMesesFiltro,
  isSemanaFiltro,
  makePeriodoDiaFiltro,
  rangeSemanaFiltro,
  toggleMesFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { toPriMaiuscula } from '../utils/textFormat'

type Props = {
  value: MesFiltroEficiencia
  onChange: (mes: MesFiltroEficiencia) => void
  /** Filtros de semana (Ops Legais). Default true. */
  showSemanas?: boolean
  /** Botão "Resultado" (jun+ fechados). Default true. */
  showResultado?: boolean
  /**
   * Campos De / Até ao lado de Dez.
   * Desligar no Overview. Default false.
   */
  showDiaPicker?: boolean
  /** Ano de referência do calendário (restringe seleção). */
  ano?: number
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
const DATE_BTN =
  'inline-flex h-[30px] items-center gap-1 rounded-full border px-2.5 text-xs font-semibold tabular-nums transition-all'

function fmtBrShort(iso: string | null): string {
  if (!iso) return '––/––'
  const d = iso.slice(8, 10)
  const m = iso.slice(5, 7)
  return `${d}/${m}`
}

function DateBoundChip({
  label,
  valueIso,
  ativo,
  ano,
  disabledBefore,
  disabledAfter,
  onPick,
}: {
  label: string
  valueIso: string | null
  ativo: boolean
  ano?: number
  disabledBefore?: Date
  disabledAfter?: Date
  onPick: (iso: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = valueIso ? (parseDateAsLocal(valueIso) ?? undefined) : undefined
  const defaultMonth =
    selected ?? (ano != null ? new Date(ano, new Date().getMonth(), 1) : undefined)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(DATE_BTN, ativo && valueIso ? BTN_ON : BTN_OFF)}
          title={`${label}: período por data`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
          <span>{fmtBrShort(valueIso)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={defaultMonth}
          onSelect={(d) => {
            if (!d) return
            if (ano != null && d.getFullYear() !== ano) return
            onPick(format(d, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          locale={ptBR}
          disabled={[
            ...(ano != null
              ? [{ before: new Date(ano, 0, 1), after: new Date(ano, 11, 31) }]
              : []),
            ...(disabledBefore ? [{ before: disabledBefore }] : []),
            ...(disabledAfter ? [{ after: disabledAfter }] : []),
          ]}
        />
      </PopoverContent>
    </Popover>
  )
}

export function MesFilterButtons({
  value,
  onChange,
  showSemanas = true,
  showResultado = true,
  showDiaPicker = false,
  ano,
}: Props) {
  let valueEfetivo: MesFiltroEficiencia = value
  if (!showSemanas && isSemanaFiltro(valueEfetivo)) valueEfetivo = null
  if (!showResultado && valueEfetivo === 'resultado') valueEfetivo = null
  if (!showDiaPicker && isDiaFiltro(valueEfetivo)) valueEfetivo = null

  const periodoAtivo = isDiaFiltro(valueEfetivo) ? valueEfetivo : null
  const [draftDe, setDraftDe] = useState<string | null>(periodoAtivo?.de ?? null)
  const [draftAte, setDraftAte] = useState<string | null>(periodoAtivo?.ate ?? null)

  // Só espelha o filtro aplicado (De+Até). Não zera rascunho no meio da seleção.
  useEffect(() => {
    if (isDiaFiltro(value)) {
      setDraftDe(value.de)
      setDraftAte(value.ate)
    }
  }, [value])

  function selectFiltro(next: MesFiltroEficiencia) {
    if (!isDiaFiltro(next)) {
      setDraftDe(null)
      setDraftAte(null)
    }
    onChange(next)
  }

  function onPickDe(iso: string) {
    setDraftDe(iso)
    if (draftAte && draftAte >= iso) {
      onChange(makePeriodoDiaFiltro(iso, draftAte))
      return
    }
    // Ainda sem "Até": não completa sozinho; limpa filtro de mês/dia anterior.
    setDraftAte(null)
    onChange(null)
  }

  function onPickAte(iso: string) {
    setDraftAte(iso)
    if (draftDe) {
      onChange(makePeriodoDiaFiltro(draftDe, iso))
      return
    }
    // Sem "De": só rascunho; espera o início.
    onChange(null)
  }

  function limparPeriodo() {
    setDraftDe(null)
    setDraftAte(null)
    onChange(null)
  }

  const deDate = draftDe ? (parseDateAsLocal(draftDe) ?? undefined) : undefined
  const ateDate = draftAte ? (parseDateAsLocal(draftAte) ?? undefined) : undefined

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <button
        type="button"
        onClick={() => selectFiltro(null)}
        className={cn(BTN, valueEfetivo === null && !draftDe && !draftAte ? BTN_ON : BTN_OFF)}
        aria-pressed={valueEfetivo === null && !draftDe && !draftAte}
      >
        {toPriMaiuscula('Todos os meses')}
      </button>
      {showResultado ? (
        <button
          type="button"
          onClick={() => selectFiltro('resultado')}
          className={cn(BTN, valueEfetivo === 'resultado' ? BTN_ON : BTN_OFF)}
          aria-pressed={valueEfetivo === 'resultado'}
          title="Junho até o último mês fechado — exclui o mês corrente"
        >
          {toPriMaiuscula('Resultado')}
        </button>
      ) : null}
      {showSemanas ? (
        <>
          <button
            type="button"
            onClick={() => selectFiltro('semana_passada')}
            className={cn(BTN, valueEfetivo === 'semana_passada' ? BTN_ON : BTN_OFF)}
            aria-pressed={valueEfetivo === 'semana_passada'}
            title={rangeSemanaFiltro('semana_passada').label}
          >
            {toPriMaiuscula('Semana passada')}
          </button>
          <button
            type="button"
            onClick={() => selectFiltro('semana_retrasada')}
            className={cn(BTN, valueEfetivo === 'semana_retrasada' ? BTN_ON : BTN_OFF)}
            aria-pressed={valueEfetivo === 'semana_retrasada'}
            title={rangeSemanaFiltro('semana_retrasada').label}
          >
            {toPriMaiuscula('Semana retrasada')}
          </button>
        </>
      ) : null}
      {MESES_EFICIENCIA.map((label, idx) => {
        const mes = idx + 1
        const ativo = isMesesFiltro(valueEfetivo) && valueEfetivo.includes(mes)
        return (
          <button
            key={mes}
            type="button"
            onClick={() => selectFiltro(toggleMesFiltro(valueEfetivo, mes))}
            className={cn(BTN, ativo ? BTN_ON : BTN_OFF)}
            aria-pressed={ativo}
          >
            {label}
          </button>
        )
      })}

      {showDiaPicker ? (
        <>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden />
          <DateBoundChip
            label="De"
            valueIso={draftDe}
            ativo={Boolean(draftDe)}
            ano={ano}
            disabledAfter={ateDate}
            onPick={onPickDe}
          />
          <DateBoundChip
            label="Até"
            valueIso={draftAte}
            ativo={Boolean(draftAte)}
            ano={ano}
            disabledBefore={deDate}
            onPick={onPickAte}
          />
          {draftDe || draftAte ? (
            <button
              type="button"
              className={cn(DATE_BTN, BTN_OFF, 'px-2')}
              title="Limpar período"
              onClick={limparPeriodo}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
