import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react'
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

function TaxaCell({
  valor,
  media,
}: {
  valor: number | null
  media: number | null
}) {
  const delta = valor != null && media != null ? valor - media : null
  const positivo = resultadoHoraPositivo(delta)
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="tabular-nums text-slate-800">{formatValorHoraRecebido(valor)}</span>
      {delta != null ? (
        <span
          className={cn(
            'inline-flex items-center justify-end gap-1 text-xs tabular-nums font-medium',
            positivo === true && 'text-emerald-700',
            positivo === false && 'text-rose-700',
          )}
        >
          {positivo === true ? <ArrowUp className="h-3 w-3 shrink-0" aria-hidden /> : null}
          {positivo === false ? <ArrowDown className="h-3 w-3 shrink-0" aria-hidden /> : null}
          {formatResultadoHora(delta)} vs média
        </span>
      ) : null}
    </div>
  )
}

function CardMedia({
  titulo,
  valor,
  detalhe,
  loading,
}: {
  titulo: string
  valor: string
  detalhe: string
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{loading ? '…' : valor}</p>
      <p className="mt-1 text-xs text-slate-400">{detalhe}</p>
    </div>
  )
}

export function RentabilidadeContratosSection({ filtros, data, loading, error }: Props) {
  const areaLabel = filtros.area ?? 'Todas as áreas'
  const periodoLabel = labelPeriodo(filtros.dataInicio, filtros.dataFim)

  if (error) {
    return (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error.message}
      </p>
    )
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Rentabilidade do escritório{' '}
          <span className="font-normal text-amber-800/90">| {areaLabel}</span>
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">Período de referência | {periodoLabel}</p>
        <p className="mt-1 text-xs text-slate-400">
          Escritório inteiro, sem filtro de grupo. A hora efetiva divide o recebido pelas horas do
          timesheet. A hora prevista/faturada divide o valor do item (vencimento no período) pelas
          mesmas horas e não considera inadimplência. Os mesmos planos de contas da Receita.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CardMedia
          titulo="Horas do timesheet"
          valor={formatMediaHorasMes(data?.horas_minutos)}
          detalhe="Todas as horas do período"
          loading={loading}
        />
        <CardMedia
          titulo="Valor efetivo médio da hora"
          valor={formatValorHoraRecebido(data?.valor_hora_efetivo_escritorio)}
          detalhe={
            data
              ? `${formatCurrency(data.recebido_escritorio)} recebidos`
              : 'Recebido ÷ horas do escritório'
          }
          loading={loading}
        />
        <CardMedia
          titulo="Valor médio previsto/faturado"
          valor={formatValorHoraRecebido(data?.valor_hora_previsto_escritorio)}
          detalhe={
            data
              ? `${formatCurrency(data.previsto_escritorio)} previstos/faturados`
              : 'Previsto ÷ horas do escritório'
          }
          loading={loading}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-800">
            Ranking por grupo cliente
          </p>
          <p className="text-xs text-slate-500">
            Do mais rentável ao menos rentável, pela hora efetiva. Sem horas no período, a taxa
            fica em branco e a linha vai para o fim.
            {data?.linhas.length ? ` · ${data.linhas.length.toLocaleString('pt-BR')} grupos` : ''}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando rentabilidade…
          </div>
        ) : !data?.linhas.length ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            Nenhum recebido, previsto ou hora no período para a área selecionada.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Grupo cliente</th>
                  <th className="px-4 py-3 text-right">Recebido</th>
                  <th className="px-4 py-3 text-right">
                    Previsto/faturado
                    <span className="block font-normal normal-case text-slate-400">sem inadimplência</span>
                  </th>
                  <th className="px-4 py-3 text-right">Horas</th>
                  <th className="px-4 py-3 text-right">Valor efetivo da hora</th>
                  <th className="px-4 py-3 text-right">Valor médio da hora</th>
                </tr>
              </thead>
              <tbody>
                {data.linhas.map((linha, index) => (
                  <tr
                    key={linha.cliente}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 tabular-nums text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                          {iniciaisCliente(linha.cliente)}
                        </div>
                        <div className="min-w-0">
                          <span className="block max-w-[16rem] truncate font-medium text-slate-900">
                            {linha.cliente}
                          </span>
                          {linha.razoes_sociais.length > 1 ? (
                            <span
                              className="block text-xs text-slate-500"
                              title={linha.razoes_sociais.join('\n')}
                            >
                              {linha.razoes_sociais.length} razões sociais
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatCurrency(linha.recebido_periodo)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatCurrency(linha.previsto_periodo)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-800">
                      {formatMediaHorasMes(linha.horas_minutos)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TaxaCell
                        valor={linha.valor_hora_efetivo}
                        media={data.valor_hora_efetivo_escritorio}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <TaxaCell
                        valor={linha.valor_hora_previsto}
                        media={data.valor_hora_previsto_escritorio}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
