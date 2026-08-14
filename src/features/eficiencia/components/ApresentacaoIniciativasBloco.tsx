import { formatPercent } from '@/shared/utils/format'
import type { MesFiltroEficiencia } from '../constants'
import type { ApresentacaoIniciativasData } from '../utils/apresentacaoIniciativas'
import { MesFilterButtons } from './MesFilterButtons'

const GOLD_DARK = '#C6A361'
const HIGHLIGHT_BG = '#FEF3C7'
const HIGHLIGHT_BORDER = '#F59E0B'

type Props = {
  data: ApresentacaoIniciativasData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mesFiltro: MesFiltroEficiencia
  onMesFiltroChange: (mes: MesFiltroEficiencia) => void
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

export function ApresentacaoIniciativasBloco({
  data,
  loading,
  error,
  ano,
  mesFiltro,
  onMesFiltroChange,
}: Props) {
  return (
    <div
      style={{
        width: '100%',
        minWidth: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      {/* Controles — fora do export PPT */}
      <div
        data-chart-export-ignore
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
          Período Iniciativas (independente do filtro global)
        </span>
        <MesFilterButtons
          value={mesFiltro}
          onChange={onMesFiltroChange}
          showSemanas={false}
          showResultado={false}
          showDiaPicker={false}
          ano={ano}
        />
      </div>

    <div
      data-apresentacao-export="iniciativas"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {error && !data ? (
        <div
          style={{
            borderRadius: 8,
            border: '1px solid #FECACA',
            background: '#FEF2F2',
            padding: '12px 14px',
            fontSize: 12,
            color: '#B91C1C',
          }}
        >
          Não foi possível carregar Iniciativas
          {error.message ? `: ${error.message}` : '.'}
        </div>
      ) : loading || !data ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>Carregando Iniciativas…</div>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              style={{ height: 40, borderRadius: 8, background: 'rgba(0,0,0,0.06)' }}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {[
              {
                label: '% da meta anual',
                value: data.totais.pct_progresso_label,
              },
              { label: 'Entregas no período', value: fmt(data.totais.total) },
              { label: 'Projetos', value: fmt(data.totais.projetos) },
              { label: 'Melhorias', value: fmt(data.totais.melhorias) },
            ].map((c) => (
              <div
                key={c.label}
                data-overview-copy-card
                data-chart-export-preserve-bg
                style={{
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  padding: '10px 12px',
                  printColorAdjust: 'exact',
                  WebkitPrintColorAdjust: 'exact',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#64748B',
                    marginBottom: 6,
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#0F172A',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.value}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                  Meta {data.meta}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
              gap: 10,
              alignItems: 'start',
            }}
          >
            {/* Evolução mensal */}
            <div
              data-overview-copy-card
              data-chart-export-preserve-bg
              style={{
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                padding: '10px 12px',
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: '#0F172A',
                  marginBottom: 8,
                }}
              >
                Evolução mês a mês
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: GOLD_DARK, color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700 }}>
                      Mês
                    </th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700 }}>
                      Total
                    </th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700 }}>
                      Proj.
                    </th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700 }}>
                      Melh.
                    </th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700 }}>
                      % acum.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.evolucaoAtiva.map((r, i) => (
                    <tr
                      key={r.mes}
                      style={{
                        background: r.destaque
                          ? HIGHLIGHT_BG
                          : i % 2 === 1
                            ? '#F8FAFC'
                            : '#FFF',
                        boxShadow: r.destaque
                          ? `inset 3px 0 0 ${HIGHLIGHT_BORDER}`
                          : undefined,
                        fontWeight: r.destaque ? 700 : 400,
                      }}
                    >
                      <td style={{ padding: '4px 6px', color: '#334155' }}>
                        {r.mesLabel}
                        {r.destaque ? ' ★' : ''}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(r.total)}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(r.projetos)}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmt(r.melhorias)}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.pctYtdLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Entregas */}
            <div
              data-overview-copy-card
              data-chart-export-preserve-bg
              style={{
                borderRadius: 10,
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                padding: '10px 12px',
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  color: '#0F172A',
                  marginBottom: 4,
                }}
              >
                Projetos / Melhorias entregues
              </div>
              <div style={{ fontSize: 10, color: '#64748B', marginBottom: 8 }}>
                Destacados: entregas de {data.mesDestaqueLabel} ·{' '}
                {fmt(data.entregas.filter((e) => e.destaque).length)} no mês
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: GOLD_DARK, color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700 }}>
                      Entrega
                    </th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700 }}>
                      Tipo
                    </th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700 }}>
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entregas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        style={{ padding: '10px 6px', color: '#94A3B8', textAlign: 'center' }}
                      >
                        Nenhuma entrega no período
                      </td>
                    </tr>
                  ) : (
                    data.entregas.map((e, i) => (
                      <tr
                        key={e.id}
                        style={{
                          background: e.destaque
                            ? HIGHLIGHT_BG
                            : i % 2 === 1
                              ? '#F8FAFC'
                              : '#FFF',
                          boxShadow: e.destaque
                            ? `inset 3px 0 0 ${HIGHLIGHT_BORDER}`
                            : undefined,
                          fontWeight: e.destaque ? 700 : 400,
                        }}
                      >
                        <td
                          style={{
                            padding: '4px 6px',
                            color: '#0F172A',
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={e.nome}
                        >
                          {e.nome}
                        </td>
                        <td style={{ padding: '4px 6px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {e.tipo}
                        </td>
                        <td
                          style={{
                            padding: '4px 6px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {e.dataLabel}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {data.entregas.some((e) => e.destaque) ? null : (
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
                  Sem entregas em {data.mesDestaqueLabel} — % acum. do mês:{' '}
                  {formatPercent(
                    data.evolucao.find((m) => m.mes === data.mesDestaque)?.pctYtd ?? 0,
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  )
}
