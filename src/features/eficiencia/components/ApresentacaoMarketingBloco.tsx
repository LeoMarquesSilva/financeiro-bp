import type { CSSProperties } from 'react'
import { MESES_EFICIENCIA, type MesFiltroEficiencia } from '../constants'
import type {
  ApresentacaoMarketingData,
  MarketingIndicadorRow,
} from '../utils/apresentacaoMarketing'
import { toPriMaiuscula } from '../utils/textFormat'
import { MesFilterButtons } from './MesFilterButtons'

const COL_TITLE_WIDTH = 150
const COL_MES_WIDTH = 60
const COL_ACUM_WIDTH = 72
const TABLE_MIN_WIDTH =
  COL_TITLE_WIDTH + MESES_EFICIENCIA.length * COL_MES_WIDTH + COL_ACUM_WIDTH

type Props = {
  data: ApresentacaoMarketingData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mesFiltro: MesFiltroEficiencia
  onMesFiltroChange: (mes: MesFiltroEficiencia) => void
}

function cellStyle(atingiu: boolean | null, bold: boolean): CSSProperties {
  if (atingiu == null) {
    return { background: '#FFFFFF', color: '#6B7280', fontWeight: bold ? 700 : 600 }
  }
  return {
    background: atingiu ? '#ECFDF3' : '#FEE2E2',
    color: atingiu ? '#059669' : '#DC2626',
    fontWeight: bold ? 700 : 600,
  }
}

function metaTexto(metaLabel: string): string {
  const t = metaLabel.trim()
  if (/^meta\b/i.test(t)) return t
  return `Meta ${t}`
}

const thBase: CSSProperties = {
  padding: 4,
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  borderBottom: '2px solid #E5E7EB',
}

/** Layout idêntico ao OverviewKpiHeatCard (título + meses no thead, meta na 1ª célula). */
function MarketingHeatCard({ row }: { row: MarketingIndicadorRow }) {
  const byMes = new Map(row.cells.map((c) => [c.mes, c]))

  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        flex: 1,
        minWidth: 0,
        background: '#FFFFFF',
        border: '1px solid #E6E8EB',
        borderRadius: 8,
        padding: 8,
        boxShadow: '0 2px 4px rgba(15,23,42,0.06)',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          minWidth: TABLE_MIN_WIDTH,
        }}
      >
        <colgroup>
          <col style={{ width: COL_TITLE_WIDTH }} />
          {MESES_EFICIENCIA.map((m) => (
            <col key={m} style={{ width: COL_MES_WIDTH }} />
          ))}
          <col style={{ width: COL_ACUM_WIDTH }} />
        </colgroup>
        <thead>
          <tr>
            <th
              style={{
                padding: '4px 6px',
                textAlign: 'left',
                fontSize: 11,
                fontWeight: 600,
                color: '#1F2937',
                borderBottom: '2px solid #E5E7EB',
              }}
            >
              {toPriMaiuscula(row.titulo)}
            </th>
            {MESES_EFICIENCIA.map((m) => (
              <th key={m} style={thBase}>
                {m}
              </th>
            ))}
            <th
              style={{
                padding: 4,
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 600,
                color: '#1F2937',
                borderBottom: '2px solid #E5E7EB',
              }}
            >
              Acum.
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              style={{
                padding: '4px 6px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 500,
                color: '#059669',
              }}
            >
              {metaTexto(row.metaLabel)}
            </td>
            {MESES_EFICIENCIA.map((_, i) => {
              const cell = byMes.get(i + 1)
              return (
                <td
                  key={i}
                  style={{
                    padding: 4,
                    textAlign: 'center',
                    fontSize: 11,
                    ...cellStyle(cell ? cell.atingiu : null, false),
                  }}
                >
                  {cell ? cell.label : '-'}
                </td>
              )
            })}
            <td
              style={{
                padding: 4,
                textAlign: 'center',
                fontSize: 11,
                borderLeft: '2px solid #E5E7EB',
                ...cellStyle(row.acumAtingiu, true),
              }}
            >
              <div>{row.acumLabel}</div>
              <div style={{ fontSize: 9, opacity: 0.9 }}>{row.acumPctLabel}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function ApresentacaoMarketingBloco({
  data,
  loading,
  error,
  ano,
  mesFiltro,
  onMesFiltroChange,
}: Props) {
  return (
    <div
      style={{
        width: '100%',
        minWidth: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <div
        data-chart-export-ignore
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
          Período Marketing (independente do filtro global)
        </span>
        <MesFilterButtons
          value={mesFiltro}
          onChange={onMesFiltroChange}
          showSemanas={false}
          showResultado={false}
          showDiaPicker={false}
          ano={ano}
        />
      </div>

      <div
        data-apresentacao-export="marketing"
        style={{
          width: '100%',
          minWidth: 1100,
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
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
            Não foi possível carregar Marketing
            {error.message ? `: ${error.message}` : '.'}
          </div>
        ) : loading || !data ? (
          <div style={{ display: 'grid', gap: 8, padding: 4 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{ height: 56, borderRadius: 8, background: 'rgba(0,0,0,0.06)' }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.rows.map((row) => (
              <MarketingHeatCard key={row.id} row={row} />
            ))}
            <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2, paddingLeft: 4 }}>
              * Engajamento e alcance: média dos meses com post no período · Pautas =
              volume de posts (proxy SIOE)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
