import type { CSSProperties, ReactNode } from 'react'
import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'
import {
  RENTABILIDADE_COPY_CARD_BG,
  buildInsightsRentabilidadeCopia,
  buildLeituraRentabilidadeCopia,
  formatHonorarioMensalCopia,
  formatHorasRentabilidadeCopia,
  formatValorHoraCopia,
  formatVsMediaPercentualCopia,
  mesesCalendarioNoPeriodo,
  nomeCurtoRentabilidade,
  tomVsMediaCopia,
  type RentabilidadeCopiaInsightCard,
  type RentabilidadeCopiaTom,
  type RentabilidadeCopiaVariant,
} from '../utils/rentabilidadeCopy'

/** Largura alinhada a slides 16:9 (copiar/colar no PowerPoint). */
export const RENTABILIDADE_COPY_SLIDE_WIDTH = 1280

const TEXT = '#1e293b'
const MUTED = '#64748b'
const LINE = 'rgba(163, 132, 84, 0.22)'
const ROW_ALT = 'rgba(255, 255, 255, 0.55)'
const TOP_RULE = '#a38454'
const GREEN = '#1a6b42'
const ORANGE = '#b45309'
const FOOTER_BG = 'rgba(163, 132, 84, 0.18)'
const INSIGHT_CARD_BG = '#ffffff'

const TOM_COR: Record<RentabilidadeCopiaTom, string> = {
  alto: GREEN,
  baixo: ORANGE,
  neutro: TEXT,
}

type Props = {
  variant: RentabilidadeCopiaVariant
  linhas: RentabilidadeContratoLinha[]
  mediaValorHoraEscritorio: number | null
  mediaEfetivoEscritorio: number | null
  horasEscritorioMinutos: number
  recebidoEscritorio: number
  dataInicio: string
  dataFim: string
}

function CelulaValor({
  children,
  tom = 'neutro',
  bold = false,
  size = 'md',
}: {
  children: ReactNode
  tom?: RentabilidadeCopiaTom
  bold?: boolean
  size?: 'md' | 'lg'
}) {
  return (
    <span
      style={{
        color: TOM_COR[tom],
        fontWeight: bold ? 800 : tom === 'neutro' ? 600 : 700,
        fontSize: size === 'lg' ? 15 : 14,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </span>
  )
}

function InsightCardSlide({ card }: { card: RentabilidadeCopiaInsightCard }) {
  return (
    <div
      style={{
        backgroundColor: INSIGHT_CARD_BG,
        borderRadius: 10,
        border: `1px solid ${LINE}`,
        borderTop: `4px solid ${card.accent}`,
        padding: '16px 18px 18px',
        minHeight: 132,
        boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ lineHeight: 1.25 }}>
        <span
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: card.accent,
            letterSpacing: '-0.02em',
          }}
        >
          {card.headlineMetric}
        </span>
        {card.headlineRest ? (
          <span style={{ fontSize: 24, fontWeight: 800, color: TEXT }}>{card.headlineRest}</span>
        ) : null}
      </div>
      <p
        style={{
          margin: '12px 0 0',
          fontSize: 13,
          lineHeight: 1.45,
          color: '#475569',
        }}
      >
        {card.body}
      </p>
      {card.footerBold ? (
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            lineHeight: 1.4,
            fontWeight: 800,
            color: TEXT,
          }}
        >
          {card.footerBold}
        </p>
      ) : null}
    </div>
  )
}

