import { BarChart3 } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { Avatar } from '@/shared/components/Avatar'
import { useTeamMembers } from '@/features/inadimplencia/hooks/useTeamMembers'
import { useBpUsuariosAvatar } from '../hooks/useBpUsuariosAvatar'
import { resolvePessoaAvatarUrl } from '../utils/resolvePessoaAvatar'
import { resolvePessoaDisplayNome } from '../utils/formatPessoaNome'
import { toPriMaiuscula } from '../utils/textFormat'
import type { ApresentacaoLiderancaData } from '../utils/apresentacaoLideranca'

const GOLD = '#D5B170'
const GOLD_DARK = '#C6A361'
const HEADER_BG = '#333f48'

type Props = {
  data: ApresentacaoLiderancaData | null
  loading?: boolean
  error?: Error | null
}

function cellBg(atingiu: boolean | null, value: number | null): {
  background: string
  color: string
} {
  if (value == null) return { background: '#FFFFFF', color: '#94A3B8' }
  if (atingiu === true) return { background: '#ECFDF3', color: '#059669' }
  return { background: '#FEE2E2', color: '#DC2626' }
}

export function ApresentacaoLiderancaBloco({ data, loading, error }: Props) {
  const { teamMembers } = useTeamMembers()
  const { usuarios: avatarCatalog } = useBpUsuariosAvatar()

  if (loading) {
    return (
      <div
        data-apresentacao-export="lideranca"
        data-apresentacao-lideranca
        style={{
          padding: 16,
          borderRadius: 10,
          background: '#F8FAFC',
          color: '#64748B',
          fontSize: 12,
        }}
      >
        Carregando Liderança…
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-apresentacao-export="lideranca"
        data-apresentacao-lideranca
        style={{
          padding: 16,
          borderRadius: 10,
          background: '#FEF2F2',
          color: '#B91C1C',
          fontSize: 12,
        }}
      >
        Falha ao carregar Liderança: {error.message}
      </div>
    )
  }

  if (!data || data.qtdPessoas === 0) {
    return (
      <div
        data-apresentacao-export="lideranca"
        data-apresentacao-lideranca
        style={{
          padding: 16,
          borderRadius: 10,
          background: '#F8FAFC',
          color: '#64748B',
          fontSize: 12,
        }}
      >
        Sem headcount de Liderança em Operações Legais.
      </div>
    )
  }

  const acumStyle = cellBg(data.atingiu, data.pctAtingimento)

  return (
    <div
      data-apresentacao-export="lideranca"
      data-apresentacao-lideranca
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        minWidth: 1100,
        boxSizing: 'border-box',
        padding: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {/* Cabeçalho meses + ACUMULADO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(200px, 1.4fr) repeat(${data.meses.length}, minmax(52px, 1fr)) minmax(88px, 0.9fr)`,
          gap: 4,
          alignItems: 'stretch',
        }}
      >
        <div />
        {data.meses.map((m) => (
          <div
            key={m.mes}
            style={{
              background: HEADER_BG,
              color: '#fff',
              borderRadius: 6,
              padding: '6px 4px',
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            {m.mesLabel}
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
      </div>

      {/* Linha KPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(200px, 1.4fr) repeat(${data.meses.length}, minmax(52px, 1fr)) minmax(88px, 0.9fr)`,
          gap: 4,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '8px 10px',
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: '#F5F0E6',
              color: GOLD_DARK,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BarChart3 size={14} aria-hidden />
          </span>
          <div style={{ minWidth: 0, overflow: 'visible' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#1F2937',
                lineHeight: 1.25,
                whiteSpace: 'normal',
              }}
            >
              {toPriMaiuscula('Desenvolvimento Contínuo de Lideranças')}
            </div>
            <div
              style={{
                marginTop: 4,
                display: 'inline-block',
                background: HEADER_BG,
                color: '#fff',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              Meta proporcional
            </div>
          </div>
        </div>

        {data.meses.map((m) => {
          const st = cellBg(m.atingiu, m.value)
          return (
            <div
              key={m.mes}
              style={{
                ...st,
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
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  lineHeight: 1.05,
                  color: m.value == null ? '#94A3B8' : st.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {m.horasMesLabel}
              </div>
            </div>
          )
        })}

        <div
          data-lideranca-acumulado
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
            {data.acumuladoLabel}
          </div>
          <div
            data-lideranca-acumulado-horas
            style={{
              width: '100%',
              fontSize: 8,
              color: '#64748B',
              fontWeight: 600,
              lineHeight: 1.05,
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            {data.horasRealizadasLabel}
          </div>
          <div
            data-lideranca-acumulado-meta
            style={{
              width: '100%',
              color: '#94A3B8',
              fontSize: 7,
              lineHeight: 1.05,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
              Meta {data.metaHorasLabel} · {data.qtdPessoas} pessoas
            </span>
          </div>
        </div>
      </div>

      {/* Lista colaboradores */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 2fr 0.7fr',
          gap: 6,
          marginTop: 4,
        }}
      >
        {(['Colaborador', 'Treinamentos', 'Horas Total'] as const).map((h) => (
          <div
            key={h}
            style={{
              background: HEADER_BG,
              color: '#fff',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 10,
              fontWeight: 700,
              textAlign: h === 'Horas Total' ? 'center' : 'left',
            }}
          >
            {h}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.pessoas.map((p) => {
          const nome = resolvePessoaDisplayNome(p.colaborador, teamMembers, avatarCatalog)
          const avatarUrl = resolvePessoaAvatarUrl(p.colaborador, teamMembers, avatarCatalog)
          return (
            <div
              key={p.colaborador}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 2fr 0.7fr',
                gap: 6,
                background: '#F8F1E3',
                border: '1px solid #E8DFD0',
                borderRadius: 10,
                padding: '8px 10px',
                alignItems: 'center',
              }}
            >
              <div
                data-lideranca-pessoa-identidade
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <Avatar
                  fullName={nome || p.colaborador || '?'}
                  src={avatarUrl}
                  className="h-8 w-8 shrink-0"
                />
                <span
                  data-lideranca-pessoa-nome
                  style={{
                    display: 'block',
                    width: '100%',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#1F2937',
                    lineHeight: 1.25,
                    textAlign: 'center',
                    whiteSpace: 'normal',
                    overflow: 'visible',
                    wordBreak: 'break-word',
                  }}
                >
                  {nome || p.colaborador}
                </span>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#334155',
                  lineHeight: 1.35,
                  borderLeft: '1px solid #E8DFD0',
                  borderRight: '1px solid #E8DFD0',
                  padding: '0 10px',
                }}
              >
                {p.treinamentos.length === 0
                  ? '—'
                  : p.treinamentos.map((t) => `${t.nome} (${t.horasLabel})`).join(' · ')}
              </div>
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {p.horasLabel}
              </div>
            </div>
          )
        })}
      </div>

      {data.pctAtingimento != null ? (
        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
          {formatPercent(data.pctAtingimento)} · {data.horasRealizadasLabel} realizadas · Meta:{' '}
          {Math.round(data.metaMinutos / 60)}h total ({data.qtdPessoas} pessoas · proporcional)
        </div>
      ) : null}
    </div>
  )
}
