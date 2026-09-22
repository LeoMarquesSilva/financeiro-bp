import { formatPercent } from '@/shared/utils/format'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMinutosHeatLabel } from '../utils/desenvolvimentoEquipeHeatCell'

export type UnificadoLinhaPonto = {
  label: string
  valor: number | null
  rotulo?: string
}

export type UnificadoLinhaSerie = {
  id: string
  title: string
  meta: number
  metaLabel: string
  yKind: 'pct' | 'horas' | 'numero'
  /** Menor é melhor: 0 fica no topo e a linha sobe quando o índice cai. */
  yInvertido?: boolean
  points: UnificadoLinhaPonto[]
}

/** Visual alinhado ao slide de metas (fundo creme, linha marinho, meta ouro). */
export const UNIFICADO_LINHAS_THEME = {
  bg: 'transparent',
  line: '#1B3A6B',
  meta: '#E6C200',
  title: '#2B2B2B',
  axis: '#6B6B6B',
  grid: 'rgba(80,70,55,0.12)',
  label: '#4A4A4A',
} as const

function formatY(kind: UnificadoLinhaSerie['yKind'], v: number): string {
  if (kind === 'horas') return formatMinutosHeatLabel(v)
  if (kind === 'numero') return String(Math.round(v))
  return formatPercent(v)
}

function yDomain(
  kind: UnificadoLinhaSerie['yKind'],
  valores: number[],
  meta: number,
): [number, number] {
  if (kind === 'horas' || kind === 'numero') {
    const maxVal = valores.length > 0 ? Math.max(...valores, meta) : meta
    return [0, Math.max(maxVal * 1.2, meta * 1.08, kind === 'numero' ? 8 : 60)]
  }
  const nums = [...valores, meta].filter((n) => Number.isFinite(n))
  if (nums.length === 0) return [0, 120]
  const minV = Math.min(...nums)
  const maxV = Math.max(...nums)
  const span = Math.max(6, maxV - minV)
  const pad = span * 0.35
  const lo = Math.max(0, Math.floor((minV - pad) / 2) * 2)
  const hi = Math.ceil((maxV + pad) / 2) * 2
  return [lo, Math.max(hi, lo + 8)]
}

function UnificadoMiniLinha({ serie }: { serie: UnificadoLinhaSerie }) {
  const data = serie.points.map((p) => ({
    mes: p.label,
    valor: p.valor,
    rotulo: p.rotulo,
  }))
  const valores = data.map((d) => d.valor).filter((v): v is number => v != null)
  const [yMin, yMax] = yDomain(serie.yKind, valores, serie.meta)

  return (
    <div
      data-unificado-linha-card
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        padding: '2px 4px 0',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        data-unificado-linha-title
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: UNIFICADO_LINHAS_THEME.title,
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          letterSpacing: '-0.01em',
        }}
      >
        {serie.title} · {serie.metaLabel}
      </div>
      <div data-unificado-linha-plot style={{ flex: 1, minHeight: 0, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 10, left: 0, bottom: 4 }}>
            <CartesianGrid
              vertical={false}
              stroke={UNIFICADO_LINHAS_THEME.grid}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 8, fill: UNIFICADO_LINHAS_THEME.axis }}
              axisLine={false}
              tickLine={false}
              interval={data.length > 10 ? 1 : 0}
              height={28}
            />
            <YAxis
              domain={[yMin, yMax]}
              reversed={serie.yInvertido === true}
              tickFormatter={(v: number) => formatY(serie.yKind, Number(v))}
              tick={{ fontSize: 8, fill: UNIFICADO_LINHAS_THEME.axis }}
              axisLine={false}
              tickLine={false}
              width={serie.yKind === 'horas' ? 44 : 42}
            />
            {Number.isFinite(serie.meta) && serie.meta > 0 ? (
              <ReferenceLine
                y={serie.meta}
                stroke={UNIFICADO_LINHAS_THEME.meta}
                strokeDasharray="5 4"
                strokeWidth={1.6}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="valor"
              stroke={UNIFICADO_LINHAS_THEME.line}
              strokeWidth={2}
              connectNulls={false}
              dot={{ r: 3.2, fill: UNIFICADO_LINHAS_THEME.line, strokeWidth: 0 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="valor"
                content={(props) => {
                  const { x, y, index } = props
                  if (typeof x !== 'number' || typeof y !== 'number' || typeof index !== 'number') {
                    return null
                  }
                  const ponto = data[index]
                  if (ponto?.valor == null) return null
                  const text =
                    ponto.rotulo ?? formatY(serie.yKind, ponto.valor)
                  return (
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      fill={UNIFICADO_LINHAS_THEME.label}
                      fontSize={8}
                      fontWeight={500}
                    >
                      {text}
                    </text>
                  )
                }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      {serie.yInvertido ? (
        <div
          style={{
            fontSize: 8,
            lineHeight: 1.2,
            color: UNIFICADO_LINHAS_THEME.axis,
            padding: '1px 2px 0',
            letterSpacing: '0.01em',
          }}
        >
          * escala invertida, quanto menor melhor
        </div>
      ) : null}
    </div>
  )
}

function UnificadoLinhasLegenda() {
  return (
    <div
      data-unificado-linha-legenda
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        gap: 16,
        padding: '0 8px 18px',
        height: '100%',
        boxSizing: 'border-box',
        fontSize: 12,
        fontWeight: 500,
        color: UNIFICADO_LINHAS_THEME.title,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 22,
            height: 2,
            background: UNIFICADO_LINHAS_THEME.line,
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 8,
              top: -3,
              width: 8,
              height: 8,
              borderRadius: 99,
              background: UNIFICADO_LINHAS_THEME.line,
            }}
          />
        </span>
        Resultado
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 22,
            height: 0,
            borderTop: `2px dashed ${UNIFICADO_LINHAS_THEME.meta}`,
          }}
        />
        Meta
      </span>
    </div>
  )
}

export function ApresentacaoUnificadoLinhasGrid({
  series,
}: {
  series: UnificadoLinhaSerie[]
}) {
  return (
    <div
      data-apresentacao-linhas-grid
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
        gap: 14,
        width: '100%',
        height: '100%',
        minHeight: 640,
        boxSizing: 'border-box',
        background: UNIFICADO_LINHAS_THEME.bg,
        padding: 8,
        alignContent: 'stretch',
      }}
    >
      {series.map((serie) => (
        <UnificadoMiniLinha key={serie.id} serie={serie} />
      ))}
      <UnificadoLinhasLegenda />
    </div>
  )
}
