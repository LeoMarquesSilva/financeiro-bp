import { forwardRef, type CSSProperties, type ReactNode, type Ref } from 'react'
import {
  APRESENTACAO_BLOCOS,
  APRESENTACAO_COLUNAS,
  APRESENTACAO_SECOES,
  type ApresentacaoBlocoId,
  type ApresentacaoCell,
} from '../utils/apresentacaoMatrix'
import type { ApresentacaoMatrixRow } from '../hooks/useApresentacaoMatrix'
import type { ReceitaMesRow } from '@/features/receita/types/receita.types'
import type { ApresentacaoBigNumberData } from '../utils/apresentacaoBigNumber'
import type { ApresentacaoComposicaoData } from '../utils/apresentacaoComposicao'
import type { ApresentacaoControladoriaData } from '../utils/apresentacaoControladoria'
import type { ApresentacaoIniciativasData } from '../utils/apresentacaoIniciativas'
import type { ApresentacaoMarketingData } from '../utils/apresentacaoMarketing'
import type { ApresentacaoFinanceiroOpsData } from '../utils/apresentacaoFinanceiroOps'
import type { MesFiltroEficiencia } from '../constants'
import { ApresentacaoBigNumberBloco } from './ApresentacaoBigNumberBloco'
import { ApresentacaoComposicaoBloco } from './ApresentacaoComposicaoBloco'
import { ApresentacaoControladoriaBloco } from './ApresentacaoControladoriaBloco'
import { ApresentacaoIniciativasBloco } from './ApresentacaoIniciativasBloco'
import { ApresentacaoMarketingBloco } from './ApresentacaoMarketingBloco'
import { ApresentacaoFinanceiroOpsBloco } from './ApresentacaoFinanceiroOpsBloco'
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
  crescimento_receita: 'Crescimento de Receita',
  indice_inadimplencia: 'Índice de Inadimplência',
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
  composicao?: ApresentacaoComposicaoData | null
  receitaRows?: ReceitaMesRow[] | null
  bigNumber?: ApresentacaoBigNumberData | null
  controladoria?: ApresentacaoControladoriaData | null
  iniciativas?: ApresentacaoIniciativasData | null
  marketing?: ApresentacaoMarketingData | null
  financeiroOps?: ApresentacaoFinanceiroOpsData | null
  ano: number
  loading?: boolean
  loadingComposicao?: boolean
  loadingBigNumber?: boolean
  loadingControladoria?: boolean
  loadingIniciativas?: boolean
  loadingMarketing?: boolean
  loadingFinanceiroOps?: boolean
  bigNumberError?: Error | null
  controladoriaError?: Error | null
  iniciativasError?: Error | null
  marketingError?: Error | null
  financeiroOpsError?: Error | null
  bigNumberMesInicio?: number
  bigNumberMesFim?: number
  onBigNumberMesInicioChange?: (mes: number) => void
  onBigNumberMesFimChange?: (mes: number) => void
  iniciativasMesFiltro?: MesFiltroEficiencia
  onIniciativasMesFiltroChange?: (mes: MesFiltroEficiencia) => void
  marketingMesFiltro?: MesFiltroEficiencia
  onMarketingMesFiltroChange?: (mes: MesFiltroEficiencia) => void
  financeiroOpsMesFiltro?: MesFiltroEficiencia
  onFinanceiroOpsMesFiltroChange?: (mes: MesFiltroEficiencia) => void
}

/** Separador visual entre blocos (fora do export PPT). */
function BlocoSeparator({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        margin: '4px 0',
        userSelect: 'none',
      }}
    >
      <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, transparent, #C6A361, #D5B170)' }} />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#64748B',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #D5B170, #C6A361, transparent)' }} />
    </div>
  )
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

