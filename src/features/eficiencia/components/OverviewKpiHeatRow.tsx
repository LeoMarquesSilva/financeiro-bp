import type { CSSProperties } from 'react'
import { FileSearch } from 'lucide-react'
import { MESES_EFICIENCIA } from '../constants'
import { atingiuMetaKpi, resolveMetaTexto } from '../utils/overviewKpiMeta'

const COL_TITLE_WIDTH = 150
const COL_MES_WIDTH = 60
const COL_ACUM_WIDTH = 64
const TABLE_MIN_WIDTH = COL_TITLE_WIDTH + MESES_EFICIENCIA.length * COL_MES_WIDTH + COL_ACUM_WIDTH
const RACIONAL_SLOT_CLASS = 'flex w-[100px] shrink-0 self-center'

export type HeatCell = {
  /** Valor numérico usado para comparar com a meta (mesma escala da meta). null = sem dados no mês. */
  value: number | null
  /** Texto exibido na célula (já formatado). */
  label: string
}

type Props = {
  title: string
  /** 12 células, Janeiro a Dezembro (ignorado quando `modoAnual`). */
  cells: HeatCell[]
  acumulado: HeatCell
  /** Meta fixa na mesma escala de HeatCell.value (fallback quando metasPorMes não informado). */
  meta: number
  /** Meta por mês (Jan–Dez) para colorir células — ex.: SLA Protocolo com Meta D-1 vigente. */
  metasPorMes?: (number | null)[]
  /** Meta usada na coluna Acum.; padrão = meta fixa ou mínima de metasPorMes. */
  metaAcumulado?: number
  /** Sobrescreve o texto "Meta X%" gerado automaticamente (ex.: "Meta x" quando ainda não definida). */
  metaLabel?: string
  /** Meses (1–12) em destaque no filtro; null/[] = nenhum. */
  mesDestaque?: number | number[] | null
  /**
   * Indicador anual (ex.: Retenção): uma coluna do ano + Acum., sem Jan–Dez.
   * Usa `acumulado` nas duas células de valor.
   */
  modoAnual?: boolean
  /** Rótulo da coluna anual (ex.: "2026"). */
  anoLabel?: string
  /** Quando informado, mostra o botão "Racional" que abre o detalhamento das linhas do indicador. */
  onRacionalClick?: () => void
}

function mesesDestaqueSet(mesDestaque: number | number[] | null): Set<number> | null {
  if (mesDestaque == null) return null
  const list = Array.isArray(mesDestaque) ? mesDestaque : [mesDestaque]
  return list.length > 0 ? new Set(list) : null
}

function cellStyle(cell: HeatCell, meta: number, bold: boolean): CSSProperties {
  if (cell.value == null) {
    return { background: '#FFFFFF', color: '#6B7280', fontWeight: bold ? 700 : 600 }
  }
  const atingiu = atingiuMetaKpi(cell.value, meta) === true
  return {
    background: atingiu ? '#ECFDF3' : '#FEE2E2',
    color: atingiu ? '#059669' : '#DC2626',
    fontWeight: bold ? 700 : 600,
  }
}

const thBase: CSSProperties = {
  padding: 4,
  textAlign: 'center',
  fontSize: 10,
  fontWeight: 600,
  color: '#6B7280',
  borderBottom: '2px solid #E5E7EB',
  width: COL_MES_WIDTH,
}

/** Réplica visual da tabela KPI_HTML_*_MENSAL do BI: título + 12 meses coloridos por meta + coluna Acum. */
export function OverviewKpiHeatRow({
  title,
  cells,
  acumulado,
  meta,
  metasPorMes,
  metaAcumulado,
  metaLabel,
  mesDestaque = null,
  modoAnual = false,
  anoLabel,
  onRacionalClick,
}: Props) {
  const metasDefinidas = (metasPorMes ?? []).filter((m): m is number => m != null)
  const metaFallbackAcum =
    metaAcumulado ??
    (metasDefinidas.length > 0 ? Math.min(...metasDefinidas) : meta)
  const metaTexto = resolveMetaTexto(meta, metaLabel, metasPorMes)

  const metaForCell = (index: number) => metasPorMes?.[index] ?? meta
  const destaque = mesesDestaqueSet(mesDestaque)
  /** Mesma largura total das linhas mensais: título | faixa dos 12 meses | Acum. */
  const colAnoWidth = MESES_EFICIENCIA.length * COL_MES_WIDTH

  return (
    <div className="flex items-stretch gap-2">
      <div
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
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: TABLE_MIN_WIDTH }}>
          <colgroup>
            <col style={{ width: COL_TITLE_WIDTH }} />
            {modoAnual ? (
              <col style={{ width: colAnoWidth }} />
            ) : (
              MESES_EFICIENCIA.map((m) => <col key={m} style={{ width: COL_MES_WIDTH }} />)
            )}
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
                }}
              >
                {title}
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
                MESES_EFICIENCIA.map((m, i) => {
                  const destacado = destaque?.has(i + 1) ?? false
                  return (
                    <th
                      key={m}
                      style={{
                        ...thBase,
                        width: undefined,
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
              <td style={{ padding: '4px 6px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#059669' }}>
                {metaTexto}
              </td>
              {modoAnual ? (
                <td
                  style={{
                    padding: 4,
                    textAlign: 'center',
                    fontSize: 11,
                    ...cellStyle(acumulado, metaFallbackAcum, true),
                  }}
                >
                  {acumulado.value == null ? '-' : acumulado.label}
                </td>
              ) : (
                cells.map((cell, i) => {
                  const destacado = destaque?.has(i + 1) ?? false
                  return (
                    <td
                      key={i}
                      style={{
                        padding: 4,
                        textAlign: 'center',
                        fontSize: 11,
                        ...cellStyle(cell, metaForCell(i), destacado),
                        ...(destaque != null && !destacado ? { opacity: 0.4 } : null),
                        ...(destacado ? { outline: '2px solid #0F172A', outlineOffset: -2 } : null),
                      }}
                    >
                      {cell.value == null ? '-' : cell.label}
                    </td>
                  )
                })
              )}
              <td
                style={{
                  padding: 4,
                  textAlign: 'center',
                  fontSize: 11,
                  borderLeft: '2px solid #E5E7EB',
                  ...cellStyle(acumulado, metaFallbackAcum, true),
                }}
              >
                {acumulado.value == null ? '-' : acumulado.label}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>

      {onRacionalClick ? (
        <button
          type="button"
          onClick={onRacionalClick}
          className={`${RACIONAL_SLOT_CLASS} items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50`}
        >
          <FileSearch className="h-3.5 w-3.5" aria-hidden />
          Racional
        </button>
      ) : (
        <div className={RACIONAL_SLOT_CLASS} aria-hidden />
      )}
    </div>
  )
}
