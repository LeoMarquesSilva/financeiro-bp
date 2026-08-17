import type { CSSProperties, ReactNode } from 'react'
import { FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MESES_EFICIENCIA } from '../constants'
import {
  atingiuMetaKpi,
  resolveMetaTexto,
  type MetaComparacaoKpi,
} from '../utils/overviewKpiMeta'
import { toPriMaiuscula } from '../utils/textFormat'

const COL_TITLE_WIDTH = 150
const COL_MES_WIDTH = 60
const COL_ACUM_WIDTH = 64
export const OVERVIEW_RACIONAL_SLOT_WIDTH = 100
const RACIONAL_SLOT_CLASS = 'flex w-[100px] shrink-0 self-center'

export type OverviewKpiHeatCardProps = Omit<Props, 'onRacionalClick'>

export function OverviewRacionalButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        RACIONAL_SLOT_CLASS,
        'items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50',
        className,
      )}
    >
      <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Racional
    </button>
  )
}

export function OverviewRacionalSpacer() {
  return <div className={RACIONAL_SLOT_CLASS} aria-hidden />
}

export type HeatCell = {
  /** Valor numérico usado para comparar com a meta (mesma escala da meta). null = sem dados no mês. */
  value: number | null
  /** Texto principal exibido na célula (linha de cima quando há subLabel). */
  label: string
  /** Segunda linha (ex.: % abaixo das horas em Desenvolvimento Equipe). */
  subLabel?: string
}

type Props = {
  title: string
  /** Células mensais (12 Jan–Dez, ou N colunas quando `monthLabels` é informado). */
  cells: HeatCell[]
  acumulado: HeatCell
  /** Meta fixa na mesma escala de HeatCell.value (fallback quando metasPorMes não informado). */
  meta: number
  /** Meta por mês (alinhada a `cells`) para colorir células — ex.: SLA Protocolo com Meta D-1 vigente. */
  metasPorMes?: (number | null)[]
  /** Meta usada na coluna Acum.; padrão = meta fixa ou mínima de metasPorMes. */
  metaAcumulado?: number
  /** Sobrescreve o texto "Meta X%" gerado automaticamente (ex.: "Meta x" quando ainda não definida). */
  metaLabel?: string
  /** `maximo` = menor valor atinge a meta (ex.: inadimplência). Default `minimo`. */
  metaComparacao?: MetaComparacaoKpi
  /** Meses (1–12) em destaque no filtro; null/[] = nenhum. Ignorado com `monthLabels`. */
  mesDestaque?: number | number[] | null
  /**
   * Indicador anual (ex.: Retenção): uma coluna do ano + Acum., sem Jan–Dez.
   * Usa `acumulado` nas duas células de valor.
   */
  modoAnual?: boolean
  /** Rótulo da coluna anual (ex.: "2026"). */
  anoLabel?: string
  /**
   * Cabeçalhos customizados (ex.: Jan/25, Fev/25). Quando informado, `cells` deve ter
   * o mesmo length — usado no Jurídico Unificado multi-ano.
   */
  monthLabels?: readonly string[]
  /**
   * Quando informado, cada célula do body ocupa N colunas do cabeçalho (ex.: Retenção
   * anual fundindo os meses de cada ano no intervalo). `cells.length` = grupos;
   * soma dos spans = `monthLabels.length` (ou 12).
   * Preferir `yearBands` no export PPT — `colspan` desalinha no html2canvas.
   */
  cellColSpans?: number[]
  /**
   * Faixa contínua por ano (1 `<td>` por mês, sem colspan). Visual de pílula alinhada
   * ao cabeçalho — seguro no preview e na cola PPT.
   */
  yearBands?: boolean
  /** Quando false, omite a coluna Acum. (ex.: Jurídico Unificado). Default true. */
  showAcumulado?: boolean
  /** Quando informado, mostra o botão "Racional" que abre o detalhamento das linhas do indicador. */
  onRacionalClick?: () => void
}

function mesesDestaqueSet(mesDestaque: number | number[] | null): Set<number> | null {
  if (mesDestaque == null) return null
  const list = Array.isArray(mesDestaque) ? mesDestaque : [mesDestaque]
  return list.length > 0 ? new Set(list) : null
}

const CELL_FONT_MONTH = 600
const CELL_FONT_ACUM = 700

function cellStyle(
  cell: HeatCell,
  meta: number,
  comparacao: MetaComparacaoKpi = 'minimo',
  fontWeight: number = CELL_FONT_MONTH,
): CSSProperties {
  if (cell.value == null) {
    return { background: '#FFFFFF', color: '#6B7280', fontWeight }
  }
  const atingiu = atingiuMetaKpi(cell.value, meta, comparacao) === true
  return {
    background: atingiu ? '#ECFDF3' : '#FEE2E2',
    color: atingiu ? '#059669' : '#DC2626',
    fontWeight,
  }
}

const thBase: CSSProperties = {
  padding: 4,
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
  borderBottom: '2px solid #E5E7EB',
  width: COL_MES_WIDTH,
}

function yearSuffixFromLabel(label: string): string | null {
  const m = label.match(/\/(\d{2})$/)
  return m?.[1] ?? null
}

