import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/shared/utils/format'
import { ElementCopyButton } from '@/shared/components/ElementCopyButton'
import {
  RentabilidadeContratosCopySlide,
  RENTABILIDADE_COPY_SLIDE_WIDTH,
} from './RentabilidadeContratosCopySlide'
import { escritorioRentabilidadeService } from '../services/escritorioRentabilidadeService'
import {
  buildGruposComFaturamentoSet,
  inicioUltimos3Meses,
  rankingRentabilidadeParaCopia,
} from '../utils/rentabilidadeCopy'
import type { LevantamentoFiltros } from '../services/escritorioLevantamentoService'
import type {
  RentabilidadeContratoLinha,
  RentabilidadeContratos,
} from '../services/escritorioRentabilidadeService'
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
  areas: readonly string[]
  onAreaChange: (area: string | null) => void
  /** Filtro global ia além do mês anterior fechado. */
  periodoRecortadoMesFechado?: boolean
}

function AreaChips({
  areas,
  value,
  onChange,
}: {
  areas: readonly string[]
  value: string | null
  onChange: (area: string | null) => void
}) {
  const opcoes: { key: string | null; label: string }[] = [
    { key: null, label: 'Todas as áreas' },
    ...areas.map((a) => ({ key: a, label: a })),
  ]
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por área">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">Área</span>
      {opcoes.map((o) => {
        const ativo = value === o.key
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.key)}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
              ativo
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
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

type SortKey = keyof Pick<
  RentabilidadeContratoLinha,
  | 'cliente'
  | 'recebido_periodo'
  | 'previsto_periodo'
  | 'horas_minutos'
  | 'valor_hora_efetivo'
  | 'valor_hora_previsto'
>

function compareLinhas(
  a: RentabilidadeContratoLinha,
  b: RentabilidadeContratoLinha,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  if (key === 'cliente') {
    const cmp = a.cliente.localeCompare(b.cliente, 'pt-BR', { sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  }
  const av = a[key]
  const bv = b[key]
  const aNull = av == null || !Number.isFinite(av)
  const bNull = bv == null || !Number.isFinite(bv)
  if (aNull && bNull) return a.cliente.localeCompare(b.cliente, 'pt-BR')
  if (aNull) return 1
  if (bNull) return -1
  const cmp = av - bv
  if (cmp === 0) return a.cliente.localeCompare(b.cliente, 'pt-BR')
  return dir === 'asc' ? cmp : -cmp
}

function SortHeader({
  label,
  hint,
  column,
  active,
  dir,
  align = 'left',
  onSort,
}: {
  label: string
  hint?: string
  column: SortKey
  active: boolean
  dir: 'asc' | 'desc'
  align?: 'left' | 'right'
  onSort: (column: SortKey) => void
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      className={cn('px-4 py-3', align === 'right' && 'text-right')}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={cn(
          'inline-flex max-w-full items-center gap-1 uppercase tracking-wide hover:text-slate-800',
          align === 'right' && 'w-full justify-end text-right',
        )}
        onClick={() => onSort(column)}
      >
        <span>
          {label}
          {hint ? (
            <span className="block font-normal normal-case tracking-normal text-slate-400">{hint}</span>
          ) : null}
        </span>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-40')} aria-hidden />
      </button>
    </th>
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

export function RentabilidadeContratosSection({
  filtros,
  data,
  loading,
  error,
  areas,
  onAreaChange,
  periodoRecortadoMesFechado = false,
}: Props) {
  const areaLabel = filtros.area ?? 'Todas as áreas'
  const periodoLabel = labelPeriodo(filtros.dataInicio, filtros.dataFim)
  const [sortKey, setSortKey] = useState<SortKey>('valor_hora_efetivo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const dataFim = data?.data_fim ?? filtros.dataFim
  const inicioFaturamento3m = useMemo(() => inicioUltimos3Meses(dataFim), [dataFim])

  const { data: gruposFaturamento3m } = useQuery({
    queryKey: [
      'escritorio',
      'rentabilidade-faturamento-3m',
      inicioFaturamento3m,
      dataFim,
      filtros.area,
    ] as const,
    queryFn: () =>
      escritorioRentabilidadeService.fetchGruposComFaturamento(
        inicioFaturamento3m,
        dataFim,
        filtros.area,
      ),
    enabled: Boolean(data?.linhas.length),
    staleTime: 60_000,
  })

  const gruposFaturamentoSet = useMemo(
    () => buildGruposComFaturamentoSet(gruposFaturamento3m),
    [gruposFaturamento3m],
  )

  const copyTopRef = useRef<HTMLDivElement>(null)
  const copyBottomRef = useRef<HTMLDivElement>(null)

  const linhasTopCopia = useMemo(
    () => rankingRentabilidadeParaCopia(data?.linhas ?? [], gruposFaturamentoSet, 'desc'),
    [data?.linhas, gruposFaturamentoSet],
  )
  const linhasBottomCopia = useMemo(
    () => rankingRentabilidadeParaCopia(data?.linhas ?? [], gruposFaturamentoSet, 'asc'),
    [data?.linhas, gruposFaturamentoSet],
  )

  const linhas = useMemo(() => {
    const rows = data?.linhas ?? []
    return [...rows].sort((a, b) => compareLinhas(a, b, sortKey, sortDir))
  }, [data?.linhas, sortKey, sortDir])

  function alternarOrdem(column: SortKey) {
    if (sortKey === column) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column)
    setSortDir(column === 'cliente' ? 'asc' : 'desc')
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
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Rentabilidade do escritório{' '}
          <span className="font-normal text-amber-800/90">| {areaLabel}</span>
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">Período de referência | {periodoLabel}</p>
        <p className="mt-1 text-xs text-slate-400">
          Dados até o mês anterior fechado{' '}
          (sem o mês corrente em aberto).
          {periodoRecortadoMesFechado
            ? ' O intervalo do filtro acima foi limitado automaticamente.'
            : null}{' '}
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

      <AreaChips areas={areas} value={filtros.area} onChange={onAreaChange} />

      <div
        className="pointer-events-none fixed left-[-9999px] top-0 z-[-1] opacity-0"
        aria-hidden
        data-chart-export-full-scroll
      >
        <div ref={copyTopRef} style={{ width: RENTABILIDADE_COPY_SLIDE_WIDTH }}>
          <RentabilidadeContratosCopySlide
            variant="top"
            linhas={linhasTopCopia}
            mediaValorHoraEscritorio={data?.valor_hora_previsto_escritorio ?? null}
            mediaEfetivoEscritorio={data?.valor_hora_efetivo_escritorio ?? null}
            horasEscritorioMinutos={data?.horas_minutos ?? 0}
            recebidoEscritorio={data?.recebido_escritorio ?? 0}
            dataInicio={data?.data_inicio ?? filtros.dataInicio}
            dataFim={data?.data_fim ?? filtros.dataFim}
          />
        </div>
        <div ref={copyBottomRef} style={{ width: RENTABILIDADE_COPY_SLIDE_WIDTH }}>
          <RentabilidadeContratosCopySlide
            variant="bottom"
            linhas={linhasBottomCopia}
            mediaValorHoraEscritorio={data?.valor_hora_previsto_escritorio ?? null}
            mediaEfetivoEscritorio={data?.valor_hora_efetivo_escritorio ?? null}
            horasEscritorioMinutos={data?.horas_minutos ?? 0}
            recebidoEscritorio={data?.recebido_escritorio ?? 0}
            dataInicio={data?.data_inicio ?? filtros.dataInicio}
            dataFim={data?.data_fim ?? filtros.dataFim}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Ranking por grupo cliente</p>
              <p className="text-xs text-slate-500">
                Do mais rentável ao menos rentável, pela hora efetiva. Sem horas no período, a taxa
                fica em branco e a linha vai para o fim.
                {data?.linhas.length ? ` · ${data.linhas.length.toLocaleString('pt-BR')} grupos` : ''}
              </p>
            </div>
            {data?.linhas.length ? (
              <div className="pointer-events-auto flex flex-wrap gap-2">
                <ElementCopyButton
                  containerRef={copyTopRef}
                  label="Copiar top 20 rentáveis"
                  preserveBackground
                  className="bg-white"
                />
                <ElementCopyButton
                  containerRef={copyBottomRef}
                  label="Copiar top 20 menos rentáveis"
                  preserveBackground
                  className="bg-white"
                />
              </div>
            ) : null}
          </div>
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
                <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                  <th className="px-4 py-3">#</th>
                  <SortHeader
                    label="Grupo cliente"
                    column="cliente"
                    active={sortKey === 'cliente'}
                    dir={sortDir}
                    onSort={alternarOrdem}
                  />
                  <SortHeader
                    label="Recebido"
                    column="recebido_periodo"
                    active={sortKey === 'recebido_periodo'}
                    dir={sortDir}
                    align="right"
                    onSort={alternarOrdem}
                  />
                  <SortHeader
                    label="Previsto/faturado"
                    hint="sem inadimplência"
                    column="previsto_periodo"
                    active={sortKey === 'previsto_periodo'}
                    dir={sortDir}
                    align="right"
                    onSort={alternarOrdem}
                  />
                  <SortHeader
                    label="Horas"
                    column="horas_minutos"
                    active={sortKey === 'horas_minutos'}
                    dir={sortDir}
                    align="right"
                    onSort={alternarOrdem}
                  />
                  <SortHeader
                    label="Valor efetivo da hora"
                    column="valor_hora_efetivo"
                    active={sortKey === 'valor_hora_efetivo'}
                    dir={sortDir}
                    align="right"
                    onSort={alternarOrdem}
                  />
                  <SortHeader
                    label="Valor médio da hora"
                    column="valor_hora_previsto"
                    active={sortKey === 'valor_hora_previsto'}
                    dir={sortDir}
                    align="right"
                    onSort={alternarOrdem}
                  />
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, index) => (
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
