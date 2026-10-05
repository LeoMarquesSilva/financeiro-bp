import { MESES_EFICIENCIA, type MesFiltroEficiencia } from '../constants'
import {
  type ApresentacaoIniciativasData,
  type IniciativasMesEvo,
} from '../utils/apresentacaoIniciativas'
import { MesFilterButtons } from './MesFilterButtons'

const GOLD = '#D5B170'
const GOLD_DARK = '#C6A361'
const HEADER_BG = '#333f48'

function cellBg(atingiu: boolean): { background: string; color: string } {
  if (atingiu) return { background: '#ECFDF3', color: '#059669' }
  return { background: '#FEE2E2', color: '#DC2626' }
}
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

function IniciativasEvolucaoFaixa({
  meses,
  pctAnualLabel,
}: {
  meses: IniciativasMesEvo[]
  pctAnualLabel: string
}) {
  const soma = meses.reduce((s, r) => s + r.total, 0)
  const metaProporcional = meses.reduce((s, r) => s + r.metaMensal, 0)
  const acumStyle = cellBg(metaProporcional > 0 && soma >= metaProporcional)
  const colunas = `minmax(280px, 1.6fr) repeat(${Math.max(meses.length, 1)}, minmax(52px, 1fr)) minmax(88px, 0.9fr)`

  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        display: 'grid',
        gridTemplateColumns: colunas,
        gap: 4,
        width: '100%',
        alignItems: 'stretch',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div />
        {meses.map((m) => (
          <div
            key={m.mes}
            style={{
              background: m.destaque ? GOLD : HEADER_BG,
              color: m.destaque ? '#1F2937' : '#fff',
              borderRadius: 6,
              padding: '6px 4px',
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {MESES_EFICIENCIA[m.mes - 1] ?? String(m.mes)}
          </div>
        ))}
        <div
          style={{
            background: GOLD,
            color: '#1F2937',
            borderRadius: 6,
            padding: '6px 4px',
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          ACUMULADO
        </div>
        <div
          data-iniciativas-faixa-rotulo
          style={{
            display: 'grid',
            placeItems: 'center',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '8px 12px',
            textAlign: 'center',
          }}
        >
          <div
            data-iniciativas-faixa-titulo
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#1F2937',
              lineHeight: 1.2,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            Iniciativas Estratégicas
          </div>
        </div>

        {meses.map((m) => {
          const st = cellBg(m.atingiu)
          return (
            <div
              key={m.mes}
              style={{
                ...st,
                border: m.destaque ? `2px solid ${GOLD_DARK}` : '1px solid #E2E8F0',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '4px 2px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <div
                style={{
                  width: '100%',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {fmt(m.total)} / {m.metaMensal}
              </div>
              <div
                style={{
                  width: '100%',
                  fontSize: 7,
                  fontWeight: 600,
                  lineHeight: 1.05,
                  color: st.color,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {m.pctMesLabel}
              </div>
            </div>
          )
        })}

        <div
          style={{
            background: '#F8F1E3',
            border: `2px solid ${acumStyle.color}`,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 4px',
            gap: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div
            style={{
              width: '100%',
              fontSize: 16,
              fontWeight: 800,
              color: acumStyle.color,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
              textAlign: 'center',
            }}
          >
            {pctAnualLabel}
          </div>
        </div>
    </div>
  )
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
          <IniciativasEvolucaoFaixa
            meses={data.evolucaoAtiva}
            pctAnualLabel={data.totais.pct_progresso_label}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
              gap: 10,
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          ? '#F5F0E6'
                          : i % 2 === 1
                            ? '#F8FAFC'
                            : '#FFF',
                        fontWeight: r.destaque ? 700 : 400,
                      }}
                    >
                      <td style={{ padding: '4px 6px', color: '#334155' }}>{r.mesLabel}</td>
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 6,
              }}
            >
              {[
                {
                  label: '% da meta anual',
                  value: data.totais.pct_progresso_label,
                },
                { label: 'Iniciativas Estratégicas', value: fmt(data.totais.total) },
                { label: 'Projetos', value: fmt(data.totais.projetos) },
                { label: 'Melhorias', value: fmt(data.totais.melhorias) },
              ].map((c) => (
                <div
                  key={c.label}
                  data-overview-copy-card
                  data-chart-export-preserve-bg
                  style={{
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    padding: '6px 8px',
                    textAlign: 'center',
                    printColorAdjust: 'exact',
                    WebkitPrintColorAdjust: 'exact',
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: '#64748B',
                      marginBottom: 2,
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#0F172A',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.1,
                      textAlign: 'center',
                    }}
                  >
                    {c.value}
                  </div>
                  <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>
                    Meta {data.meta}
                  </div>
                </div>
              ))}
            </div>
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
              <table
                data-iniciativas-entregas
                style={{
                  width: '100%',
                  tableLayout: 'fixed',
                  borderCollapse: 'collapse',
                  fontSize: 11,
                  marginTop: 8,
                }}
              >
                <thead>
                  <tr style={{ background: GOLD_DARK, color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, width: '64%' }}>
                      Entrega
                    </th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700, width: '18%' }}>
                      Tipo
                    </th>
                    <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 700, width: '18%' }}>
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
                        data-iniciativas-entrega-destaque={e.destaque ? 'true' : undefined}
                        style={{
                          background: e.destaque
                            ? '#F5F0E6'
                            : i % 2 === 1
                              ? '#F8FAFC'
                              : '#FFF',
                          fontWeight: e.destaque ? 700 : 400,
                          boxShadow: e.destaque ? `inset 3px 0 0 ${GOLD_DARK}` : undefined,
                        }}
                      >
                        <td
                          data-iniciativas-entrega-nome
                          style={{
                            padding: '4px 6px',
                            color: '#0F172A',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 0,
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
            </div>
          </div>
        </>
      )}
    </div>
    </div>
  )
}
