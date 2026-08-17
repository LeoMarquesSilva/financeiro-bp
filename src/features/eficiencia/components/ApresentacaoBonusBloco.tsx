import { MESES_ABREV, MESES_NOME } from '@/features/receita/constants'
import { formatPercent } from '@/shared/utils/format'
import {
  BONUS_GATILHO_RECEITA_PCT,
  formatBonusPct,
  labelPeriodoBonus,
  type ApresentacaoBonusData,
  type BonusIndicadorRow,
} from '../utils/apresentacaoBonus'

const HEADER_BG = '#333f48'
const GOLD = '#C6A361'
const GOLD_SOFT = '#D5B170'
const RED = '#DC2626'
const GREEN = '#16A34A'
const META_BLUE = '#2563EB'
const BONUS_NAVY = '#1E3A5F'
const CARD_SHADOW = '0 1px 3px rgba(15,23,42,0.08)'

const ICON_RECEITA = '/team/IconeReceita.svg'
const ICON_RESULTADO = '/team/Icone%20Resultado.svg'
const ICON_BONUS = '/team/Icone%20Bonus.svg'
const ICON_SALARIO = '/team/IconeSalarioGarantido.svg'

type Props = {
  data: ApresentacaoBonusData | null
  loading?: boolean
  ano: number
  mesInicio: number
  mesFim: number
  onMesInicioChange: (mes: number) => void
  onMesFimChange: (mes: number) => void
}

function MesSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (mes: number) => void
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{ fontWeight: 600, color: '#64748B' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          height: 28,
          borderRadius: 6,
          border: '1px solid #CBD5E1',
          background: '#fff',
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 600,
          color: '#0F172A',
        }}
      >
        {MESES_NOME.map((nome, i) => (
          <option key={nome} value={i + 1}>
            {MESES_ABREV[i]} — {nome}
          </option>
        ))}
      </select>
    </label>
  )
}

function TeamIcon({ src, size = 28 }: { src: string; size?: number }) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}

