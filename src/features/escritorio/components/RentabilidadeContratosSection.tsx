import { ArrowDown, ArrowUp, Building2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import type { LevantamentoFiltros } from '../services/escritorioLevantamentoService'
import type { RentabilidadeContratos } from '../services/escritorioRentabilidadeService'
import {
  formatMediaHorasMes,
  formatResultadoHora,
  formatValorHoraRecebido,
  labelPeriodo,
  resultadoHoraPositivo,
} from '../utils/rentabilidadeFormat'

type Props = {
  filtros: LevantamentoFiltros
  data: RentabilidadeContratos | undefined
  loading: boolean
  error: Error | null
}

function iniciaisCliente(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function RentabilidadeContratosSection({ filtros, data, loading, error }: Props) {
  const areaLabel = filtros.area ?? 'Todas as áreas'
  const periodoLabel = labelPeriodo(filtros.dataInicio, filtros.dataFim)

  if (filtros.grupos.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">Selecione um Grupo Cliente</p>
        <p className="mt-1 text-sm text-slate-500">
          A rentabilidade compara o honorário médio mensal recebido com as horas apontadas no
          timesheet.
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error.message}
      </p>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Rentabilidade dos contratos{' '}
            <span className="font-normal text-amber-800/90">| {areaLabel}</span>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Período de referência | {periodoLabel}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Comparativo entre valor recebido, custo da hora e cenário atual por razão social.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Custo-hora produtiva
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {loading ? '…' : data?.custo_hora_produtiva != null ? formatCurrency(data.custo_hora_produtiva) : '—'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-800">Cenário atual</p>
          {data?.meses_periodo ? (
            <p className="text-xs text-slate-500">
              Médias calculadas sobre {data.meses_periodo}{' '}
              {data.meses_periodo === 1 ? 'mês' : 'meses'}
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando rentabilidade…
          </div>
        ) : !data?.linhas.length ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            Nenhum dado de recebido ou timesheet no período para o grupo e área selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Clientes</th>
                  <th className="px-4 py-3 text-right">Valor do Contrato</th>
                  <th className="px-4 py-3 text-right">Média horas/mês</th>
                  <th className="px-4 py-3 text-right">Valor-hora recebido</th>
                  <th className="px-4 py-3 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.linhas.map((linha) => {
                  const positivo = resultadoHoraPositivo(linha.resultado_hora)
                  return (
                    <tr
                      key={linha.cliente}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                            {iniciaisCliente(linha.cliente)}
                          </div>
                          <span className="max-w-[14rem] truncate font-medium text-slate-900">
                            {linha.cliente}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                        {formatCurrency(linha.valor_contrato_mensal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                        {formatMediaHorasMes(linha.media_horas_mes_minutos)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                        {formatValorHoraRecebido(linha.valor_hora_recebido)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-1 tabular-nums font-medium',
                            positivo === true && 'text-emerald-700',
                            positivo === false && 'text-rose-700',
                            positivo == null && 'text-slate-400',
                          )}
                        >
                          {positivo === true ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : null}
                          {positivo === false ? (
                            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : null}
                          {formatResultadoHora(linha.resultado_hora)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
