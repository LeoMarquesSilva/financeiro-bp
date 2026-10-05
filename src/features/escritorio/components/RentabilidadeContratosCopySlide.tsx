import type { CSSProperties } from 'react'
import { formatCurrency } from '@/shared/utils/format'
import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'
import {
  formatMediaHorasMes,
  formatResultadoHora,
  formatValorHoraRecebido,
  resultadoHoraPositivo,
} from '../utils/rentabilidadeFormat'

const MUTED = '#64748b'
const TEXT = '#0f172a'
const LINE = 'rgba(15, 23, 42, 0.12)'
const NAVY = '#0f2744'
const GREEN = '#059669'
const RED = '#dc2626'

type Props = {
  titulo: string
  subtitulo: string
  linhas: RentabilidadeContratoLinha[]
  mediaHoraEscritorio: number | null
}

function VsMedia({ valor, media }: { valor: number | null; media: number | null }) {
  if (valor == null || media == null) return <span style={{ color: MUTED }}>—</span>
  const delta = valor - media
  const positivo = resultadoHoraPositivo(delta)
  const color = positivo === true ? GREEN : positivo === false ? RED : MUTED
  return (
    <span style={{ color, fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {formatResultadoHora(delta)}
    </span>
  )
}

export function RentabilidadeContratosCopySlide({
  titulo,
  subtitulo,
  linhas,
  mediaHoraEscritorio,
}: Props) {
  const th: CSSProperties = {
    textAlign: 'right',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: MUTED,
    padding: '0 0 6px 8px',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      style={{
        width: 720,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        color: TEXT,
        padding: '8px 20px 16px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: NAVY,
          lineHeight: 1.15,
        }}
      >
        {titulo}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: MUTED, lineHeight: 1.35 }}>{subtitulo}</div>

      {linhas.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
          Nenhum contrato elegível (faturamento nos últimos 3 meses e hora efetiva calculada).
        </p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            marginTop: 10,
          }}
        >
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Grupo</th>
              <th style={th}>Recebido</th>
              <th style={th}>Horas</th>
              <th style={th}>R$/h efetivo</th>
              <th style={th}>vs média</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, i) => (
              <tr key={linha.cliente} style={{ borderTop: `1px solid ${LINE}` }}>
                <td
                  style={{
                    padding: '3px 6px 3px 0',
                    fontSize: 10,
                    fontWeight: 600,
                    color: MUTED,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </td>
                <td
                  style={{
                    padding: '3px 6px 3px 0',
                    fontSize: linha.cliente.length > 28 ? 10 : 11,
                    fontWeight: 600,
                    color: TEXT,
                    verticalAlign: 'middle',
                  }}
                >
                  {linha.cliente}
                </td>
                <td
                  style={{
                    padding: '3px 0 3px 8px',
                    textAlign: 'right',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#334155',
                  }}
                >
                  {formatCurrency(linha.recebido_periodo)}
                </td>
                <td
                  style={{
                    padding: '3px 0 3px 8px',
                    textAlign: 'right',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#334155',
                  }}
                >
                  {formatMediaHorasMes(linha.horas_minutos)}
                </td>
                <td
                  style={{
                    padding: '3px 0 3px 8px',
                    textAlign: 'right',
                    fontSize: 11,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: NAVY,
                  }}
                >
                  {formatValorHoraRecebido(linha.valor_hora_efetivo)}
                </td>
                <td style={{ padding: '3px 0 3px 8px', textAlign: 'right', verticalAlign: 'middle' }}>
                  <VsMedia valor={linha.valor_hora_efetivo} media={mediaHoraEscritorio} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
