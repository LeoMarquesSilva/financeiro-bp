import { formatCurrency, formatPercent } from '@/shared/utils/format'
import { RECEITA_DEPARTAMENTO_CORES } from '@/features/receita/constants'
import { ReceitaComparativoChart } from '@/features/receita/components/ReceitaComparativoChart'
import type { ReceitaMesRow } from '@/features/receita/types/receita.types'
import type { ApresentacaoComposicaoData } from '../utils/apresentacaoComposicao'

type Props = {
  data: ApresentacaoComposicaoData | null
  receitaRows?: ReceitaMesRow[] | null
  ano: number
  loading?: boolean
}

function KpiChip({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 120,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

function CompLinha({
  label,
  value,
  color,
  strong,
  borderTop,
}: {
  label: string
  value: string
  color: string
  strong?: boolean
  borderTop?: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) max-content',
        alignItems: 'baseline',
        gap: 8,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        padding: strong ? '8px 0 0' : '4px 0',
        borderTop: borderTop ? '1px solid #E2E8F0' : undefined,
        marginTop: borderTop ? 4 : 0,
      }}
    >
      <span
        style={{
          fontSize: strong ? 11 : 10,
          fontWeight: strong ? 700 : 500,
          color: strong ? color : '#334155',
          flex: '1 1 auto',
          minWidth: 0,
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: strong ? 11 : 10,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          textAlign: 'right',
          marginRight: 12,
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function ApresentacaoComposicaoBloco({
  data,
  receitaRows = null,
  ano,
  loading,
}: Props) {
  return (
    <div
      data-apresentacao-export="composicao"
      style={{
        width: '100%',
        minWidth: 1100,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        padding: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {loading || !data ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              style={{ height: 36, borderRadius: 8, background: 'rgba(0,0,0,0.06)' }}
            />
          ))}
        </div>
      ) : (
        <>
        {receitaRows && receitaRows.length > 0 ? (
          <ReceitaComparativoChart
            rows={receitaRows}
            ano={ano}
            departamentoCores={RECEITA_DEPARTAMENTO_CORES}
            apresentacaoMode
          />
        ) : null}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 12,
            alignItems: 'start',
          }}
        >
          {/* Novas Receitas — Contratos */}
          <div
            data-overview-copy-card
            data-chart-export-preserve-bg
            style={{
              borderRadius: 10,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              padding: '12px 14px',
              minWidth: 0,
              overflow: 'visible',
              boxSizing: 'border-box',
              printColorAdjust: 'exact',
              WebkitPrintColorAdjust: 'exact',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#0F172A',
                marginBottom: 10,
              }}
            >
              Novas Receitas — Contratos
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <KpiChip label="Recebido" value={formatCurrency(data.recebido)} color="#2563EB" />
              <KpiChip label="Meta" value={formatCurrency(data.meta)} color="#16A34A" />
              <KpiChip label="Previsto" value={formatCurrency(data.previsto)} color="#7C3AED" />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#334155',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Clientes novos
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  marginRight: 12,
                }}
              >
                {formatCurrency(data.novosContratos)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {data.gruposNovos.length === 0 ? (
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Sem novos contratos no mês</span>
              ) : (
                data.gruposNovos.slice(0, 12).map((g) => (
                  <div
                    key={g.grupo}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) max-content',
                      gap: 10,
                      fontSize: 11,
                      lineHeight: 1.35,
                    }}
                  >
                    <span
                      style={{
                        color: '#475569',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                        minWidth: 0,
                      }}
                    >
                      {g.grupo}
                    </span>
                    <span
                      style={{
                        color: '#0F172A',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      flexShrink: 0,
                      textAlign: 'right',
                        fontSize: 10,
                        marginRight: 12,
                      }}
                    >
                      {formatCurrency(g.total)}{' '}
                      <span style={{ color: '#64748B', fontWeight: 500 }}>
                        ({formatPercent(g.pct)})
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Composição da Receita Realizada */}
          <div
            data-overview-copy-card
            data-chart-export-preserve-bg
            style={{
              borderRadius: 10,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              padding: '12px 14px',
              minWidth: 0,
              overflow: 'visible',
              boxSizing: 'border-box',
              printColorAdjust: 'exact',
              WebkitPrintColorAdjust: 'exact',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#0F172A',
                marginBottom: 10,
              }}
            >
              Composição da Receita Realizada
            </div>

            <CompLinha label="Meta" value={formatCurrency(data.meta)} color="#16A34A" />
            <CompLinha
              label="Inadimplência"
              value={formatCurrency(data.inadimplencia)}
              color="#DC2626"
            />
            <CompLinha
              label="Novos Contratos"
              value={formatCurrency(data.novosContratos)}
              color="#334155"
              borderTop
            />
            <CompLinha
              label="Esforço de Receita Não Prevista"
              value={formatCurrency(data.esforcoNaoPrevista)}
              color="#334155"
            />
            <CompLinha
              label="Receita Realizada"
              value={formatCurrency(data.recebido)}
              color="#2563EB"
              strong
              borderTop
            />
            <CompLinha
              label="Receita Realizada + Inadimplência"
              value={formatCurrency(data.receitaMaisInadimplencia)}
              color="#16A34A"
              strong
              borderTop
            />
          </div>
        </div>
        </>
      )}
    </div>
  )
}
