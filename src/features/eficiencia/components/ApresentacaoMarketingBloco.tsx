import type { MesFiltroEficiencia } from '../constants'
import type { ApresentacaoMarketingData } from '../utils/apresentacaoMarketing'
import { MesFilterButtons } from './MesFilterButtons'

const GOLD = '#D5B170'
const GOLD_SOFT = '#F3E6D0'
const DARK = '#333F48'
const OK = '#059669'
const NOK = '#DC2626'
const BORDER = '#E2E8F0'

type Props = {
  data: ApresentacaoMarketingData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mesFiltro: MesFiltroEficiencia
  onMesFiltroChange: (mes: MesFiltroEficiencia) => void
}

/**
 * Layout em <table> (não CSS grid/flex) — foreignObject do export PPT
 * quebra pills/flex e “come” as badges de meta.
 */
export function ApresentacaoMarketingBloco({
  data,
  loading,
  error,
  ano,
  mesFiltro,
  onMesFiltroChange,
}: Props) {
  const nMeses = data?.meses.length ?? 0

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
          border: `1px solid ${BORDER}`,
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
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          data-overview-copy-card
          data-chart-export-preserve-bg
          style={{
            display: 'inline-block',
            alignSelf: 'flex-start',
            borderRadius: 5,
            backgroundColor: GOLD,
            color: '#fff',
            padding: '3px 10px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
          }}
        >
          9. Indicadores de Marketing
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
            Não foi possível carregar Marketing
            {error.message ? `: ${error.message}` : '.'}
          </div>
        ) : loading || !data ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#64748B' }}>Carregando Marketing…</div>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{ height: 52, borderRadius: 8, background: 'rgba(0,0,0,0.06)' }}
              />
            ))}
          </div>
        ) : (
          <div
            data-overview-copy-card
            data-chart-export-preserve-bg
            style={{
              width: '100%',
              printColorAdjust: 'exact',
              WebkitPrintColorAdjust: 'exact',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: '8px 8px',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: 220 }} />
                {Array.from({ length: nMeses }, (_, i) => (
                  <col key={i} />
                ))}
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ padding: 0, border: 'none' }} />
                  {data.rows[0]!.cells.map((c) => (
                    <th
                      key={c.mes}
                      style={{
                        backgroundColor: DARK,
                        color: '#FFFFFF',
                        borderRadius: 8,
                        padding: '8px 4px',
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        border: 'none',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    >
                      {c.mesLabelLong}
                    </th>
                  ))}
                  <th
                    style={{
                      backgroundColor: GOLD,
                      color: '#FFFFFF',
                      borderRadius: 8,
                      padding: '8px 6px',
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      border: 'none',
                      printColorAdjust: 'exact',
                      WebkitPrintColorAdjust: 'exact',
                    }}
                  >
                    ACUMULADO
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    {/* Título + meta (bloco sólido, sem flex/pill frágil) */}
                    <td
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: `1px solid ${BORDER}`,
                        borderLeft: `4px solid ${DARK}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                        verticalAlign: 'middle',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#0F172A',
                          lineHeight: 1.25,
                          marginBottom: 6,
                          whiteSpace: 'normal',
                        }}
                      >
                        {row.titulo}
                      </div>
                      <div
                        style={{
                          backgroundColor: DARK,
                          color: '#FFFFFF',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                          printColorAdjust: 'exact',
                          WebkitPrintColorAdjust: 'exact',
                        }}
                      >
                        {row.metaLabel}
                      </div>
                    </td>

                    {row.cells.map((cell) => (
                      <td
                        key={cell.mes}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: `1px solid ${BORDER}`,
                          borderRadius: 10,
                          padding: '12px 4px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          fontSize: 13,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: cell.atingiu ? OK : NOK,
                          printColorAdjust: 'exact',
                          WebkitPrintColorAdjust: 'exact',
                        }}
                      >
                        {cell.label}
                      </td>
                    ))}

                    <td
                      style={{
                        backgroundColor: GOLD_SOFT,
                        border: `1px solid ${GOLD}`,
                        borderRadius: 10,
                        padding: '8px 6px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: row.acumAtingiu ? OK : NOK,
                          lineHeight: 1.2,
                        }}
                      >
                        {row.acumLabel}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: row.acumAtingiu ? OK : NOK,
                          marginTop: 2,
                          lineHeight: 1.2,
                        }}
                      >
                        {row.acumPctLabel}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, paddingLeft: 4 }}>
              * Engajamento e alcance: média dos meses com post no período · Pautas =
              volume de posts (proxy SIOE)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
