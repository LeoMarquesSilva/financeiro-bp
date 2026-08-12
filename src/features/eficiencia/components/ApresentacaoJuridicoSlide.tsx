import { forwardRef, type CSSProperties, type Ref } from 'react'
import {
  APRESENTACAO_COLUNAS,
  APRESENTACAO_SECOES,
  type ApresentacaoCell,
} from '../utils/apresentacaoMatrix'
import type { ApresentacaoMatrixRow } from '../hooks/useApresentacaoMatrix'
import { toPriMaiuscula } from '../utils/textFormat'

const FENIX_URL = '/team/fenix-bismarchi.png'
const GOLD = '#D5B170'
const AREA_CARD_BG = '#333f48'
const AREA_CARD_GOLD = '#D5B170'
const COL_TITLE_WIDTH = 168
const COL_META_WIDTH = 58
const COL_AREA_WIDTH = 122
const COL_CONS_WIDTH = 122
const AREA_ICON_SIZE = 36
const AREA_HEADER_H = 52
const CARD_PAD = 4

const TITULO_CURTO: Partial<Record<string, string>> = {
  sla_protocolo: 'SLA Protocolo',
  eficiencia_protocolo: 'Eficiência Protocolo',
  sla_ciencia: 'SLA Ciência Agendamentos',
  sla_vistagem_risco: 'SLA Vistagem — Risco',
  sla_vistagem_normal: 'SLA Vistagem — Comuns',
  nps: 'NPS',
  gestao_pdi: 'Gestão de PDI',
  desenvolvimento: 'Desenvolvimento Contínuo',
  retencao: 'Retenção de Talentos',
}

/** Ícones SVG em public/team (e fênix no consolidado). */
const COL_ICON_URL: Record<string, string> = {
  Reestruturação: '/team/reestruturacao.svg',
  Cível: '/team/civel.svg',
  'Recuperação de Crédito': '/team/Recuperacao%20de%20Credito.svg',
  Trabalhista: '/team/Trabalhista.svg',
  Contratos: '/team/Societario.svg',
  'Operações Legais': '/team/Operacoes.svg',
  __consolidado__: FENIX_URL,
}

/** Linhas fixas — evita quebra aleatória no export SVG/PPT. */
const COL_HEADER_LINES: Record<string, string[]> = {
  Reestruturação: ['Reestruturação'],
  Cível: ['Cível'],
  'Recuperação de Crédito': ['Recuperação', 'de Crédito'],
  Trabalhista: ['Trabalhista'],
  Contratos: ['Societário e', 'Contratos'],
  'Operações Legais': ['Operações', 'Legais'],
  __consolidado__: ['Bismarchi | Pires'],
}

type Props = {
  colunas: typeof APRESENTACAO_COLUNAS
  rows: ApresentacaoMatrixRow[]
  loading?: boolean
}

function cellStyle(cell: ApresentacaoCell, bold: boolean): CSSProperties {
  if (cell.value == null || cell.atingiu == null) {
    return { background: '#FFFFFF', color: '#6B7280', fontWeight: bold ? 700 : 600 }
  }
  return {
    background: cell.atingiu ? '#ECFDF3' : '#FEE2E2',
    color: cell.atingiu ? '#059669' : '#DC2626',
    fontWeight: bold ? 700 : 600,
  }
}

function metaTexto(metaLabel: string): string {
  const t = metaLabel.trim()
  if (/^meta\b/i.test(t)) return t
  return `Meta ${t}`
}

const cellDivider: CSSProperties = {
  borderLeft: '1px solid #CBD5E1',
}