export function RentabilidadeContratosCopySlide({
  variant,
  linhas,
  mediaValorHoraEscritorio,
  mediaEfetivoEscritorio,
  horasEscritorioMinutos,
  recebidoEscritorio,
  dataInicio,
  dataFim,
}: Props) {
  const meses = mesesCalendarioNoPeriodo(dataInicio, dataFim)

  const insightCards = buildInsightsRentabilidadeCopia({
    variant,
    linhas,
    mediaValorHoraEscritorio,
    mediaEfetivoEscritorio,
    horasEscritorioMinutos,
    recebidoEscritorio,
  })

  const th: CSSProperties = {
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: '#475569',
    padding: '14px 14px 12px',
    whiteSpace: 'nowrap',
    borderBottom: `3px solid ${TOP_RULE}`,
    lineHeight: 1.2,
  }

  const tdBase: CSSProperties = {
    padding: '13px 14px',
    fontSize: 14,
    verticalAlign: 'middle',
    borderBottom: `1px solid ${LINE}`,
    lineHeight: 1.35,
  }

  return (
    <div
      style={{
        width: RENTABILIDADE_COPY_SLIDE_WIDTH,
        boxSizing: 'border-box',
        backgroundColor: RENTABILIDADE_COPY_CARD_BG,
        color: TEXT,
        padding: '28px 36px 32px',
        fontFamily: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
        borderRadius: 10,
        border: `1px solid ${LINE}`,
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {insightCards.map((card, i) => (
          <InsightCardSlide key={`${card.headlineMetric}-${i}`} card={card} />
        ))}
      </div>

      {linhas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 15, color: MUTED }}>
          Nenhum contrato elegível (faturamento nos últimos 3 meses e hora efetiva calculada).
        </p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            backgroundColor: INSIGHT_CARD_BG,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 4 }}>Cliente</th>
              <th style={th}>Horas</th>
              <th style={th}>Honorário mensal</th>
              <th style={th}>Valor da hora</th>
              <th style={th}>vs média</th>
              <th style={th}>Valor efetivo da hora</th>
              <th style={{ ...th, textAlign: 'left' }}>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, index) => {
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
              const nome = nomeCurtoRentabilidade(linha.cliente)
              const rowBg = index % 2 === 1 ? ROW_ALT : 'transparent'

              return (
                <tr key={linha.cliente} style={{ backgroundColor: rowBg }}>
                  <td
                    style={{
                      ...tdBase,
                      paddingLeft: 4,
                      fontSize: 15,
                      fontWeight: 800,
                      color: TEXT,
                    }}
                  >
                    {nome}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 15,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatHorasRentabilidadeCopia(linha.horas_minutos)}
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: 14,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatHonorarioMensalCopia(linha.previsto_periodo, meses)}
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right' }}>
                    <CelulaValor tom={tomValorHora} size="lg">
                      {formatValorHoraCopia(linha.valor_hora_previsto)}
                    </CelulaValor>
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right' }}>
                    <CelulaValor tom={tomValorHora}>
                      {formatVsMediaPercentualCopia(
                        linha.valor_hora_previsto,
                        mediaValorHoraEscritorio,
                      )}
                    </CelulaValor>
                  </td>
                  <td style={{ ...tdBase, textAlign: 'right' }}>
                    <CelulaValor tom={tomEfetivo} size="lg">
                      {formatValorHoraCopia(linha.valor_hora_efetivo)}
                    </CelulaValor>
                  </td>
                  <td
                    style={{
                      ...tdBase,
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#334155',
                    }}
                  >
                    {leitura}
                  </td>
                </tr>
              )
            })}
            <tr style={{ backgroundColor: FOOTER_BG }}>
              <td
                style={{
                  ...tdBase,
                  paddingLeft: 4,
                  fontSize: 15,
                  fontWeight: 800,
                  borderBottom: 'none',
                  paddingTop: 16,
                  paddingBottom: 16,
                }}
              >
                Escritório
              </td>
              <td
                style={{
                  ...tdBase,
                  textAlign: 'right',
                  fontWeight: 800,
                  fontSize: 15,
                  fontVariantNumeric: 'tabular-nums',
                  borderBottom: 'none',
                  paddingTop: 16,
                  paddingBottom: 16,
                }}
              >
                {formatHorasRentabilidadeCopia(horasEscritorioMinutos)}
              </td>
              <td style={{ ...tdBase, borderBottom: 'none', paddingTop: 16, paddingBottom: 16 }} />
              <td
                style={{
                  ...tdBase,
                  textAlign: 'right',
                  borderBottom: 'none',
                  paddingTop: 16,
                  paddingBottom: 16,
                }}
              >
                <CelulaValor bold size="lg">
                  {formatValorHoraCopia(mediaValorHoraEscritorio)}
                </CelulaValor>
              </td>
              <td style={{ ...tdBase, borderBottom: 'none', paddingTop: 16, paddingBottom: 16 }} />
              <td
                style={{
                  ...tdBase,
                  textAlign: 'right',
                  borderBottom: 'none',
                  paddingTop: 16,
                  paddingBottom: 16,
                }}
              >
                <CelulaValor bold size="lg">
                  {formatValorHoraCopia(mediaEfetivoEscritorio)}
                </CelulaValor>
              </td>
              <td
                style={{
                  ...tdBase,
                  textAlign: 'left',
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#475569',
                  borderBottom: 'none',
                  paddingTop: 16,
                  paddingBottom: 16,
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
