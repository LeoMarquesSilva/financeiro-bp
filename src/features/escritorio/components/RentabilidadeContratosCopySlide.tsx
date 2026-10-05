import type { CSSProperties, ReactNode } from 'react'
import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'
import {
  RENTABILIDADE_COPY_CARD_BG,
  buildLeituraRentabilidadeCopia,
  formatHonorarioMensalCopia,
  formatHorasRentabilidadeCopia,
  formatValorHoraCopia,
  formatVsMediaPercentualCopia,
  mesesCalendarioNoPeriodo,
  tomVsMediaCopia,
  type RentabilidadeCopiaTom,
} from '../utils/rentabilidadeCopy'

const TEXT = '#0f172a'
const MUTED = '#64748b'
const LINE = 'rgba(15, 23, 42, 0.08)'
const TOP_RULE = '#a38454'
const GREEN = '#2d7a4d'
const ORANGE = '#c25e00'
const FOOTER_BG = 'rgba(163, 132, 84, 0.12)'

const TOM_COR: Record<RentabilidadeCopiaTom, string> = {
  alto: GREEN,
  baixo: ORANGE,
  neutro: TEXT,
}

type Props = {
  titulo: string
  linhas: RentabilidadeContratoLinha[]
  mediaValorHoraEscritorio: number | null
  mediaEfetivoEscritorio: number | null
  horasEscritorioMinutos: number
  dataInicio: string
  dataFim: string
}

function CelulaValor({
  children,
  tom = 'neutro',
  bold = false,
}: {
  children: ReactNode
  tom?: RentabilidadeCopiaTom
  bold?: boolean
}) {
  return (
    <span
      style={{
        color: TOM_COR[tom],
        fontWeight: bold ? 700 : 500,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  )
}

export function RentabilidadeContratosCopySlide({
  titulo,
  linhas,
  mediaValorHoraEscritorio,
  mediaEfetivoEscritorio,
  horasEscritorioMinutos,
  dataInicio,
  dataFim,
}: Props) {
  const meses = mesesCalendarioNoPeriodo(dataInicio, dataFim)

  const th: CSSProperties = {
    textAlign: 'right',
    fontSize: 10,
    fontWeight: 600,
    color: MUTED,
    padding: '10px 8px 8px',
    whiteSpace: 'nowrap',
    borderBottom: `2px solid ${TOP_RULE}`,
  }

  const td: CSSProperties = {
    padding: '8px 8px',
    fontSize: 11,
    verticalAlign: 'middle',
    borderBottom: `1px solid ${LINE}`,
  }

  return (
    <div
      style={{
        width: 1180,
        boxSizing: 'border-box',
        backgroundColor: RENTABILIDADE_COPY_CARD_BG,
        color: TEXT,
        padding: '14px 18px 16px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          marginBottom: 10,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        {titulo}
      </div>

      {linhas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
          Nenhum contrato elegível (faturamento nos últimos 3 meses e hora efetiva calculada).
        </p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Cliente</th>
              <th style={th}>Horas</th>
              <th style={th}>Honorário mensal</th>
              <th style={th}>Valor da hora</th>
              <th style={th}>vs média</th>
              <th style={th}>Valor efetivo da hora</th>
              <th style={{ ...th, textAlign: 'left' }}>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const tomValorHora = tomVsMediaCopia(
                linha.valor_hora_previsto,
                mediaValorHoraEscritorio,
              )
              const tomEfetivo = tomVsMediaCopia(
                linha.valor_hora_efetivo,
                mediaEfetivoEscritorio,
              )
              const leitura = buildLeituraRentabilidadeCopia(
                linha,
                mediaValorHoraEscritorio,
                mediaEfetivoEscritorio,
              )
              const nome =
                linha.cliente.replace(/^Grupo\s+/i, '').trim() || linha.cliente

              return (
                <tr key={linha.cliente}>
                  <td style={{ ...td, paddingLeft: 0, fontWeight: 700, color: TEXT }}>{nome}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatHorasRentabilidadeCopia(linha.horas_minutos)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatHonorarioMensalCopia(linha.previsto_periodo, meses)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <CelulaValor tom={tomValorHora}>
                      {formatValorHoraCopia(linha.valor_hora_previsto)}
                    </CelulaValor>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <CelulaValor tom={tomValorHora}>
                      {formatVsMediaPercentualCopia(
                        linha.valor_hora_previsto,
                        mediaValorHoraEscritorio,
                      )}
                    </CelulaValor>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <CelulaValor tom={tomEfetivo}>
                      {formatValorHoraCopia(linha.valor_hora_efetivo)}
                    </CelulaValor>
                  </td>
                  <td style={{ ...td, textAlign: 'left', fontSize: 10, lineHeight: 1.35, color: '#334155' }}>
                    {leitura}
                  </td>
                </tr>
              )
            })}
            <tr style={{ backgroundColor: FOOTER_BG }}>
              <td style={{ ...td, paddingLeft: 0, fontWeight: 800, borderBottom: 'none' }}>
                Escritório
              </td>
              <td
                style={{
                  ...td,
                  textAlign: 'right',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  borderBottom: 'none',
                }}
              >
                {formatHorasRentabilidadeCopia(horasEscritorioMinutos)}
              </td>
              <td style={{ ...td, borderBottom: 'none' }} />
              <td style={{ ...td, textAlign: 'right', borderBottom: 'none' }}>
                <CelulaValor bold>{formatValorHoraCopia(mediaValorHoraEscritorio)}</CelulaValor>
              </td>
              <td style={{ ...td, borderBottom: 'none' }} />
              <td style={{ ...td, textAlign: 'right', borderBottom: 'none' }}>
                <CelulaValor bold>{formatValorHoraCopia(mediaEfetivoEscritorio)}</CelulaValor>
              </td>
              <td
                style={{
                  ...td,
                  textAlign: 'left',
                  fontWeight: 600,
                  color: MUTED,
                  borderBottom: 'none',
                }}
              >
                Média
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
