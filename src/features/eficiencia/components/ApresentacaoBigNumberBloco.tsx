import {
  Banknote,
  Clock3,
  FileText,
  FolderOpen,
  ListChecks,
  Scale,
  Users,
} from 'lucide-react'
import { MESES_ABREV, MESES_NOME } from '@/features/receita/constants'
import { formatCurrency } from '@/shared/utils/format'
import {
  deltaPct,
  formatCount,
  formatDeltaAbs,
  formatDeltaPctLabel,
  formatHorasBigNumberKpi,
  formatHorasBigNumberTop,
  labelPeriodoBigNumber,
  type ApresentacaoBigNumberData,
  type BigNumberPar,
  type BigNumberTopPar,
} from '../utils/apresentacaoBigNumber'

const GOLD_DARK = '#C6A361'
const HEADER_BG = '#333f48'

type Props = {
  data: ApresentacaoBigNumberData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mesInicio: number
  mesFim: number
  onMesInicioChange: (mes: number) => void
  onMesFimChange: (mes: number) => void
  /** Top 5 contratos do escritório (só nomes). */
  topContratos?: string[]
}

type KpiDef = {
  key: keyof ApresentacaoBigNumberData['kpis']
  label: string
  icon: typeof Clock3
  /** `pct_yoy` = só variação % ano vs ano (sem R$). */
  kind: 'horas' | 'count' | 'moeda' | 'pct_yoy'
  accentAtual?: string
}

const KPI_DEFS: KpiDef[] = [
  { key: 'timesheet', label: 'Total Timesheet', icon: Clock3, kind: 'horas' },
  { key: 'pastas_ativas', label: 'Pastas Ativas', icon: FolderOpen, kind: 'count' },
  { key: 'publicacoes', label: 'Publicações', icon: FileText, kind: 'count' },
  { key: 'protocolos', label: 'Protocolos', icon: Users, kind: 'count' },
  { key: 'providencias', label: 'Providências', icon: ListChecks, kind: 'count' },
  {
    key: 'receita_bruta',
    label: 'Receita Bruta',
    icon: Banknote,
    kind: 'pct_yoy',
    accentAtual: '#16A34A',
  },
]

type TopDef = {
  key: keyof ApresentacaoBigNumberData['top5']
  title: string
  valorLabel: string
  icon: typeof Clock3
  formatValor: (v: number) => string
}

const TOP_DEFS: TopDef[] = [
  {
    key: 'timesheet',
    title: 'TOP 5 Clientes com mais Timesheet',
    valorLabel: 'Tempo',
    icon: Users,
    formatValor: formatHorasBigNumberTop,
  },
  {
    key: 'publicacoes',
    title: 'TOP 5 Clientes com mais Publicações',
    valorLabel: 'Publicações',
    icon: FileText,
    formatValor: formatCount,
  },
  {
    key: 'protocolos',
    title: 'TOP 5 Clientes com mais Protocolos',
    valorLabel: 'Protocolos',
    icon: Scale,
    formatValor: formatCount,
  },
  {
    key: 'providencias',
    title: 'TOP 5 Clientes com mais Providências',
    valorLabel: 'Providências',
    icon: ListChecks,
    formatValor: formatCount,
  },
]

function formatValorKpi(kind: Exclude<KpiDef['kind'], 'pct_yoy'>, v: number): string {
  if (kind === 'horas') return formatHorasBigNumberKpi(v)
  if (kind === 'moeda') return formatCurrency(v)
  return formatCount(v)
}

function KpiCard({
  def,
  par,
  ano,
  anoAnterior,
}: {
  def: KpiDef
  par: BigNumberPar
  ano: number
  anoAnterior: number
}) {
  const Icon = def.icon
  const pct = deltaPct(par.atual, par.anterior)
  const up = pct != null && pct > 0
  const down = pct != null && pct < 0
  const trendColor = up ? '#16A34A' : down ? '#DC2626' : '#64748B'
  const deltaLabel = formatDeltaPctLabel(par.atual, par.anterior)
  const kind = def.kind

  const header = (
    <div
      data-bn-title-row
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
        width: '100%',
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: '#F5F0E6',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: GOLD_DARK,
          flexShrink: 0,
        }}
      >
        <Icon size={14} aria-hidden />
      </span>
      <span
        data-bn-title
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#64748B',
          whiteSpace: 'nowrap',
          width: 'auto',
          maxWidth: 'none',
          flexShrink: 0,
        }}
      >
        {def.label}
      </span>
    </div>
  )

  const cardStyle = {
    borderRadius: 10,
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
    padding: '10px 12px',
    minWidth: 0,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  }

  if (kind === 'pct_yoy') {
    return (
      <div
        data-overview-copy-card
        data-chart-export-preserve-bg
        style={cardStyle}
      >
        {header}
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: trendColor,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.15,
          }}
        >
          {up ? '↑ ' : down ? '↓ ' : ''}
          {deltaLabel}
        </div>
        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 6 }}>
          {ano} vs {anoAnterior}
        </div>
      </div>
    )
  }

  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={cardStyle}
    >
      {header}
      <div
        style={{
          fontSize: kind === 'moeda' ? 13 : 16,
          fontWeight: 800,
          color: def.accentAtual ?? '#0F172A',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
        }}
      >
        {formatValorKpi(kind, par.atual)}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 10,
          color: '#64748B',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {anoAnterior}: {formatValorKpi(kind, par.anterior)}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          fontWeight: 700,
          color: trendColor,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {up ? '↑ ' : down ? '↓ ' : ''}
        {deltaLabel}{' '}
        <span style={{ fontWeight: 500, color: '#64748B' }}>
          ({formatDeltaAbs(kind, par.atual, par.anterior)})
        </span>
      </div>
      <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
        {ano} vs {anoAnterior}
      </div>
    </div>
  )
}

