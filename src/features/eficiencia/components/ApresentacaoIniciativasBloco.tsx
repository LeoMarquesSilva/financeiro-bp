import { useState, type CSSProperties } from 'react'
import { MESES_EFICIENCIA, type MesFiltroEficiencia } from '../constants'
import {
  type ApresentacaoIniciativasData,
  type IniciativaAndamento,
  type IniciativaPrioridade,
  type IniciativasMesEvo,
} from '../utils/apresentacaoIniciativas'
import { MesFilterButtons } from './MesFilterButtons'

const GOLD = '#D5B170'
const GOLD_DARK = '#C6A361'
const HEADER_BG = '#333f48'

type VisaoIniciativas = 'resumo' | 'andamento'

const PRIORIDADE_ESTILO: Record<
  IniciativaPrioridade | 'sem',
  { label: string; background: string; color: string }
> = {
  urgent: { label: 'Urgente', background: '#F8D7D3', color: '#C0392B' },
  high: { label: 'Alta', background: '#FCEFC7', color: '#9C6F0B' },
  normal: { label: 'Normal', background: '#FDF3D6', color: '#1F5FA8' },
  low: { label: 'Baixa', background: '#DCE6F1', color: '#1F5FA8' },
  backlog: { label: 'Backlog', background: '#EDEFF2', color: '#64748B' },
  sem: { label: 'Sem avaliação', background: '#D9D9D9', color: '#595959' },
}

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

/** Ordem das colunas da faixa de prioridades (mesmo papel dos meses no Resumo). */
const PRIORIDADE_ORDEM: readonly (IniciativaPrioridade | 'sem')[] = [
  'urgent',
  'high',
  'normal',
  'low',
  'backlog',
  'sem',
]

/** Card branco dos quadros do Resumo (Evolução mês a mês / Entregas). */
const cardAndamento: CSSProperties = {
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  background: '#FFFFFF',
  padding: '10px 12px',
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
}

const cardTituloAndamento: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  color: '#0F172A',
  marginBottom: 8,
}

