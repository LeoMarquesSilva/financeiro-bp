import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { MESES_CURTOS, OPEX_COLORS } from '../constants'
import { opexService } from '../services/opexService'
import { mesesFiltroKey, temFiltroMeses } from '../utils/opexPeriodo'
import type { OpexDepartamentoGrupoRow, OpexDepartamentoMesRow, OpexDepartamentoPlanoRow, OpexTituloRow } from '../types/opex.types'

type Props = {
  ano: number
  departamento: string
  label: string
  color: string
  metric: 'realizado' | 'previsto'
  mesesFiltro: number[]
  somenteFixas: boolean
  mensalRows: OpexDepartamentoMesRow[]
}

function pct(realizado: number, previsto: number): string {
  if (!previsto) return '—'
  return formatPercent((realizado / previsto) * 100)
}

function TitulosDepartamento({
  ano,
  departamento,
  grupo,
  plano,
  mesesFiltro,
  somenteFixas,
}: {
  ano: number
  departamento: string
  grupo: string
  plano: string
  mesesFiltro: number[]
  somenteFixas: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['opex', 'departamento-titulos', ano, departamento, grupo, plano, mesesFiltroKey(mesesFiltro), somenteFixas],
    queryFn: () => opexService.fetchDepartamentoTitulos(ano, departamento, grupo, plano, mesesFiltro, somenteFixas),
    staleTime: 60_000,
  })

  if (isLoading) {
    return <p className="px-3 py-2 text-xs text-slate-400">Carregando títulos…</p>
  }
  if (!data?.length) {
    return <p className="px-3 py-2 text-xs text-slate-400">Sem títulos neste plano.</p>
  }

  return (
    <div className="space-y-2 px-1 pb-1">
      {data.map((titulo: OpexTituloRow) => (
        <article key={titulo.ci_item} className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
          <p className="text-sm font-medium text-slate-800">{titulo.descricao}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Título {titulo.nro_titulo}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span className={OPEX_COLORS.previsto.text}>Prev. {formatCurrency(titulo.valor_previsto)}</span>
            <span className={OPEX_COLORS.realizado.text}>Real. {formatCurrency(titulo.valor_realizado)}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

function PlanoRow({
  ano,
  departamento,
  grupo,
  plano,
  mesesFiltro,
  somenteFixas,
  metric,
  expandido,
  onToggle,
}: {
  ano: number
  departamento: string
  grupo: string
  plano: { plano_contas: string; realizado: number; previsto: number }
  mesesFiltro: number[]
  somenteFixas: boolean
  metric: 'realizado' | 'previsto'
  expandido: boolean
  onToggle: () => void
}) {
  const valor = metric === 'realizado' ? plano.realizado : plano.previsto
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50/80"
      >
        {expandido ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
        <span className="min-w-0 flex-1 text-sm text-slate-800">{plano.plano_contas}</span>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            metric === 'realizado' ? OPEX_COLORS.realizado.text : OPEX_COLORS.previsto.text,
          )}
        >
          {formatCurrency(valor)}
        </span>
      </button>
      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-2">
          <TitulosDepartamento
            ano={ano}
            departamento={departamento}
            grupo={grupo}
            plano={plano.plano_contas}
            mesesFiltro={mesesFiltro}
            somenteFixas={somenteFixas}
          />
        </div>
      )}
    </div>
  )
}