function SummaryCard({
  title,
  accent,
  iconSrc,
  label,
  value,
  subtitle,
  valueColor,
}: {
  title: string
  accent: string
  iconSrc: string
  label: string
  value: string
  subtitle: string
  valueColor: string
}) {
  const solidIconBg =
    accent === BONUS_NAVY || accent === RED || accent === GREEN
  return (
    <div
      data-bonus-summary-card
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 168,
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        overflow: 'hidden',
        boxShadow: CARD_SHADOW,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        data-bonus-summary-header
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          background: accent,
          color: '#FFFFFF',
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div
        data-bonus-summary-body
        style={{
          width: '100%',
          boxSizing: 'border-box',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 16px 14px',
          textAlign: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: solidIconBg ? accent : `${accent}22`,
            border: accent === GOLD ? `1.5px solid ${accent}66` : '1.5px solid transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <TeamIcon src={iconSrc} size={28} />
        </span>
        <div
          data-bonus-card-label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#64748B',
            lineHeight: 1.25,
          }}
        >
          {label}
        </div>
        <div
          data-bonus-card-value
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: valueColor,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
        <div
          data-bonus-card-sub
          style={{
            fontSize: 11,
            color: '#94A3B8',
            fontWeight: 500,
            lineHeight: 1.3,
            maxWidth: '100%',
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function statusLabel(bateu: boolean | null): { text: string; color: string; bg: string } {
  if (bateu == null) {
    return { text: '—', color: '#64748B', bg: '#F1F5F9' }
  }
  if (bateu) {
    return { text: 'BATEU', color: GREEN, bg: '#DCFCE7' }
  }
  return { text: 'não bateu', color: RED, bg: '#FEE2E2' }
}

function IndicadoresTable({
  rows,
  pesoTotal,
  nota,
}: {
  rows: BonusIndicadorRow[]
  pesoTotal: number
  nota: number
}) {
  return (
    <div
      data-bonus-tabela
      style={{
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        background: '#FFFFFF',
        width: '100%',
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: CARD_SHADOW,
      }}
    >
      <div
        data-bonus-section-header
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: HEADER_BG,
          color: '#FFFFFF',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-hidden
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
              stroke="#D5B170"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect x="9" y="3" width="6" height="4" rx="1" stroke="#D5B170" strokeWidth="2" />
            <path d="M9 12h6M9 16h4" stroke="#D5B170" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.04em',
              lineHeight: 1.25,
              overflowWrap: 'break-word',
            }}
          >
            INDICADORES — PESOS, RESULTADOS E CONTRIBUIÇÃO
          </div>
          <div style={{ marginTop: 3, fontSize: 10, color: '#CBD5E1', lineHeight: 1.35 }}>
            Atingimento capado em 100% por indicador. Contribuição = peso × atingimento
            capado.
          </div>
        </div>
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12,
          flex: 1,
        }}
      >
        <thead>
          <tr style={{ background: '#F1F5F9', color: '#475569' }}>
            {[
              'Indicador',
              'Meta',
              'Resultado',
              'Direção',
              'Peso',
              'Contribuição',
              'Status',
            ].map((h) => (
              <th
                key={h}
                style={{
                  padding: '9px 10px',
                  textAlign: h === 'Indicador' ? 'left' : 'center',
                  fontWeight: 700,
                  borderBottom: '1px solid #E2E8F0',
                  whiteSpace: 'nowrap',
                  fontSize: 10,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = statusLabel(r.bateu)
            const resColor =
              r.bateu == null ? '#64748B' : r.bateu ? GREEN : RED
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td
                  style={{
                    padding: '8px 10px',
                    fontWeight: 600,
                    color: '#0F172A',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.label}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: META_BLUE,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatPercent(r.meta)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: resColor,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatBonusPct(r.resultado)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    color: '#64748B',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.direcao === 'maior' ? 'Maior' : 'Menor'}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    color: '#334155',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatPercent(r.peso)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: r.bateu ? GREEN : '#334155',
                    background: r.bateu ? '#F0FDF4' : 'transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatPercent(r.contribuicao)}
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    data-bonus-status
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                      padding: '4px 11px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: 0,
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      color: st.color,
                      background: st.bg,
                    }}
                  >
                    {st.text}
                  </span>
                </td>
              </tr>
            )
          })}
          <tr style={{ background: HEADER_BG, color: '#FFFFFF' }}>
            <td
              colSpan={4}
              style={{
                padding: '10px',
                fontWeight: 800,
                textAlign: 'right',
                letterSpacing: '0.04em',
                fontSize: 12,
              }}
            >
              TOTAL
            </td>
            <td
              style={{
                padding: '10px',
                textAlign: 'center',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                fontSize: 12,
              }}
            >
              {formatPercent(pesoTotal)}
            </td>
            <td
              style={{
                padding: '10px',
                textAlign: 'center',
                fontWeight: 800,
                color: GOLD_SOFT,
                whiteSpace: 'nowrap',
                fontSize: 12,
              }}
            >
              {formatPercent(nota)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function PremissasCard({ periodoLabel }: { periodoLabel: string }) {
  const items = [
    { label: `Meta de Receita (${periodoLabel})`, value: '100%' },
    { label: 'Gatilho de liberação', value: `≥ ${BONUS_GATILHO_RECEITA_PCT}% da meta` },
    {
      label: 'Degrau de pagamento',
      value: '95%–99,9% = ½ SALÁRIO | 100%+ = 1 salário',
    },
    { label: 'Nota ponderada', value: 'Σ peso × atingimento capado' },
  ]
  return (
    <div
      data-bonus-premissas
      style={{
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        background: '#FFFFFF',
        width: '100%',
        height: 'fit-content',
        alignSelf: 'start',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: CARD_SHADOW,
      }}
    >
      <div
        data-bonus-section-header
        style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: HEADER_BG,
          color: '#FFFFFF',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: GOLD,
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
            flexShrink: 0,
            lineHeight: 1,
          }}
          aria-hidden
        >
          i
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          PREMISSAS BASE
        </span>
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          flex: 1,
        }}
      >
        <tbody>
          {items.map((it, i) => (
            <tr
              key={it.label}
              style={{
                borderBottom: i < items.length - 1 ? '1px solid #F1F5F9' : undefined,
              }}
            >
              <td
                style={{
                  padding: '16px 18px',
                  color: '#64748B',
                  fontWeight: 600,
                  verticalAlign: 'middle',
                  width: '42%',
                  lineHeight: 1.4,
                }}
              >
                {it.label}
              </td>
              <td
                style={{
                  padding: '16px 18px',
                  color: '#0F172A',
                  fontWeight: 700,
                  textAlign: 'right',
                  verticalAlign: 'middle',
                  lineHeight: 1.4,
                }}
              >
                {it.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ApresentacaoBonusBloco({
  data,
  loading,
  ano,
  mesInicio,
  mesFim,
  onMesInicioChange,
  onMesFimChange,
}: Props) {
  const periodoPreview = labelPeriodoBonus(mesInicio, mesFim, ano)
  const portaAberta = data?.portaAberta ?? false
  const receitaPct = data?.receitaPct ?? null

  const receitaValue = receitaPct == null ? '—' : formatPercent(receitaPct)
  const resultadoValue =
    data == null ? '—' : formatPercent(data.notaPonderada)
  const bonusValue = !portaAberta
    ? 'R$ 0,00'
    : data?.bonusLabel ?? 'R$ 0,00'
  const pagamentoValue = data == null ? '—' : `${data.parcelas}×`
  const pagamentoSub = data?.parcelaDatasLabel ?? 'Datas conforme apuração'

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      }}
    >
      <div
        data-chart-export-ignore
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
          Período Programa de Bônus
        </span>
        <MesSelect label="De" value={mesInicio} onChange={onMesInicioChange} />
        <MesSelect label="Até" value={mesFim} onChange={onMesFimChange} />
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{periodoPreview}</span>
        {loading ? (
          <span style={{ fontSize: 10, color: '#94A3B8' }}>Carregando…</span>
        ) : null}
      </div>

      <div
        data-apresentacao-export="programa_bonus"
        data-apresentacao-fill-slide
        data-apresentacao-fill-preserve
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: '8px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          data-bonus-kpis
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 14,
            width: '100%',
            flexShrink: 0,
          }}
        >
          <SummaryCard
            title={portaAberta ? 'Porta Aberta' : 'Porta Fechada'}
            accent={portaAberta ? GREEN : RED}
            iconSrc={ICON_RECEITA}
            label="Receita realizada"
            value={receitaValue}
            subtitle={`Mínimo necessário: ${BONUS_GATILHO_RECEITA_PCT}% da meta`}
            valueColor={portaAberta ? GREEN : RED}
          />
          <SummaryCard
            title="Resultado"
            accent={GOLD}
            iconSrc={ICON_RESULTADO}
            label="Nota ponderada geral"
            value={resultadoValue}
            subtitle="Soma das contribuições por peso"
            valueColor={GOLD}
          />
          <SummaryCard
            title="Bônus"
            accent={BONUS_NAVY}
            iconSrc={ICON_BONUS}
            label="Bônus a pagar"
            value={bonusValue}
            subtitle="Cenário atual da apuração"
            valueColor={BONUS_NAVY}
          />
          <SummaryCard
            title="Salário Garantido"
            accent={GOLD}
            iconSrc={ICON_SALARIO}
            label="Pagamento em"
            value={pagamentoValue}
            subtitle={pagamentoSub}
            valueColor={GOLD}
          />
        </div>

        <div
          data-bonus-body
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.38fr) minmax(0, 0.62fr)',
            gap: 14,
            alignItems: 'stretch',
            width: '100%',
            flex: 1,
            minHeight: 420,
          }}
        >
          <PremissasCard periodoLabel={periodoPreview} />
          {data ? (
            <IndicadoresTable
              rows={data.indicadores}
              pesoTotal={data.pesoTotal}
              nota={data.notaPonderada}
            />
          ) : (
            <div
              style={{
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                padding: 24,
                color: '#64748B',
                fontSize: 13,
                textAlign: 'center',
                boxShadow: CARD_SHADOW,
              }}
            >
              {loading ? 'Carregando indicadores…' : 'Sem dados para o período.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
