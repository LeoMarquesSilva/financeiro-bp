import type { CSSProperties } from 'react'
import { formatPercent } from '@/shared/utils/format'
import { MESES_EFICIENCIA } from '../constants'

const COL_TITLE_WIDTH = 250
const COL_MES_WIDTH = 56
const COL_ACUM_WIDTH = 72
const TABLE_MIN_WIDTH =
  COL_TITLE_WIDTH + MESES_EFICIENCIA.length * COL_MES_WIDTH + COL_ACUM_WIDTH

const META_ENTREGAS = 6
const ENTREGAS_JULHO = 1
const PCT_ATINGIMENTO = (ENTREGAS_JULHO / META_ENTREGAS) * 100

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
                const entregueEmJulho = mes === 7
                const futuro = mesFuturo(ano, mes)
                const label = entregueEmJulho ? formatPercent(PCT_ATINGIMENTO) : '-'

                return (
                  <td
                    key={mes}
                    style={{
                      padding: 4,
                      textAlign: 'center',
                      fontSize: 11,
                      background: entregueEmJulho && !futuro ? '#ECFDF3' : '#FFFFFF',
                      color: entregueEmJulho && !futuro ? '#059669' : '#6B7280',
                      fontWeight: entregueEmJulho && !futuro ? 600 : 500,
                    }}
                  >
                    {futuro ? '-' : label}
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
                {formatPercent(PCT_ATINGIMENTO)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