const thAndamento: CSSProperties = {
  padding: '5px 6px',
  fontWeight: 700,
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const tdAndamento: CSSProperties = {
  padding: '4px 6px',
  color: '#334155',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

function zebra(i: number): string {
  return i % 2 === 1 ? '#F8FAFC' : '#FFF'
}

function pctDe(qtd: number, total: number): string {
  return total > 0 ? `${Math.round((qtd / total) * 100)}%` : '-'
}

function ADefinir() {
  return <span style={{ fontStyle: 'italic', color: '#A6A6A6' }}>A definir</span>
}

/** Faixa do topo no formato da Evolução do Resumo: prioridades no lugar dos meses, total no lugar do acumulado. */
function IniciativasAndamentoFaixa({ itens }: { itens: IniciativaAndamento[] }) {
  const total = itens.length
  const colunas = `minmax(280px, 1.6fr) repeat(${PRIORIDADE_ORDEM.length}, minmax(52px, 1fr)) minmax(88px, 0.9fr)`

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
      {PRIORIDADE_ORDEM.map((k) => (
        <div
          key={k}
          style={{
            background: HEADER_BG,
            color: '#fff',
            borderRadius: 6,
            padding: '6px 4px',
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {PRIORIDADE_ESTILO[k].label}
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
        TOTAL
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
          Projetos em andamento
        </div>
      </div>

      {PRIORIDADE_ORDEM.map((k) => {
        const qtd = itens.filter((p) => (p.prioridade ?? 'sem') === k).length
        const st = PRIORIDADE_ESTILO[k]
        return (
          <div
            key={k}
            style={{
              background: qtd > 0 ? st.background : '#F8FAFC',
              color: qtd > 0 ? st.color : '#94A3B8',
              border: '1px solid #E2E8F0',
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
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.05 }}>{qtd}</div>
            <div style={{ fontSize: 7, fontWeight: 600, lineHeight: 1.05 }}>
              {pctDe(qtd, total)}
            </div>
          </div>
        )
      })}

      <div
        style={{
          background: '#F8F1E3',
          border: `2px solid ${GOLD_DARK}`,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 4px',
          fontSize: 16,
          fontWeight: 800,
          color: '#1F2937',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {total}
      </div>
    </div>
  )
}

function IniciativasAndamentoTabela({ itens }: { itens: IniciativaAndamento[] }) {
  return (
    <div data-overview-copy-card data-chart-export-preserve-bg style={cardAndamento}>
      <div style={cardTituloAndamento}>Projetos em andamento</div>
      <table
        data-iniciativas-entregas
        style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}
      >
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '37%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '19%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: GOLD_DARK, color: '#fff' }}>
            <th style={{ ...thAndamento, textAlign: 'center' }}>#</th>
            <th style={thAndamento}>Projeto</th>
            <th style={thAndamento}>Etapa</th>
            <th style={{ ...thAndamento, textAlign: 'center' }}>Prioridade</th>
            <th style={{ ...thAndamento, textAlign: 'right' }}>Score</th>
            <th style={thAndamento}>Responsável</th>
            <th style={{ ...thAndamento, textAlign: 'right' }}>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {itens.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: '10px 6px', color: '#94A3B8', textAlign: 'center' }}>
                Nenhum projeto em andamento
              </td>
            </tr>
          ) : (
            itens.map((p, i) => {
              const prio = PRIORIDADE_ESTILO[p.prioridade ?? 'sem']
              return (
                <tr key={p.id} style={{ background: zebra(i) }}>
                  <td style={{ ...tdAndamento, textAlign: 'center', color: '#94A3B8' }}>{i + 1}</td>
                  <td
                    data-iniciativas-entrega-nome
                    title={p.nome}
                    style={{ ...tdAndamento, color: '#0F172A', maxWidth: 0 }}
                  >
                    {p.nome}
                  </td>
                  <td title={p.etapa || undefined} style={{ ...tdAndamento, color: '#475569' }}>
                    {p.etapa || <ADefinir />}
                  </td>
                  {/* Fundo na célula inteira: etiqueta inline-block saía deslocada no PPT. */}
                  <td
                    style={{
                      ...tdAndamento,
                      textAlign: 'center',
                      fontWeight: 700,
                      background: prio.background,
                      color: prio.color,
                    }}
                  >
                    {prio.label}
                  </td>
                  <td
                    style={{
                      ...tdAndamento,
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#0F172A',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {p.score != null ? p.score : <ADefinir />}
                  </td>
                  <td title={p.responsavel || undefined} style={{ ...tdAndamento, color: '#475569' }}>
                    {p.responsavel || <ADefinir />}
                  </td>
                  <td style={{ ...tdAndamento, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {p.prazoLabel || <ADefinir />}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Visão Em andamento no esqueleto do Resumo: faixa no topo e o quadro de projetos.
 * Tabela em largura total para nome, etapa e responsável não cortarem no slide.
 */
function IniciativasAndamento({ itens }: { itens: IniciativaAndamento[] }) {
  return (
    <>
      <IniciativasAndamentoFaixa itens={itens} />
      <IniciativasAndamentoTabela itens={itens} />
    </>
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
  const [visao, setVisao] = useState<VisaoIniciativas>('resumo')

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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Ver</span>
          {(
            [
              ['resumo', 'Resumo'],
              ['andamento', 'Em andamento'],
            ] as const
          ).map(([id, label]) => {
            const ativo = visao === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setVisao(id)}
                style={{
                  height: 28,
                  borderRadius: 6,
                  border: ativo ? '1px solid #1D4ED8' : '1px solid #CBD5E1',
                  background: ativo ? '#EFF6FF' : '#fff',
                  padding: '0 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: ativo ? '#1D4ED8' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </span>
        {visao === 'resumo' ? (
          <>
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
          </>
        ) : (
          <span style={{ fontSize: 11, color: '#64748B' }}>
            Projetos em andamento hoje no FORJAI, pela ordem de prioridade.
          </span>
        )}
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
      ) : visao === 'andamento' ? (
        <IniciativasAndamento itens={data.andamento} />
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
