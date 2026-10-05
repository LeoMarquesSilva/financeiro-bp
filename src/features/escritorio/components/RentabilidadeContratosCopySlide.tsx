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

/** Largura total do export (16:9 em 1920px — usa a faixa útil do slide). */
export const RENTABILIDADE_COPY_SLIDE_WIDTH = 1920

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

function splitLinhasCopia(linhas: RentabilidadeContratoLinha[]): [RentabilidadeContratoLinha[], RentabilidadeContratoLinha[]] {
  const mid = Math.ceil(linhas.length / 2)
  return [linhas.slice(0, mid), linhas.slice(mid)]
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
        fontSize: size === 'lg' ? 17 : 16,
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
          fontSize: 14,
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
            fontSize: 14,
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

function ThLabel({ lines }: { lines: string[] }) {
  return (
    <span style={{ display: 'inline-block', lineHeight: 1.25, maxWidth: '100%' }}>
      {lines.map((line) => (
        <span key={line} style={{ display: 'block' }}>
          {line}
        </span>
      ))}
    </span>
  )
}

function TabelaRentabilidadeCopia({
  linhas,
  meses,
  mediaValorHoraEscritorio,
  mediaEfetivoEscritorio,
  rowOffset,
}: {
  linhas: RentabilidadeContratoLinha[]
  meses: number
  mediaValorHoraEscritorio: number | null
  mediaEfetivoEscritorio: number | null
  rowOffset: number
}) {
  const th: CSSProperties = {
    textAlign: 'right',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#475569',
    padding: '12px 14px 10px',
    whiteSpace: 'normal',
    borderBottom: `3px solid ${TOP_RULE}`,
    lineHeight: 1.25,
    verticalAlign: 'bottom',
  }

  const tdBase: CSSProperties = {
    padding: '11px 14px',
    fontSize: 16,
    verticalAlign: 'top',
    borderBottom: `1px solid ${LINE}`,
    lineHeight: 1.4,
  }

  if (linhas.length === 0) return null

  return (
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
        <col style={{ width: '34%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '19%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: 'left', paddingLeft: 12 }}>Cliente</th>
          <th style={th}>
            <ThLabel lines={['Horas']} />
          </th>
          <th style={th}>
            <ThLabel lines={['Honorário', 'mensal']} />
          </th>
          <th style={th}>
            <ThLabel lines={['Valor', 'da hora']} />
          </th>
          <th style={th}>
            <ThLabel lines={['vs', 'média']} />
          </th>
          <th style={th}>
            <ThLabel lines={['Hora', 'efetiva']} />
          </th>
          <th style={{ ...th, textAlign: 'left', paddingRight: 12 }}>
            <ThLabel lines={['Leitura']} />
          </th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, index) => {
          const tomValorHora = tomVsMediaCopia(linha.valor_hora_previsto, mediaValorHoraEscritorio)
          const tomEfetivo = tomVsMediaCopia(linha.valor_hora_efetivo, mediaEfetivoEscritorio)
          const leitura = buildLeituraRentabilidadeCopia(
            linha,
            mediaValorHoraEscritorio,
            mediaEfetivoEscritorio,
          )
          const nome = nomeCurtoRentabilidade(linha.cliente)
          const rowBg = (rowOffset + index) % 2 === 1 ? ROW_ALT : 'transparent'

          return (
            <tr key={linha.cliente} style={{ backgroundColor: rowBg }}>
              <td
                style={{
                  ...tdBase,
                  paddingLeft: 14,
                  fontSize: 17,
                  fontWeight: 800,
                  color: TEXT,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={nome}
              >
                {nome}
              </td>
              <td
                style={{
                  ...tdBase,
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: 16,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatHorasRentabilidadeCopia(linha.horas_minutos)}
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
                {formatHonorarioMensalCopia(linha.previsto_periodo, meses)}
              </td>
              <td style={{ ...tdBase, textAlign: 'right' }}>
                <CelulaValor tom={tomValorHora} size="lg">
                  {formatValorHoraCopia(linha.valor_hora_previsto)}
                </CelulaValor>
              </td>
              <td style={{ ...tdBase, textAlign: 'right' }}>
                <CelulaValor tom={tomValorHora}>
                  {formatVsMediaPercentualCopia(linha.valor_hora_previsto, mediaValorHoraEscritorio)}
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
                  paddingRight: 12,
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#334155',
                }}
              >
                {leitura}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function RodapeEscritorioCopia({
  horasEscritorioMinutos,
  mediaValorHoraEscritorio,
  mediaEfetivoEscritorio,
}: {
  horasEscritorioMinutos: number
  mediaValorHoraEscritorio: number | null
  mediaEfetivoEscritorio: number | null
}) {
  const tdBase: CSSProperties = {
    padding: '14px 10px',
    fontSize: 16,
    verticalAlign: 'middle',
    lineHeight: 1.35,
  }

  return (
    <table
      style={{
        width: '100%',
        marginTop: 16,
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        backgroundColor: FOOTER_BG,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <colgroup>
        <col style={{ width: '34%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '19%' }} />
      </colgroup>
      <tbody>
        <tr>
          <td style={{ ...tdBase, paddingLeft: 12, fontSize: 17, fontWeight: 800 }}>Escritório</td>
          <td
            style={{
              ...tdBase,
              textAlign: 'right',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatHorasRentabilidadeCopia(horasEscritorioMinutos)}
          </td>
          <td style={tdBase} />
          <td style={{ ...tdBase, textAlign: 'right' }}>
            <CelulaValor bold size="lg">
              {formatValorHoraCopia(mediaValorHoraEscritorio)}
            </CelulaValor>
          </td>
          <td style={tdBase} />
          <td style={{ ...tdBase, textAlign: 'right' }}>
            <CelulaValor bold size="lg">
              {formatValorHoraCopia(mediaEfetivoEscritorio)}
            </CelulaValor>
          </td>
          <td
            style={{
              ...tdBase,
              paddingRight: 12,
              fontWeight: 700,
              color: '#475569',
            }}
          >
            Média
          </td>
        </tr>
      </tbody>
    </table>
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
  const [colA, colB] = splitLinhasCopia(linhas)

  const insightCards = buildInsightsRentabilidadeCopia({
    variant,
    linhas,
    mediaValorHoraEscritorio,
    mediaEfetivoEscritorio,
    horasEscritorioMinutos,
    recebidoEscritorio,
  })

  return (
    <div
      style={{
        width: RENTABILIDADE_COPY_SLIDE_WIDTH,
        boxSizing: 'border-box',
        backgroundColor: RENTABILIDADE_COPY_CARD_BG,
        color: TEXT,
        padding: '20px 16px 24px',
        fontFamily: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {insightCards.map((card, i) => (
          <InsightCardSlide key={`${card.headlineMetric}-${i}`} card={card} />
        ))}
      </div>

      {linhas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 16, color: MUTED }}>
          Nenhum contrato elegível (faturamento nos últimos 3 meses e hora efetiva calculada).
        </p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: colB.length > 0 ? '1fr 1fr' : '1fr',
              gap: 24,
              alignItems: 'start',
            }}
          >
            <TabelaRentabilidadeCopia
              linhas={colA}
              meses={meses}
              mediaValorHoraEscritorio={mediaValorHoraEscritorio}
              mediaEfetivoEscritorio={mediaEfetivoEscritorio}
              rowOffset={0}
            />
            {colB.length > 0 ? (
              <TabelaRentabilidadeCopia
                linhas={colB}
                meses={meses}
                mediaValorHoraEscritorio={mediaValorHoraEscritorio}
                mediaEfetivoEscritorio={mediaEfetivoEscritorio}
                rowOffset={colA.length}
              />
            ) : null}
          </div>
          <RodapeEscritorioCopia
            horasEscritorioMinutos={horasEscritorioMinutos}
            mediaValorHoraEscritorio={mediaValorHoraEscritorio}
            mediaEfetivoEscritorio={mediaEfetivoEscritorio}
          />
        </>
      )}
    </div>
  )
}