function isYearBreakAt(labels: readonly string[], index: number): boolean {
  if (index <= 0 || !labels[index] || !labels[index - 1]) return false
  const prev = yearSuffixFromLabel(labels[index - 1]!)
  const cur = yearSuffixFromLabel(labels[index]!)
  return prev != null && cur != null && prev !== cur
}

/** Separação suave entre anos (ex.: Dez/25 | Jan/26). */
const YEAR_GAP: CSSProperties = {
  borderLeft: '3px solid #FFFFFF',
}

type YearBandRole = 'alone' | 'start' | 'middle' | 'end'

function yearBandRole(labels: readonly string[], index: number): YearBandRole {
  const atStart = index === 0 || isYearBreakAt(labels, index)
  const atEnd =
    index === labels.length - 1 || isYearBreakAt(labels, index + 1)
  if (atStart && atEnd) return 'alone'
  if (atStart) return 'start'
  if (atEnd) return 'end'
  return 'middle'
}

function yearBandCellPad(role: YearBandRole, yearBreak: boolean): string {
  const left = yearBreak ? 6 : role === 'start' || role === 'alone' ? 2 : 0
  const right = role === 'end' || role === 'alone' ? 2 : 0
  return `2px ${right}px 2px ${left}px`
}

function yearBandRadius(role: YearBandRole): string {
  if (role === 'alone') return '6px'
  if (role === 'start') return '6px 0 0 6px'
  if (role === 'end') return '0 6px 6px 0'
  return '0'
}

function renderHeatCellContent(cell: HeatCell): ReactNode {
  if (cell.value == null) return '-'
  if (!cell.subLabel) return cell.label
  return (
    <span
      data-heat-cell-stacked="1"
      style={{ display: 'block', lineHeight: 1.15, textAlign: 'center' }}
    >
      <span data-heat-cell-stacked-primary="1" style={{ display: 'block' }}>
        {cell.label}
      </span>
      <span
        data-heat-cell-stacked-secondary="1"
        style={{ display: 'block', fontSize: '0.88em' }}
      >
        {cell.subLabel}
      </span>
    </span>
  )
}

function heatCellStackedAttr(cell: HeatCell): { 'data-heat-cell-stacked'?: '1' } {
  return cell.subLabel ? { 'data-heat-cell-stacked': '1' } : {}
}

