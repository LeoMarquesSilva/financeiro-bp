import { useMemo, useRef } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { ChartCopyButton } from '@/shared/components/ChartCopyButton'
import { formatPercent } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'

export type RankingChartRow = Record<string, unknown>

type Props = {
  title: string
  subtitle?: string
  rows: RankingChartRow[]
  labelKey?: string
  valueKey: string
  valueLabel?: string
  formatValue?: (value: number) => string
  /** Exibe % do total no tooltip. `null` desliga; omitido usa `pct_do_total`. */
  pctKey?: string | null
  color?: string
  loading?: boolean
  emptyLabel?: string
  /** Limita barras exibidas (ranking já vem ordenado). */
  maxItems?: number
  /** Se false, exibe o nome completo no eixo (sem truncar). Default: true. */
  truncateLabels?: boolean
  /** Largura do eixo Y; se omitido, calcula pelo maior rótulo. */
  yAxisWidth?: number
  /** Título centralizado, sem ícone — visual próximo do BI. */
  biStyle?: boolean
  /** Compacta padding, barras e altura (default: true quando biStyle). */
  compact?: boolean
  /** Abre o sheet de Racional (mesma base do Overview). */
  onRacionalClick?: () => void
  /** Miniatura do responsável (catálogo ticket-bp / team_members). */
  showAvatars?: boolean
  className?: string
}

