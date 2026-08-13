import {
  FileText,
  FolderPlus,
  Headphones,
  Scale,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import type { ApresentacaoControladoriaData } from '../utils/apresentacaoControladoria'
import { OpsLegaisResponsumPanel } from './OpsLegaisResponsumPanel'

const GOLD = '#D5B170'
const GOLD_DARK = '#C6A361'

type Props = {
  data: ApresentacaoControladoriaData | null
  loading?: boolean
  error?: Error | null
}

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('pt-BR')
}

function BigCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof FileText
}) {
  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        borderRadius: 10,
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        padding: '12px 14px',
        minWidth: 0,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: '#F5F0E6',
            color: GOLD_DARK,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={15} aria-hidden />
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#64748B',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#0F172A',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function MesTable({
  title,
  rows,
  valueKey,
}: {
  title: string
  rows: ApresentacaoControladoriaData['mensalAtivo']
  valueKey:
    | 'publicacoes'
    | 'pastas_cadastradas'
    | 'protocolos'
    | 'novos_clientes'
    | 'clientes_inativados'
}) {
  const total = rows.reduce((s, r) => s + r[valueKey], 0)
  return (
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
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: GOLD_DARK, color: '#fff' }}>
            <th style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 700 }}>Mês</th>
            <th style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 700 }}>Qtd</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.mes} style={{ background: i % 2 === 1 ? '#F8FAFC' : '#FFF' }}>
              <td style={{ padding: '4px 8px', color: '#334155' }}>{r.mesLabel}</td>
              <td
                style={{
                  padding: '4px 8px',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmt(r[valueKey])}
              </td>
            </tr>
          ))}
          <tr style={{ background: '#F1F5F9', fontWeight: 800 }}>
            <td style={{ padding: '5px 8px' }}>TOTAL</td>
            <td
              style={{
                padding: '5px 8px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function ApresentacaoControladoriaBloco({ data, loading, error }: Props) {
  return (
    <div
      data-apresentacao-export="controladoria"
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
        7. Big Numbers Controladoria
      </div>

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
          Não foi possível carregar Controladoria
          {error.message ? `: ${error.message}` : '.'}
        </div>
      ) : loading || !data ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>Carregando Controladoria…</div>
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
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <BigCard
              label="Publicações Vistadas"
              value={fmt(data.totais.publicacoes)}
              icon={FileText}
            />
            <BigCard
              label="Pastas Cadastradas"
              value={fmt(data.totais.pastas_cadastradas)}
              icon={FolderPlus}
            />
            <BigCard
              label="Protocolos Realizados"
              value={fmt(data.totais.protocolos)}
              icon={Scale}
            />
            <BigCard
              label="Novos Clientes"
              value={fmt(data.totais.novos_clientes)}
              icon={UserPlus}
            />
            <BigCard
              label="Clientes Inativados"
              value={fmt(data.totais.clientes_inativados)}
              icon={UserMinus}
            />
            <BigCard
              label="Chamados Atendidos (Responsum)"
              value={fmt(data.totais.chamados_responsum)}
              icon={Headphones}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            <MesTable
              title="Publicações Vistadas"
              rows={data.mensalAtivo}
              valueKey="publicacoes"
            />
            <MesTable
              title="Pastas Cadastradas"
              rows={data.mensalAtivo}
              valueKey="pastas_cadastradas"
            />
            <MesTable
              title="Protocolos Realizados"
              rows={data.mensalAtivo}
              valueKey="protocolos"
            />
            <MesTable
              title="Novos Clientes"
              rows={data.mensalAtivo}
              valueKey="novos_clientes"
            />
            <MesTable
              title="Clientes Inativados"
              rows={data.mensalAtivo}
              valueKey="clientes_inativados"
            />
          </div>

          {data.clientesInativosError ? (
            <div style={{ fontSize: 11, color: '#B45309' }}>
              Clientes inativados: {data.clientesInativosError}
            </div>
          ) : null}

          <div data-overview-copy-card data-chart-export-preserve-bg>
            <OpsLegaisResponsumPanel
              data={data.responsum}
              error={
                data.responsumError ? new Error(data.responsumError) : null
              }
              showListas={false}
            />
          </div>
        </>
      )}
    </div>
  )
}
