import type { CSSProperties } from 'react'
import { formatPercent } from '@/shared/utils/format'
import { MESES_EFICIENCIA } from '../constants'

const COL_TITLE_WIDTH = 250
const COL_MES_WIDTH = 56
const COL_ACUM_WIDTH = 72
const TABLE_MIN_WIDTH =
  COL_TITLE_WIDTH + MESES_EFICIENCIA.length * COL_MES_WIDTH + COL_ACUM_WIDTH

const META_ENTREGAS = 6
/** Entregas no mês. Julho = 1 (16,67%). Agosto fechou sem entrega (0,00%). */
const ENTREGAS_POR_MES: Partial<Record<number, number>> = {
  7: 1,
  8: 0,
}
/** Acum. = única entrega (julho), 1/6 da meta. */
const PCT_ACUM = (1 / META_ENTREGAS) * 100

function pctMes(mes: number): number | null {
  const n = ENTREGAS_POR_MES[mes]
  if (n == null) return null
  return (n / META_ENTREGAS) * 100
}

const thBase: CSSProperties = {
  padding: 4,
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  borderBottom: '2px solid #E5E7EB',
}

function mesFuturo(ano: number, mes: number, ref = new Date()): boolean {
  return ano > ref.getFullYear() || (ano === ref.getFullYear() && mes > ref.getMonth() + 1)
}

export function ApresentacaoGovernancaInternaBloco({ ano }: { ano: number }) {
  return (
    <div
      data-apresentacao-export="governanca_interna"
      style={{
        width: '100%',
        minWidth: 1100,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        padding: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <div
        data-overview-copy-card
        data-chart-export-preserve-bg
        style={{
          width: '100%',
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
            {MESES_EFICIENCIA.map((mes) => (
              <col key={mes} style={{ width: COL_MES_WIDTH }} />
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
                  whiteSpace: 'nowrap',
                }}
              >
                Estruturação de Governança Interna
              </th>
              {MESES_EFICIENCIA.map((mes) => (
                <th key={mes} style={thBase}>
                  {mes}
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
                Meta: 6 Entregas
              </td>
              {MESES_EFICIENCIA.map((_, index) => {
                const mes = index + 1
                const pct = pctMes(mes)
                const futuro = mesFuturo(ano, mes)
                const temValor = pct != null && !futuro
                const bateu = temValor && pct > 0
                const label = temValor ? formatPercent(pct) : '-'

                return (
                  <td
                    key={mes}
                    style={{
                      padding: 4,
                      textAlign: 'center',
                      fontSize: 11,
                      background: !temValor ? '#FFFFFF' : bateu ? '#ECFDF3' : '#FEE2E2',
                      color: !temValor ? '#6B7280' : bateu ? '#059669' : '#DC2626',
                      fontWeight: temValor ? 600 : 500,
                    }}
                  >
                    {label}
                  </td>
                )
              })}
              <td
                style={{
                  padding: 4,
                  textAlign: 'center',
                  fontSize: 11,
                  borderLeft: '2px solid #E5E7EB',
                  background: '#ECFDF3',
                  color: '#059669',
                  fontWeight: 700,
                }}
              >
                {formatPercent(PCT_ACUM)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
