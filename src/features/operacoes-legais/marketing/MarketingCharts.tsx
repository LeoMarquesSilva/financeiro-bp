import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const compact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

const COR_OK = '#0f766e'
const COR_ABAIXO = '#DC2626'
const COR_VAZIO = '#cbd5e1'
const COR_META = '#d97706'

const monthLabel = (value: string) => {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

export function MarketingPerformanceTrendChart({
  data,
  reachGoal,
}: {
  data: Array<{ label: string; reach: number; engagementRate: number; posts: number }>
  reachGoal?: number
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={24} />
          <YAxis yAxisId="reach" tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <Tooltip
            formatter={(value, name) => {
              const numeric = Number(value ?? 0)
              return [String(name).includes('Engajamento') ? `${numeric.toFixed(2)}%` : numeric.toLocaleString('pt-BR'), String(name)]
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {reachGoal != null && (
            <ReferenceLine
              yAxisId="reach"
              y={reachGoal}
              stroke="#d97706"
              strokeDasharray="5 4"
              label={{ value: 'Meta', position: 'insideTopRight', fill: '#b45309', fontSize: 10 }}
            />
          )}
          <Bar yAxisId="reach" dataKey="reach" name="Alcance" fill="#0f766e" radius={[5, 5, 0, 0]} maxBarSize={42} />
          <Line yAxisId="rate" type="monotone" dataKey="engagementRate" name="Engajamento" stroke="#0f172a" strokeWidth={2.2} dot={{ r: 2.5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MarketingTrendChart({
  data,
}: {
  data: Array<{ month: string; reach: number; views: number; interactions: number }>
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="marketingReach" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            labelFormatter={(label) => monthLabel(String(label))}
            formatter={(value, name) => [Number(value ?? 0).toLocaleString('pt-BR'), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="reach" name="Alcance" stroke="#0f766e" fill="url(#marketingReach)" strokeWidth={2.4} />
          <Line type="monotone" dataKey="views" name="Visualizações" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="interactions" name="Interações" stroke="#d97706" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MarketingFormatChart({
  data,
}: {
  data: Array<{ format: string; posts: number; engagementRate: number }>
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="format" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis yAxisId="posts" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
          <YAxis yAxisId="rate" orientation="right" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip formatter={(value, name) => {
            const numeric = Number(value ?? 0)
            const label = String(name)
            return [label.includes('Taxa') ? `${numeric.toFixed(2)}%` : numeric, label]
          }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="posts" dataKey="posts" name="Publicações" fill="#0f766e" radius={[5, 5, 0, 0]} />
          <Line yAxisId="rate" type="monotone" dataKey="engagementRate" name="Taxa de engajamento" stroke="#d97706" strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MarketingAccountChart({
  data,
}: {
  data: Array<{ date: string; reach: number; views: number; total_interactions: number }>
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5).split('-').reverse().join('/')} tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={24} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip labelFormatter={(value) => new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR')} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="reach" name="Alcance diário" stroke="#0f766e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="views" name="Visualizações" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="total_interactions" name="Interações" stroke="#d97706" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

type IndicadorSeriesChartProps = {
  data: Array<Record<string, string | number>>
  valueKey: string
  metaKey: string
  valueName: string
  metaName: string
  formatValue?: (n: number) => string
  /** true = eixo Y em % */
  percent?: boolean
}

function barColorForMeta(value: number, meta: number): string {
  if (!Number.isFinite(value) || value <= 0) return COR_VAZIO
  if (value < meta) return COR_ABAIXO
  return COR_OK
}

export function MarketingIndicadorSeriesChart({
  data,
  valueKey,
  metaKey,
  valueName,
  metaName,
  formatValue,
  percent = false,
}: IndicadorSeriesChartProps) {
  const fmt =
    formatValue ??
    ((n: number) =>
      percent
        ? `${n.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}%`
        : compact(n))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <YAxis
            tickFormatter={(v) => fmt(Number(v))}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <Tooltip
            labelFormatter={(label) => monthLabel(String(label))}
            formatter={(value, name) => [fmt(Number(value ?? 0)), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey={valueKey}
            name={valueName}
            radius={[5, 5, 0, 0]}
            maxBarSize={40}
          >
            {data.map((row, index) => (
              <Cell
                key={`${String(row.month)}-${index}`}
                fill={barColorForMeta(Number(row[valueKey]), Number(row[metaKey]))}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey={metaKey}
            name={metaName}
            stroke={COR_META}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