function AvatarYTick({
  x,
  y,
  payload,
  avatarByLabel,
  compact,
}: {
  x?: number | string
  y?: number | string
  payload?: { value?: string | number }
  avatarByLabel: Map<string, string | null>
  compact?: boolean
}) {
  const label = String(payload?.value ?? '')
  const url = avatarByLabel.get(label) ?? null
  const size = compact ? 14 : 16
  const tx = Number(x ?? 0)
  const ty = Number(y ?? 0)
  return (
    <g transform={`translate(${Number.isFinite(tx) ? tx : 0},${Number.isFinite(ty) ? ty : 0})`}>
      <text
        x={url ? -(size + 8) : -4}
        y={0}
        dy="0.35em"
        textAnchor="end"
        fill="#1e293b"
        fontSize={compact ? 10 : 11}
        fontWeight={600}
      >
        {label}
      </text>
      {url ? (
        <image
          href={url}
          x={-(size + 2)}
          y={-size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid slice"
          style={{ clipPath: 'circle(50%)' }}
        />
      ) : null}
    </g>
  )
}

function shortLabel(name: string, max = 22): string {
  const t = name.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function estimateYAxisWidth(labels: string[], truncate: boolean, compact: boolean): number {
  if (truncate) return compact ? 110 : 132
  const maxLen = labels.reduce((m, l) => Math.max(m, l.length), 0)
  const px = compact ? 5.9 : 6.6
  const cap = compact ? 185 : 240
  const floor = compact ? 120 : 140
  return Math.min(cap, Math.max(floor, Math.ceil(maxLen * px) + 6))
}

function RankingTooltip({
  active,
  payload,
  valueLabel,
  formatValue,
  pctKey,
}: {
  active?: boolean
  payload?: Array<{ payload?: RankingChartRow; value?: number; color?: string }>
  valueLabel: string
  formatValue: (v: number) => string
  pctKey?: string | null
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  const nome = String(row._labelFull ?? '')
  const value = Number(payload[0]?.value ?? 0)
  const pct = pctKey ? Number(row[pctKey]) : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-slate-800">{nome}</p>
      <ul className="space-y-1">
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: payload[0]?.color }}
            />
            {valueLabel}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{formatValue(value)}</span>
        </li>
        {pct != null && !Number.isNaN(pct) && (
          <li className="flex items-center justify-between gap-4 text-slate-600">
            <span>% do total</span>
            <span className="font-semibold tabular-nums text-slate-900">{formatPercent(pct)}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

function BarValueLabel(props: {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string | null
  formatValue: (v: number) => string
  compact?: boolean
}) {
  const { x = 0, y = 0, width = 0, height = 0, value, formatValue, compact } = props
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num) || num <= 0) return null
  const nx = Number(x)
  const ny = Number(y)
  const nw = Number(width)
  const nh = Number(height)
  return (
    <text
      x={nx + nw + (compact ? 4 : 6)}
      y={ny + nh / 2}
      fill="#334155"
      fontSize={compact ? 10 : 11}
      fontWeight={600}
      dominantBaseline="middle"
      className="tabular-nums"
    >
      {formatValue(num)}
    </text>
  )
}

export function EficienciaRankingChart({
  title,
  subtitle,
  rows,
  labelKey = 'usuario',
  valueKey,
  valueLabel = 'Valor',
  formatValue = (v) => String(v),
  pctKey = 'pct_do_total',
  color = '#7c3aed',
  loading,
  emptyLabel = 'Sem dados no período.',
  maxItems = 20,
  truncateLabels = true,
  yAxisWidth,
  biStyle = false,
  compact: compactProp,
  onRacionalClick,
  showAvatars = false,
  className,
}: Props) {
  const compact = compactProp ?? biStyle
  const chartExportRef = useRef<HTMLDivElement>(null)
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  // Compact ≈ +10% em relação à versão bem reduzida (17px / fonte 9)
  const rowH = compact ? 19 : 28
  const axisTick = { fontSize: compact ? 10 : 11, fill: '#64748b' }

  const chartData = useMemo(() => {
    return rows.slice(0, maxItems).map((row, i) => {
      const full = String(row[labelKey] ?? '').trim()
      const raw = row[valueKey]
      const value = typeof raw === 'number' ? raw : Number(raw)
      const avatarUrl = showAvatars
        ? resolvePessoaAvatarUrl(full, teamMembers, avatarCatalog)
        : null
      return {
        ...row,
        _rank: i + 1,
        _label: truncateLabels ? shortLabel(full, compact ? 28 : 22) : full,
        _labelFull: full,
        _value: Number.isFinite(value) ? value : 0,
        _avatarUrl: avatarUrl,
      }
    })
  }, [
    rows,
    labelKey,
    valueKey,
    maxItems,
    truncateLabels,
    compact,
    showAvatars,
    teamMembers,
    avatarCatalog,
  ])

  const avatarByLabel = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const d of chartData) map.set(d._label, d._avatarUrl ?? null)
    return map
  }, [chartData])

  const resolvedYWidth =
    (yAxisWidth ??
      estimateYAxisWidth(
        chartData.map((d) => d._label),
        truncateLabels,
        compact,
      )) + (showAvatars ? 20 : 0)
  const chartHeight = Math.max(
    compact ? 110 : 160,
    chartData.length * rowH + (compact ? 16 : 36),
  )
  const truncated = rows.length > maxItems

  return (
    <section
      className={cn(
        'relative rounded-xl border border-slate-200/60 bg-white shadow-sm',
        compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-1.5',
          compact ? 'mb-1.5' : 'mb-2',
        )}
      >
        {biStyle ? (
          <div className="min-w-0 flex-1 pr-2 text-left leading-tight">
            <h2
              className={cn(
                'font-semibold text-slate-800',
                compact ? 'text-[13px]' : 'text-sm',
              )}
            >
              {title}
            </h2>
            {(subtitle || truncated) && (
              <p className={cn('text-slate-500', compact ? 'text-[10px]' : 'text-[11px]')}>
                {subtitle}
                {truncated && (
                  <span className="text-slate-400">
                    {subtitle ? ' · ' : ''}
                    Top {maxItems} de {rows.length}
                  </span>
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 leading-tight">
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              <p className="text-[11px] text-slate-500">
                {subtitle}
                {truncated && (
                  <span className="text-slate-400">
                    {subtitle ? ' · ' : ''}
                    Top {maxItems} de {rows.length}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {onRacionalClick && (
            <OverviewRacionalButton
              onClick={onRacionalClick}
              className={cn(
                'w-auto',
                compact && 'h-7 gap-1 px-2 py-1 text-[11px]',
              )}
            />
          )}
          <ChartCopyButton
            containerRef={chartExportRef}
            className={compact ? 'h-7 px-2 text-[11px]' : undefined}
          />
        </div>
      </div>

      {loading ? (
        <div className={cn('animate-pulse rounded-lg bg-slate-100', compact ? 'h-28' : 'h-40')} />
      ) : chartData.length === 0 ? (
        <p className={cn('text-center text-slate-400', compact ? 'py-4 text-xs' : 'py-6 text-sm')}>
          {emptyLabel}
        </p>
      ) : (
        /* ref no wrapper; data-chart-plot no filho — copyChartImage usa querySelector nos descendentes */
        <div ref={chartExportRef} className="w-full">
          <div data-chart-plot className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              minHeight={compact ? 110 : 160}
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  left: 2,
                  right: compact ? 40 : 52,
                  top: 2,
                  bottom: 2,
                }}
                barCategoryGap={compact ? '14%' : '22%'}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.28)"
                />
                <XAxis
                  type="number"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  hide={biStyle}
                />
                <YAxis
                  type="category"
                  dataKey="_label"
                  width={resolvedYWidth}
                  tick={
                    showAvatars
                      ? (props) => (
                          <AvatarYTick
                            x={props.x}
                            y={props.y}
                            payload={props.payload as { value?: string | number }}
                            avatarByLabel={avatarByLabel}
                            compact={compact}
                          />
                        )
                      : {
                          fontSize: compact ? 10 : 11,
                          fill: biStyle ? '#1e293b' : '#64748b',
                          fontWeight: biStyle ? 600 : 400,
                        }
                  }
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  content={
                    <RankingTooltip
                      valueLabel={valueLabel}
                      formatValue={formatValue}
                      pctKey={pctKey}
                    />
                  }
                />
                <Bar
                  dataKey="_value"
                  name={valueLabel}
                  fill={color}
                  radius={[0, 2, 2, 0]}
                  maxBarSize={compact ? 9 : biStyle ? 12 : 14}
                >
                  <LabelList
                    dataKey="_value"
                    content={(props) => (
                      <BarValueLabel
                        x={props.x}
                        y={props.y}
                        width={props.width}
                        height={props.height}
                        value={
                          props.value == null || typeof props.value === 'boolean'
                            ? null
                            : (props.value as number | string)
                        }
                        formatValue={formatValue}
                        compact={compact}
                      />
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}
