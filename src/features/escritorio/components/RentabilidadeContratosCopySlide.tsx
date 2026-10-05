import type { CSSProperties, ReactNode } from 'react'
import type { RentabilidadeContratoLinha } from '../services/escritorioRentabilidadeService'
import {
  RENTABILIDADE_COPY_CARD_BG,
  buildInsightsRentabilidadeCopia,
  buildLeituraRentabilidadeCopia,
  formatHonorarioMensalCopia,
  formatHorasRentabilidadeCopia,
  formatValorHoraCopiaExport,
  formatVsMediaPercentualCopiaExport,
  mesesCalendarioNoPeriodo,
  nomeCurtoRentabilidade,
  tomVsMediaCopia,
  type RentabilidadeCopiaInsightCard,
  type RentabilidadeCopiaTom,
  type RentabilidadeCopiaVariant,
} from '../utils/rentabilidadeCopy'

/**
 * Largura lógica do export (scale 1 no PNG). ~1920px ≈ slide 16:9 ao colar em largura total.
 * Tipografia grande para leitura em apresentação.
 */
export const RENTABILIDADE_COPY_SLIDE_WIDTH = 1920

const TABLE_COL_WIDTHS = ['32%', '9%', '15%', '18%', '13%', '13%'] as const

const F = {
  insightHeadline: 40,
  insightBody: 19,
  th: 14,
  td: 21,
  client: 24,
  leitura: 16,
  cellLg: 23,
  cellMd: 21,
  footerTitle: 24,
  footerSub: 15,
} as const

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
        fontSize: size === 'lg' ? F.cellLg : F.cellMd,
        whiteSpace: 'nowrap',
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
        borderTop: `5px solid ${card.accent}`,
        padding: '20px 22px 22px',
        minHeight: 160,
        boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ lineHeight: 1.25 }}>
        <span
          style={{
            fontSize: F.insightHeadline,
            fontWeight: 800,
            color: card.accent,
            letterSpacing: '-0.02em',
          }}
        >
          {card.headlineMetric}
        </span>
        {card.headlineRest ? (
          <span style={{ fontSize: F.insightHeadline, fontWeight: 800, color: TEXT }}>
            {card.headlineRest}
          </span>
        ) : null}
      </div>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: F.insightBody,
          lineHeight: 1.45,
          color: '#475569',
        }}
      >
        {card.body}
      </p>
      {card.footerBold ? (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: F.insightBody,
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
    fontSize: F.th,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#475569',
    padding: '14px 18px 12px',
    whiteSpace: 'normal',
    borderBottom: `4px solid ${TOP_RULE}`,
    lineHeight: 1.25,
    verticalAlign: 'bottom',
  }

  const tdBase: CSSProperties = {
    padding: '14px 18px',
    fontSize: F.td,
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
        {TABLE_COL_WIDTHS.map((w) => (
          <col key={w} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: 'left', paddingLeft: 16 }}>Cliente</th>
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
          <th style={{ ...th, paddingRight: 16 }}>
            <ThLabel lines={['Hora', 'efetiva']} />
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
              <td style={{ ...tdBase, paddingLeft: 16 }}>
                <div
                  style={{
                    fontSize: F.client,
                    fontWeight: 800,
                    color: TEXT,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={nome}
                >
                  {nome}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: F.leitura,
                    fontWeight: 500,
                    lineHeight: 1.35,
                    color: '#475569',
                  }}
                >
                  {leitura}
                </div>
              </td>
              <td
                style={{
                  ...tdBase,
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: F.td,
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
                  fontSize: F.td - 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatHonorarioMensalCopia(linha.previsto_periodo, meses)}
              </td>
              <td style={{ ...tdBase, textAlign: 'right', paddingLeft: 24, paddingRight: 24 }}>
                <CelulaValor tom={tomValorHora} size="lg">
                  {formatValorHoraCopiaExport(linha.valor_hora_previsto)}
                </CelulaValor>
              </td>
              <td style={{ ...tdBase, textAlign: 'right', paddingLeft: 20, paddingRight: 20 }}>
                <CelulaValor tom={tomValorHora}>
                  {formatVsMediaPercentualCopiaExport(
                    linha.valor_hora_previsto,
                    mediaValorHoraEscritorio,
                  )}
                </CelulaValor>
              </td>
              <td style={{ ...tdBase, textAlign: 'right', paddingRight: 16 }}>
                <CelulaValor tom={tomEfetivo} size="lg">
                  {formatValorHoraCopiaExport(linha.valor_hora_efetivo)}
                </CelulaValor>
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
    padding: '16px 18px',
    fontSize: F.td,
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
        {TABLE_COL_WIDTHS.map((w) => (
          <col key={`f-${w}`} style={{ width: w }} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          <td style={{ ...tdBase, paddingLeft: 16, fontWeight: 800 }}>
            <div style={{ fontSize: F.footerTitle }}>Escritório</div>
            <div
              style={{
                marginTop: 4,
                fontSize: F.footerSub,
                fontWeight: 600,
                color: '#475569',
              }}
            >
              Média
            </div>
          </td>
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
          <td style={{ ...tdBase, textAlign: 'right', paddingLeft: 24, paddingRight: 24 }}>
            <CelulaValor bold size="lg">
              {formatValorHoraCopiaExport(mediaValorHoraEscritorio)}
            </CelulaValor>
          </td>
          <td style={tdBase} />
          <td style={{ ...tdBase, textAlign: 'right', paddingRight: 16 }}>
            <CelulaValor bold size="lg">
              {formatValorHoraCopiaExport(mediaEfetivoEscritorio)}
            </CelulaValor>
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
        padding: '12px 8px 16px',
        fontFamily: '"Segoe UI", "Helvetica Neue", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 18,
          marginBottom: 18,
        }}
      >
        {insightCards.map((card, i) => (
          <InsightCardSlide key={`${card.headlineMetric}-${i}`} card={card} />
        ))}
      </div>

      {linhas.length === 0 ? (
        <p style={{ margin: 0, fontSize: F.td, color: MUTED }}>
          Nenhum contrato elegível (faturamento nos últimos 3 meses e hora efetiva calculada).
        </p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: colB.length > 0 ? '1fr 1fr' : '1fr',
              gap: 20,
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