function GrupoRow({
  ano,
  departamento,
  grupo,
  mesesFiltro,
  somenteFixas,
  metric,
}: {
  ano: number
  departamento: string
  grupo: { grupo_conta: string; fixo: boolean; realizado: number; previsto: number }
  mesesFiltro: number[]
  somenteFixas: boolean
  metric: 'realizado' | 'previsto'
}) {
  const [aberto, setAberto] = useState(false)
  const [planoAberto, setPlanoAberto] = useState<string | null>(null)

  const { data: planos, isLoading } = useQuery({
    queryKey: ['opex', 'departamento-planos', ano, departamento, grupo.grupo_conta, mesesFiltroKey(mesesFiltro), somenteFixas],
    queryFn: () => opexService.fetchDepartamentoPlanos(ano, departamento, grupo.grupo_conta, mesesFiltro, somenteFixas),
    enabled: aberto,
    staleTime: 60_000,
  })

  const valor = metric === 'realizado' ? grupo.realizado : grupo.previsto

  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/40">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/80"
      >
        {aberto ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-800">{grupo.grupo_conta}</span>
          {grupo.fixo && (
            <span className={cn('mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold', OPEX_COLORS.fixo.bg, OPEX_COLORS.fixo.text)}>
              Fixa
            </span>
          )}
        </span>
        <span className="hidden shrink-0 text-right text-xs tabular-nums sm:block">
          <span className={cn('block', OPEX_COLORS.realizado.text)}>{formatCurrency(grupo.realizado)}</span>
          <span className={cn('block', OPEX_COLORS.previsto.text)}>{formatCurrency(grupo.previsto)}</span>
        </span>
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums sm:hidden',
            metric === 'realizado' ? OPEX_COLORS.realizado.text : OPEX_COLORS.previsto.text,
          )}
        >
          {formatCurrency(valor)}
        </span>
      </button>
      {aberto && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          {isLoading && <p className="text-xs text-slate-400">Carregando planos…</p>}
          {!isLoading && !planos?.length && (
            <p className="text-xs text-slate-400">Sem detalhamento por plano.</p>
          )}
          <div className="space-y-2">
            {planos?.map((plano: OpexDepartamentoPlanoRow) => (
              <PlanoRow
                key={plano.plano_contas}
                ano={ano}
                departamento={departamento}
                grupo={grupo.grupo_conta}
                plano={plano}
                mesesFiltro={mesesFiltro}
                somenteFixas={somenteFixas}
                metric={metric}
                expandido={planoAberto === plano.plano_contas}
                onToggle={() =>
                  setPlanoAberto((prev) => (prev === plano.plano_contas ? null : plano.plano_contas))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function OpexDepartamentoDetalhe({
  ano,
  departamento,
  label,
  color,
  metric,
  mesesFiltro,
  somenteFixas,
  mensalRows,
}: Props) {
  const filtroAtivo = temFiltroMeses(mesesFiltro)

  const { data: grupos, isLoading } = useQuery({
    queryKey: ['opex', 'departamento-grupos', ano, departamento, mesesFiltroKey(mesesFiltro), somenteFixas],
    queryFn: () => opexService.fetchDepartamentoGrupos(ano, departamento, mesesFiltro, somenteFixas),
    staleTime: 60_000,
  })

  const mensal = useMemo(() => {
    const byMes = new Map<number, { previsto: number; realizado: number }>()
    for (const row of mensalRows) {
      if (row.departamento !== departamento) continue
      byMes.set(row.mes, { previsto: row.previsto, realizado: row.realizado })
    }
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const vals = byMes.get(mes) ?? { previsto: 0, realizado: 0 }
      return { mes, mesLabel: MESES_CURTOS[i], ...vals }
    }).filter((m) => !filtroAtivo || mesesFiltro.includes(m.mes))
  }, [mensalRows, departamento, filtroAtivo, mesesFiltro])

  const totais = useMemo(() => {
    const rows = mensalRows.filter((r) => r.departamento === departamento)
    return rows.reduce(
      (acc, row) => ({ previsto: acc.previsto + row.previsto, realizado: acc.realizado + row.realizado }),
      { previsto: 0, realizado: 0 },
    )
  }, [mensalRows, departamento])

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/5" style={{ backgroundColor: color }} aria-hidden />
          <div>
            <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
            <p className="text-[11px] text-slate-500">Detalhamento · grupo → plano → título</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className={OPEX_COLORS.previsto.text}>Prev. {formatCurrency(totais.previsto)}</span>
          <span className={OPEX_COLORS.realizado.text}>Real. {formatCurrency(totais.realizado)}</span>
          <span className="text-slate-500">{pct(totais.realizado, totais.previsto)} do previsto</span>
        </div>
      </div>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-2">Mês</th>
              <th className="pb-2 pr-2 text-right">Previsto</th>
              <th className="pb-2 text-right">Realizado</th>
            </tr>
          </thead>
          <tbody>
            {mensal.map((m) => (
              <tr key={m.mes} className="border-b border-slate-100/80">
                <td className="py-1.5 pr-2 font-medium uppercase text-slate-700">{m.mesLabel}</td>
                <td className={cn('py-1.5 pr-2 text-right tabular-nums', OPEX_COLORS.previsto.text)}>
                  {m.previsto > 0 ? formatCurrency(m.previsto) : '—'}
                </td>
                <td className={cn('py-1.5 text-right tabular-nums', OPEX_COLORS.realizado.text)}>
                  {m.realizado > 0 ? formatCurrency(m.realizado) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando grupos…
        </div>
      )}

      {!isLoading && !grupos?.length && (
        <p className="text-sm text-slate-500">Sem despesas por grupo de conta nesta área.</p>
      )}

      <div className="space-y-2">
        {grupos?.map((grupo: OpexDepartamentoGrupoRow) => (
          <GrupoRow
            key={grupo.grupo_conta}
            ano={ano}
            departamento={departamento}
            grupo={grupo}
            mesesFiltro={mesesFiltro}
            somenteFixas={somenteFixas}
            metric={metric}
          />
        ))}
      </div>
    </div>
  )
}