function ApresentacaoAreaHeader({ colunas }: { colunas: typeof APRESENTACAO_COLUNAS }) {
  const areaCols = colunas.filter((c) => !('consolidado' in c && c.consolidado))
  const consCol = colunas.find((c) => 'consolidado' in c && c.consolidado)

  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      data-apresentacao-area-header
      style={{
        background: 'transparent',
        borderRadius: 6,
        padding: CARD_PAD,
        paddingTop: AREA_ICON_SIZE / 2 + CARD_PAD,
        marginBottom: 6,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: COL_TITLE_WIDTH }} />
          <col style={{ width: COL_META_WIDTH }} />
          {areaCols.map((c) => (
            <col key={c.key} style={{ width: COL_AREA_WIDTH }} />
          ))}
          {consCol ? <col style={{ width: COL_CONS_WIDTH }} /> : null}
        </colgroup>
        <tbody>
          <tr>
            <td />
            <td />
            {colunas.map((col) => {
              const iconUrl = COL_ICON_URL[col.key]
              const consolidado = 'consolidado' in col && col.consolidado
              const lines = COL_HEADER_LINES[col.key] ?? [col.label]
              return (
                <td
                  key={col.key}
                  style={{
                    padding: '0 2px',
                    verticalAlign: 'bottom',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: AREA_HEADER_H,
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: 8,
                      backgroundColor: consolidado ? AREA_CARD_GOLD : AREA_CARD_BG,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      padding: '0 3px 5px',
                      textAlign: 'center',
                      overflow: 'visible',
                      printColorAdjust: 'exact',
                      WebkitPrintColorAdjust: 'exact',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: -(AREA_ICON_SIZE / 2),
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'inline-flex',
                        height: AREA_ICON_SIZE,
                        width: AREA_ICON_SIZE,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 9999,
                        backgroundColor: '#FFFFFF',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.18)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt=""
                          style={{
                            height: consolidado ? 26 : 22,
                            width: consolidado ? 26 : 22,
                            objectFit: 'contain',
                          }}
                        />
                      ) : null}
                    </span>
                    <span
                      data-apresentacao-area-label
                      style={{
                        display: 'block',
                        width: '100%',
                        fontFamily: 'Lato, system-ui, sans-serif',
                        fontSize: consolidado ? 11 : 10,
                        fontWeight: 700,
                        color: consolidado ? '#101F2E' : '#FFFFFF',
                        lineHeight: 1.15,
                        overflow: 'visible',
                        wordBreak: 'keep-all',
                        hyphens: 'none',
                        textAlign: 'center',
                      }}
                    >
                      {lines.map((line) => (
                        <span
                          key={line}
                          style={{
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'visible',
                            textAlign: 'center',
                          }}
                        >
                          {line}
                        </span>
                      ))}
                    </span>
                  </div>
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ApresentacaoKpiHeatCard({
  title,
  metaLabel,
  colunas,
  cells,
}: {
  title: string
  metaLabel: string
  colunas: typeof APRESENTACAO_COLUNAS
  cells: ApresentacaoCell[]
}) {
  const areaCols = colunas.filter((c) => !('consolidado' in c && c.consolidado))
  const consCol = colunas.find((c) => 'consolidado' in c && c.consolidado)
  const consIdx = consCol ? colunas.indexOf(consCol) : -1
  const consCell = consIdx >= 0 ? cells[consIdx] : null

  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        background: '#FFFFFF',
        border: '1px solid #E6E8EB',
        borderRadius: 6,
        padding: CARD_PAD,
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          <col style={{ width: COL_TITLE_WIDTH }} />
          <col style={{ width: COL_META_WIDTH }} />
          {areaCols.map((c) => (
            <col key={c.key} style={{ width: COL_AREA_WIDTH }} />
          ))}
          {consCol ? <col style={{ width: COL_CONS_WIDTH }} /> : null}
        </colgroup>
        <tbody>
          <tr>
            <td
              style={{
                padding: '3px 4px 3px 6px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 600,
                color: '#1F2937',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {toPriMaiuscula(title)}
            </td>
            <td
              style={{
                padding: '3px 2px',
                textAlign: 'left',
                fontSize: 9,
                fontWeight: 500,
                color: '#059669',
                whiteSpace: 'nowrap',
              }}
            >
              {metaTexto(metaLabel)}
            </td>
            {areaCols.map((col) => {
              const idx = colunas.findIndex((c) => c.key === col.key)
              const cell = cells[idx]!
              return (
                <td
                  key={col.key}
                  style={{
                    padding: '3px 2px',
                    textAlign: 'center',
                    fontSize: 10,
                    whiteSpace: 'nowrap',
                    ...cellDivider,
                    ...cellStyle(cell, false),
                  }}
                >
                  {cell.value == null ? '-' : cell.label}
                </td>
              )
            })}
            {consCol && consCell ? (
              <td
                style={{
                  padding: '3px 2px',
                  textAlign: 'center',
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  borderLeft: '2px solid #94A3B8',
                  ...cellStyle(consCell, true),
                }}
              >
                {consCell.value == null ? '-' : consCell.label}
              </td>
            ) : null}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export const ApresentacaoJuridicoSlide = forwardRef(function ApresentacaoJuridicoSlide(
  { colunas, rows, loading }: Props,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      data-apresentacao-slide
      style={{
        width: '100%',
        minWidth: 1100,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        padding: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      {loading ? (
        <div style={{ display: 'grid', gap: 4 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 28,
                borderRadius: 6,
                background: 'rgba(0,0,0,0.06)',
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <ApresentacaoAreaHeader colunas={colunas} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {APRESENTACAO_SECOES.map((secao) => {
              const secaoRows = rows.filter((r) => r.secao === secao.id)
              if (secaoRows.length === 0) return null
              return (
                <div
                  key={secao.id}
                  data-apresentacao-bloco={secao.id}
                  style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
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
                    {secao.label}
                  </div>
                  {secaoRows.map((row) => (
                    <ApresentacaoKpiHeatCard
                      key={row.kpiId}
                      title={TITULO_CURTO[row.kpiId] ?? row.title}
                      metaLabel={row.metaLabel}
                      colunas={colunas}
                      cells={row.cells}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
})
