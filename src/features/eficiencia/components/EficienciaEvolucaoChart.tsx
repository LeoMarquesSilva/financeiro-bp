import { useMemo, useRef, type ReactNode } from 'react'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LineChart as LineChartIcon, Trophy } from 'lucide-react'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'
import { formatPercent } from '@/shared/utils/format'
import { toPriMaiuscula } from '../utils/textFormat'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'

const MESES_LABEL = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const AXIS_TICK_Y = { fontSize: 11, fill: '#94a3b8' }
/** Meses no eixo X — maiores e em negrito. */
const AXIS_TICK_X = { fontSize: 13, fill: '#334155', fontWeight: 700 }

/** Cor padrão das linhas de evolução (igual SLA Protocolo). */
const LINE_COLOR = '#7c3aed'
const LABEL_OK = '#059669'
const LABEL_NOK = '#dc2626'
const LABEL_NEUTRO = '#334155'
const META_LABEL = '#b45309'

export type EvolucaoGranularidade = 'mes' | 'dia'

export type EvolucaoPoint = {
  mes: number
  valor: number | null
  meta?: number | null
  /** Rótulo do eixo X (ex.: filtro semana). Default = mês abreviado. */
  label?: string
}

type Props = {
  title: string
  subtitle?: string
  data: EvolucaoPoint[]
  /** @deprecated Ignorado — todas as séries usam roxo padrão. */
  color?: string
  metaFixa?: number | null
  /** Se true, valor ≤ meta é verde (ex.: inadimplência). Default: ≥ meta = verde. */
  metaAbaixoMelhor?: boolean
  /** Abre o sheet de Racional (mesma base do Overview). */
  onRacionalClick?: () => void
  granularidade?: EvolucaoGranularidade
  /** Destaca o ponto selecionado (ex.: mês clicado antes do drill-down). */
  selectedIndex?: number | null
  onPointClick?: (index: number, point: EvolucaoPoint) => void
  toolbarExtra?: ReactNode
}

function EvolucaoTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; name?: string; color?: string }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-slate-800">{label}</p>
      <ul className="space-y-1">
        {payload
          .filter((e) => typeof e.value === 'number')
          .map((entry, i) => (
            <li key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {formatPercent(entry.value ?? 0)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

function EvolucaoPointLabel(props: {
  x?: number | string
  y?: number | string
  value?: number | string | null
  index?: number
  total?: number
  meta?: number | null
  metaAbaixoMelhor?: boolean
}) {
  const { x, y, value, index, total, meta, metaAbaixoMelhor } = props
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return null

  const cx = Number(x ?? 0)
  const cy = Number(y ?? 0)
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null

  // Inverte para baixo se o ponto estiver alto demais (evita corte no topo)
  const above = cy >= 22
  const labelY = above ? cy - 12 : cy + 16
  const anchor =
    index == null || total == null || total <= 1
      ? 'middle'
      : index <= 0
        ? 'start'
        : index >= total - 1
          ? 'end'
          : 'middle'

  let fill = LABEL_NEUTRO
  if (meta != null && Number.isFinite(meta)) {
    const ok = metaAbaixoMelhor ? num <= meta : num >= meta
    fill = ok ? LABEL_OK : LABEL_NOK
  }

  return (
    <text
      x={cx}
      y={labelY}
      textAnchor={anchor}
      dominantBaseline={above ? 'auto' : 'hanging'}
      fill={fill}
      fontSize={11}
      fontWeight={600}
      className="tabular-nums"
    >
      {formatPercent(num)}
    </text>
  )
}

function resolveMelhorPonto(
  data: EvolucaoPoint[],
  granularidade: EvolucaoGranularidade,
): { label: string; valor: number } | null {
  const validos = data
    .map((d, index) => ({ d, index, valor: d.valor == null ? NaN : Number(d.valor) }))
    .filter((x) => Number.isFinite(x.valor))
  if (validos.length < 2) return null

  let best = validos[0]!
  for (const cur of validos.slice(1)) {
    if (cur.valor > best.valor || (cur.valor === best.valor && cur.index > best.index)) {
      best = cur
    }
  }
  return {
    label: best.d.label ?? MESES_LABEL[best.d.mes - 1] ?? String(best.d.mes),
    valor: best.valor,
  }
}

export function EficienciaEvolucaoChart({
  title,
  subtitle,
  data,
  metaFixa = null,
  metaAbaixoMelhor = false,
  onRacionalClick,
  granularidade = 'mes',
  selectedIndex = null,
  onPointClick,
  toolbarExtra,
}: Props) {
  const chartExportRef = useRef<HTMLDivElement>(null)
  const pointCount = data.length
  const melhor = useMemo(
    () => resolveMelhorPonto(data, granularidade),
    [data, granularidade],
  )
  const melhorRotulo = granularidade === 'dia' ? 'Melhor dia' : 'Melhor mês'
  const axisTickX =
    granularidade === 'dia'
      ? { fontSize: 10, fill: '#64748b', fontWeight: 600 }
      : AXIS_TICK_X

  const metaLinha =
    metaFixa ??
    data.map((d) => d.meta).find((m) => m != null && Number.isFinite(Number(m))) ??
    null
  const metaNum = metaLinha == null ? null : Number(metaLinha)

  const chartData = data.map((d, index) => ({
    mesLabel: d.label ?? MESES_LABEL[d.mes - 1] ?? String(d.mes),
    valor: d.valor,
    meta: metaNum ?? d.meta ?? undefined,
    _index: index,
  }))

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <LineChartIcon className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {toPriMaiuscula(title)}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500">{toPriMaiuscula(subtitle)}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarExtra}
          {onRacionalClick && <OverviewRacionalButton onClick={onRacionalClick} className="w-auto" />}
          <ChartCopyButton containerRef={chartExportRef} />
        </div>
      </div>

      {/* ref no wrapper; data-chart-plot no filho — copyChartImage usa querySelector nos descendentes */}
      <div ref={chartExportRef} className="w-full">
        {(melhor || (metaNum != null && Number.isFinite(metaNum))) && (
          <div className="mb-2 flex flex-col items-end gap-1">
            {melhor ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                <Trophy className="h-3 w-3 shrink-0" aria-hidden />
                {melhorRotulo}: {melhor.label} · {formatPercent(melhor.valor)}
              </span>
            ) : null}
            {metaNum != null && Number.isFinite(metaNum) ? (
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: META_LABEL }}
              >
                Meta {formatPercent(metaNum)}
              </span>
            ) : null}
          </div>
        )}
        <div data-chart-plot className="h-[300px] w-full">
          {chartData.length === 0 ? (
            <div className="flex h-full min-h-[300px] items-center justify-center px-6 text-center text-sm text-slate-400">
              Sem dados no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <LineChart
              key={chartData.map((d) => `${d.mesLabel}:${d.valor}`).join('|')}
              data={chartData}
              margin={{ left: 4, right: 20, top: 28, bottom: 8 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.35)" />
              <XAxis
                dataKey="mesLabel"
                tick={axisTickX}
                axisLine={false}
                tickLine={false}
                interval={granularidade === 'dia' ? 1 : 'preserveStartEnd'}
                minTickGap={granularidade === 'dia' ? 4 : undefined}
              />
              <YAxis
                tickFormatter={(v: number) => formatPercent(v)}
                tick={AXIS_TICK_Y}
                ticks={[0, 25, 50, 75, 100]}
                axisLine={false}
                tickLine={false}
                width={52}
                domain={[0, 100]}
              />
              <Tooltip content={<EvolucaoTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
              {metaNum != null && Number.isFinite(metaNum) && (
                <ReferenceLine y={metaNum} stroke="#f59e0b" strokeDasharray="6 4" />
              )}
              <Line
                type="monotone"
                dataKey="valor"
                name={toPriMaiuscula(title)}
                stroke={LINE_COLOR}
                strokeWidth={2.5}
                connectNulls={false}
                dot={(props) => {
                  const idx = props.index ?? 0
                  const selected = selectedIndex === idx
                  const clickable = Boolean(onPointClick)
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={selected ? 6 : 4}
                      fill={LINE_COLOR}
                      stroke={selected ? '#fff' : 'none'}
                      strokeWidth={selected ? 2 : 0}
                      style={clickable ? { cursor: 'pointer' } : undefined}
                      onClick={
                        clickable
                          ? (event) => {
                              event.stopPropagation()
                              const point = data[idx]
                              if (point) onPointClick?.(idx, point)
                            }
                          : undefined
                      }
                    />
                  )
                }}
                activeDot={{ r: 6, fill: LINE_COLOR, stroke: '#fff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="valor"
                  content={(props) => {
                    const idx = typeof props.index === 'number' ? props.index : undefined
                    const pointMeta =
                      idx != null &&
                      chartData[idx]?.meta != null &&
                      Number.isFinite(Number(chartData[idx]!.meta))
                        ? Number(chartData[idx]!.meta)
                        : metaNum
                    return (
                      <EvolucaoPointLabel
                        x={props.x}
                        y={props.y}
                        value={
                          props.value == null || typeof props.value === 'boolean'
                            ? null
                            : (props.value as number | string)
                        }
                        index={idx}
                        total={pointCount}
                        meta={pointMeta}
                        metaAbaixoMelhor={metaAbaixoMelhor}
                      />
                    )
                  }}
                />
              </Line>
            </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  )
}