function BlocoExport({
  blocoId,
  colunas,
  rows,
}: {
  blocoId: ApresentacaoBlocoId
  colunas: typeof APRESENTACAO_COLUNAS
  rows: ApresentacaoMatrixRow[]
}) {
  const bloco = APRESENTACAO_BLOCOS.find((b) => b.id === blocoId)
  if (!bloco || bloco.semGradeAreas) return null
  const secoes = APRESENTACAO_SECOES.filter((s) => bloco.secoes.includes(s.id))

  return (
    <div
      data-apresentacao-export={blocoId}
      style={{
        width: '100%',
        minWidth: 1100,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        padding: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <ApresentacaoAreaHeader colunas={colunas} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {secoes.map((secao) => {
          const secaoRows = rows.filter((r) => r.secao === secao.id)
          if (secaoRows.length === 0) return null
          return (
            <div
              key={secao.id}
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
    </div>
  )
}

export const ApresentacaoJuridicoSlide = forwardRef(function ApresentacaoJuridicoSlide(
  {
    colunas,
    rows,
    composicao = null,
    receitaRows = null,
    bigNumber = null,
    controladoria = null,
    iniciativas = null,
    marketing = null,
    financeiroOps = null,
    ano,
    loading,
    loadingComposicao = false,
    loadingBigNumber = false,
    loadingControladoria = false,
    loadingIniciativas = false,
    loadingMarketing = false,
    loadingFinanceiroOps = false,
    bigNumberError = null,
    controladoriaError = null,
    iniciativasError = null,
    marketingError = null,
    financeiroOpsError = null,
    bigNumberMesInicio = 1,
    bigNumberMesFim = 6,
    onBigNumberMesInicioChange,
    onBigNumberMesFimChange,
    iniciativasMesFiltro = null,
    onIniciativasMesFiltroChange,
    marketingMesFiltro = null,
    onMarketingMesFiltroChange,
    financeiroOpsMesFiltro = null,
    onFinanceiroOpsMesFiltroChange,
  }: Props,
  ref: Ref<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      data-apresentacao-slide
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {APRESENTACAO_BLOCOS.map((bloco, index) => {
        let content: ReactNode = null

        if (bloco.id === 'composicao') {
          content = (
            <ApresentacaoComposicaoBloco
              data={composicao}
              receitaRows={receitaRows}
              ano={ano}
              loading={loadingComposicao || !composicao}
            />
          )
        } else if (bloco.id === 'bignumber') {
          content = (
            <ApresentacaoBigNumberBloco
              data={bigNumber}
              loading={loadingBigNumber}
              error={bigNumberError}
              ano={ano}
              mesInicio={bigNumberMesInicio}
              mesFim={bigNumberMesFim}
              onMesInicioChange={onBigNumberMesInicioChange ?? (() => {})}
              onMesFimChange={onBigNumberMesFimChange ?? (() => {})}
            />
          )
        } else if (bloco.id === 'controladoria') {
          content = (
            <ApresentacaoControladoriaBloco
              data={controladoria}
              loading={loadingControladoria}
              error={controladoriaError}
            />
          )
        } else if (bloco.id === 'iniciativas') {
          content = (
            <ApresentacaoIniciativasBloco
              data={iniciativas}
              loading={loadingIniciativas}
              error={iniciativasError}
              ano={ano}
              mesFiltro={iniciativasMesFiltro}
              onMesFiltroChange={onIniciativasMesFiltroChange ?? (() => {})}
            />
          )
        } else if (bloco.id === 'marketing') {
          content = (
            <ApresentacaoMarketingBloco
              data={marketing}
              loading={loadingMarketing}
              error={marketingError}
              ano={ano}
              mesFiltro={marketingMesFiltro}
              onMesFiltroChange={onMarketingMesFiltroChange ?? (() => {})}
            />
          )
        } else if (bloco.id === 'financeiro_ops') {
          content = (
            <ApresentacaoFinanceiroOpsBloco
              data={financeiroOps}
              loading={loadingFinanceiroOps}
              error={financeiroOpsError}
              ano={ano}
              mesFiltro={financeiroOpsMesFiltro}
              onMesFiltroChange={onFinanceiroOpsMesFiltroChange ?? (() => {})}
            />
          )
        } else if (loading) {
          content = (
            <div style={{ display: 'grid', gap: 4, padding: 4 }}>
              {Array.from({ length: 3 }, (_, i) => (
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
          )
        } else {
          content = (
            <BlocoExport blocoId={bloco.id} colunas={colunas} rows={rows} />
          )
        }

        return (
          <div key={bloco.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {index > 0 ? <BlocoSeparator label={bloco.label} /> : null}
            {content}
          </div>
        )
      })}
    </div>
  )
})