function TopTable({
  ano,
  valorLabel,
  rows,
  formatValor,
}: {
  ano: number
  valorLabel: string
  rows: { grupo: string; valor: number }[]
  formatValor: (v: number) => string
}) {
  const filled = [...rows]
  while (filled.length < 5) {
    filled.push({ grupo: '—', valor: NaN })
  }

  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#334155',
          marginBottom: 4,
        }}
      >
        {ano}
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 10,
          border: '1px solid #CBD5E1',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ background: GOLD_DARK, color: '#fff' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '5px 8px',
                fontWeight: 700,
              }}
            >
              Grupo
            </th>
            <th
              style={{
                textAlign: 'right',
                padding: '5px 8px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {valorLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {filled.map((row, i) => (
            <tr
              key={`${ano}-${i}`}
              style={{ background: i % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}
            >
              <td
                style={{
                  padding: '4px 8px',
                  color: '#334155',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 160,
                }}
              >
                {row.grupo}
              </td>
              <td
                style={{
                  padding: '4px 8px',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: '#0F172A',
                  whiteSpace: 'nowrap',
                }}
              >
                {Number.isFinite(row.valor) ? formatValor(row.valor) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TopBlock({
  def,
  par,
  ano,
  anoAnterior,
}: {
  def: TopDef
  par: BigNumberTopPar
  ano: number
  anoAnterior: number
}) {
  const Icon = def.icon
  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        padding: '12px 12px 14px',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div
        data-bn-title-row
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          width: '100%',
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: HEADER_BG,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={14} aria-hidden />
        </span>
        <span
          data-bn-title
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: '#0F172A',
            whiteSpace: 'nowrap',
            width: 'auto',
            maxWidth: 'none',
            flexShrink: 0,
          }}
        >
          {def.title}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <TopTable
          ano={anoAnterior}
          valorLabel={def.valorLabel}
          rows={par.anterior}
          formatValor={def.formatValor}
        />
        <TopTable
          ano={ano}
          valorLabel={def.valorLabel}
          rows={par.atual}
          formatValor={def.formatValor}
        />
      </div>
    </div>
  )
}

function MesSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (mes: number) => void
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{ fontWeight: 600, color: '#64748B' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          height: 28,
          borderRadius: 6,
          border: '1px solid #CBD5E1',
          background: '#fff',
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 600,
          color: '#0F172A',
        }}
      >
        {MESES_NOME.map((nome, i) => (
          <option key={nome} value={i + 1}>
            {MESES_ABREV[i]} — {nome}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ApresentacaoBigNumberBloco({
  data,
  loading,
  error,
  ano,
  mesInicio,
  mesFim,
  onMesInicioChange,
  onMesFimChange,
  topContratos = [],
}: Props) {
  const periodoPreview = labelPeriodoBigNumber(
    [
      ...Array.from(
        { length: Math.abs(mesFim - mesInicio) + 1 },
        (_, i) => Math.min(mesInicio, mesFim) + i,
      ),
    ],
    ano,
    ano - 1,
  )

  const nomesContratos =
    topContratos.length > 0
      ? topContratos.slice(0, 5)
      : Array.from({ length: 5 }, () => '—')

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      {/* Controles — fora do export PPT */}
      <div
        data-chart-export-ignore
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
          Período Big Numbers (YoY)
        </span>
        <MesSelect label="De" value={mesInicio} onChange={onMesInicioChange} />
        <MesSelect label="Até" value={mesFim} onChange={onMesFimChange} />
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD_DARK }}>
          {periodoPreview}
        </span>
      </div>

      <div
        data-apresentacao-export="bignumber"
        data-apresentacao-fill-slide
        data-apresentacao-fill-preserve
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
      <div
        data-bn-periodo
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 10,
          padding: '4px 2px 6px',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD_DARK }}>
          {data?.periodoLabel ?? periodoPreview}
        </span>
      </div>

      {error && !data ? (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid #FECACA',
            background: '#FEF2F2',
            padding: '12px 14px',
            fontSize: 12,
            color: '#B91C1C',
          }}
        >
          Não foi possível carregar o Big Numbers
          {error.message ? `: ${error.message}` : '.'}
        </div>
      ) : loading || !data ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>Carregando Big Numbers…</div>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              style={{ height: 40, borderRadius: 8, background: 'rgba(0,0,0,0.06)' }}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            data-bn-kpis
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 8,
              width: '100%',
            }}
          >
            {KPI_DEFS.map((def) => (
              <KpiCard
                key={def.key}
                def={def}
                par={data.kpis[def.key]}
                ano={data.ano}
                anoAnterior={data.anoAnterior}
              />
            ))}
          </div>

          <div
            data-bn-tops
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              width: '100%',
            }}
          >
            {TOP_DEFS.map((def) => (
              <TopBlock
                key={def.key}
                def={def}
                par={data.top5[def.key]}
                ano={data.ano}
                anoAnterior={data.anoAnterior}
              />
            ))}
          </div>

          <div
            data-overview-copy-card
            data-chart-export-preserve-bg
            data-apresentacao-top-contratos
            style={{
              background: '#FFFFFF',
              border: '1px solid #E6E8EB',
              borderRadius: 8,
              padding: '10px 12px',
              boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
              flexShrink: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#64748B',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              5 maiores contratos
            </div>
            <div
              data-top-contratos-row
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                gap: 8,
                width: '100%',
              }}
            >
              {nomesContratos.map((nome, i) => (
                <div
                  key={`${nome}-${i}`}
                  data-top-contrato-cell
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    data-top-contrato-nome
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1F2937',
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'normal',
                      width: '100%',
                    }}
                  >
                    {nome}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