/** Réplica visual da tabela KPI_HTML_*_MENSAL do BI: título + 12 meses coloridos por meta + coluna Acum. */
export function OverviewKpiHeatCard({
  title,
  cells,
  acumulado,
  meta,
  metasPorMes,
  metaAcumulado,
  metaLabel,
  metaComparacao = 'minimo',
  mesDestaque = null,
  modoAnual = false,
  anoLabel,
  monthLabels,
  cellColSpans,
  yearBands = false,
  showAcumulado = true,
}: OverviewKpiHeatCardProps) {
  const metasDefinidas = (metasPorMes ?? []).filter((m): m is number => m != null)
  const metaFallbackAcum =
    metaAcumulado ??
    (metasDefinidas.length > 0 ? Math.min(...metasDefinidas) : meta)
  const metaTexto = resolveMetaTexto(meta, metaLabel, metasPorMes)

  const metaForCell = (index: number) => metasPorMes?.[index] ?? meta
  const destaque = monthLabels ? null : mesesDestaqueSet(mesDestaque)
  const labels = monthLabels ?? MESES_EFICIENCIA
  const colAnoWidth = labels.length * COL_MES_WIDTH
  const tableMinWidth =
    COL_TITLE_WIDTH +
    labels.length * COL_MES_WIDTH +
    (showAcumulado ? COL_ACUM_WIDTH : 0)

  return (
    <div
      data-overview-copy-card
      data-overview-kpi-title={title}
      data-chart-export-preserve-bg
      style={{
        flex: 1,
        minWidth: 0,
        background: '#FFFFFF',
        border: '1px solid #E6E8EB',
        borderRadius: 8,
        padding: 8,
        boxShadow: '0 2px 4px rgba(15,23,42,0.06)',
      }}
    >
      <div className="overflow-x-auto">
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            minWidth: tableMinWidth,
          }}
        >
          <colgroup>
            <col style={{ width: COL_TITLE_WIDTH }} />
            {modoAnual ? (
              <col style={{ width: colAnoWidth }} />
            ) : (
              labels.map((m) => <col key={m} style={{ width: COL_MES_WIDTH }} />)
            )}
            {showAcumulado ? <col style={{ width: COL_ACUM_WIDTH }} /> : null}
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
                }}
              >
                {toPriMaiuscula(title)}
              </th>
              {modoAnual ? (
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
                  {anoLabel ?? 'Ano'}
                </th>
              ) : (
                labels.map((m, i) => {
                  const destacado = destaque?.has(i + 1) ?? false
                  const yearBreak = Boolean(monthLabels) && isYearBreakAt(labels, i)
                  return (
                    <th
                      key={`${m}-${i}`}
                      style={{
                        ...thBase,
                        width: undefined,
                        fontSize: monthLabels ? 10 : 12,
                        ...(yearBreak ? YEAR_GAP : null),
                        ...(destacado
                          ? { color: '#0F172A', borderBottom: '2px solid #0F172A', fontWeight: 700 }
                          : destaque != null
                            ? { opacity: 0.45 }
                            : null),
                      }}
                    >
                      {m}
                    </th>
                  )
                })
              )}
              {showAcumulado ? (
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
              ) : null}
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
                  lineHeight: 1.35,
                }}
              >
                {metaTexto}
              </td>
              {modoAnual ? (
                <td
                  {...heatCellStackedAttr(acumulado)}
                  style={{
                    padding: 4,
                    textAlign: 'center',
                    fontSize: 11,
                    ...cellStyle(
                      acumulado,
                      metaFallbackAcum,
                      metaComparacao,
                      CELL_FONT_ACUM,
                    ),
                  }}
                >
                  {renderHeatCellContent(acumulado)}
                </td>
              ) : cellColSpans && cellColSpans.length > 0 ? (
                cells.map((cell, i) => {
                  const span = Math.max(1, cellColSpans[i] ?? 1)
                  const st = cellStyle(cell, metaForCell(i), metaComparacao)
                  /** Cartões por ano via colspan — evitar no export PPT (desalinha). */
                  return (
                    <td
                      key={i}
                      colSpan={span}
                      {...heatCellStackedAttr(cell)}
                      style={{
                        padding: i > 0 ? '2px 2px 2px 6px' : '2px 2px 2px 2px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        background: 'transparent',
                      }}
                    >
                      <div
                        style={{
                          ...st,
                          width: '100%',
                          boxSizing: 'border-box',
                          borderRadius: 6,
                          padding: '5px 8px',
                          border: '1px solid rgba(15,23,42,0.08)',
                          minHeight: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        {renderHeatCellContent(cell)}
                      </div>
                    </td>
                  )
                })
              ) : yearBands ? (
                cells.map((cell, i) => {
                  const yearBreak = Boolean(monthLabels) && isYearBreakAt(labels, i)
                  const role = yearBandRole(labels, i)
                  const st = cellStyle(cell, metaForCell(i), metaComparacao)
                  const showText = renderHeatCellContent(cell)
                  return (
                    <td
                      key={i}
                      {...heatCellStackedAttr(cell)}
                      style={{
                        padding: yearBandCellPad(role, yearBreak),
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        background: 'transparent',
                        ...(yearBreak ? YEAR_GAP : null),
                      }}
                    >
                      <div
                        data-year-band-pill
                        data-year-band-group={yearSuffixFromLabel(labels[i]!) ?? `i${i}`}
                        data-band-bg={String(st.background ?? '#FEE2E2')}
                        data-band-fg={String(st.color ?? '#DC2626')}
                        style={{
                          ...st,
                          width: '100%',
                          boxSizing: 'border-box',
                          borderRadius: yearBandRadius(role),
                          padding: '5px 4px',
                          borderTop: '1px solid rgba(15,23,42,0.08)',
                          borderBottom: '1px solid rgba(15,23,42,0.08)',
                          borderLeft:
                            role === 'start' || role === 'alone'
                              ? '1px solid rgba(15,23,42,0.08)'
                              : 'none',
                          borderRight:
                            role === 'end' || role === 'alone'
                              ? '1px solid rgba(15,23,42,0.08)'
                              : 'none',
                          minHeight: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        {showText}
                      </div>
                    </td>
                  )
                })
              ) : (
                cells.map((cell, i) => {
                  const destacado = destaque?.has(i + 1) ?? false
                  const yearBreak = Boolean(monthLabels) && isYearBreakAt(labels, i)
                  return (
                    <td
                      key={i}
                      {...heatCellStackedAttr(cell)}
                      style={{
                        padding: 4,
                        textAlign: 'center',
                        fontSize: 11,
                        ...cellStyle(cell, metaForCell(i), metaComparacao),
                        ...(yearBreak ? YEAR_GAP : null),
                        ...(destaque != null && !destacado ? { opacity: 0.4 } : null),
                        ...(destacado ? { outline: '2px solid #0F172A', outlineOffset: -2 } : null),
                      }}
                    >
                      {renderHeatCellContent(cell)}
                    </td>
                  )
                })
              )}
              {showAcumulado ? (
                <td
                  {...heatCellStackedAttr(acumulado)}
                  style={{
                    padding: 4,
                    textAlign: 'center',
                    fontSize: 11,
                    borderLeft: '2px solid #E5E7EB',
                    ...cellStyle(
                      acumulado,
                      metaFallbackAcum,
                      metaComparacao,
                      CELL_FONT_ACUM,
                    ),
                  }}
                >
                  {renderHeatCellContent(acumulado)}
                </td>
              ) : null}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function OverviewKpiHeatRow({
  onRacionalClick,
  ...cardProps
}: Props) {
  return (
    <div className="flex items-stretch gap-2">
      <OverviewKpiHeatCard {...cardProps} />
      {onRacionalClick ? (
        <OverviewRacionalButton onClick={onRacionalClick} />
      ) : (
        <OverviewRacionalSpacer />
      )}
    </div>
  )
}
