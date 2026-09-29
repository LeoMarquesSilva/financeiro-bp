import type { CSSProperties } from 'react'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import {
  buildLeituraSaldoDevedor,
  formatSaldoDevedorInt,
  montarTotaisSaldoDevedor,
  nomeExibicaoGrupo,
  periodoAbrevLabel,
  periodoPosicaoLabel,
  type ClienteSaldoDevedor,
  type EvolucaoSaldoDevedorData,
} from '../utils/saldoDevedor'

/** No PowerPoint entram só os maiores saldos. O painel continua com a lista inteira. */
export const SALDO_DEVEDOR_COPY_LIMITE = 30

const TITLE = '#0369a1'
const MUTED = '#64748b'
const TEXT = '#0f172a'
const LINE = 'rgba(15, 23, 42, 0.12)'
const BLUE = '#0284c7'
const RED = '#dc2626'
const GREEN = '#059669'
const NAVY = '#0f2744'

type Accent = 'blue' | 'red' | 'green'

const ACCENT: Record<Accent, string> = {
  blue: BLUE,
  red: RED,
  green: GREEN,
}

function splitColunas(clientes: ClienteSaldoDevedor[]): [ClienteSaldoDevedor[], ClienteSaldoDevedor[]] {
  const mid = Math.ceil(clientes.length / 2)
  return [clientes.slice(0, mid), clientes.slice(mid)]
}

function SlideCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string
  value: string
  hint: string
  accent: Accent
}) {
  const color = ACCENT[accent]
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${color}`,
        padding: '8px 10px 8px 12px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#64748b',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 16,
          fontWeight: 800,
          color: accent === 'blue' ? NAVY : color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.25, color: '#64748b' }}>{hint}</div>
    </div>
  )
}

function GeradoValor({ cliente }: { cliente: ClienteSaldoDevedor }) {
  const queda = cliente.saldoAnterior - cliente.acumulado
  if (queda > 0.5) {
    return (
      <span style={{ color: GREEN, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        ▼ {formatSaldoDevedorInt(queda)}
      </span>
    )
  }
  if (cliente.geradoAno > 0.5) {
    return (
      <span style={{ color: RED, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        ▲ {formatSaldoDevedorInt(cliente.geradoAno)}
      </span>
    )
  }
  return (
    <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{formatSaldoDevedorInt(0)}</span>
  )
}

function TabelaSlide({
  clientes,
  offset,
  ano,
  anoAnterior,
}: {
  clientes: ClienteSaldoDevedor[]
  offset: number
  ano: number
  anoAnterior: number
}) {
  const th: CSSProperties = {
    textAlign: 'right',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: MUTED,
    padding: '0 0 6px 8px',
    whiteSpace: 'nowrap',
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <colgroup>
        <col style={{ width: '40%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }}>Cliente</th>
          <th style={th}>Saldo {anoAnterior}</th>
          <th style={th}>Gerado {ano}</th>
          <th style={th}>Acumulado</th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((c, i) => {
          const rank = offset + i + 1
          const nome = nomeExibicaoGrupo(c.nome)
          return (
            <tr key={c.grupoNorm} style={{ borderTop: `1px solid ${LINE}` }}>
              <td style={{ padding: '3px 6px 3px 0', verticalAlign: 'middle' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 20,
                      flexShrink: 0,
                      textAlign: 'right',
                      background: 'transparent',
                      color: MUTED,
                      fontSize: 10,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {rank}
                  </span>
                  <span
                    style={{
                      color: TEXT,
                      fontSize: nome.length > 22 ? 10 : 11,
                      fontWeight: 600,
                    }}
                  >
                    {nome}
                  </span>
                </span>
              </td>
              <td
                style={{
                  padding: '3px 0 3px 8px',
                  textAlign: 'right',
                  color: '#334155',
                  fontSize: 11,
                  fontVariantNumeric: 'tabular-nums',
                  verticalAlign: 'middle',
                }}
              >
                {formatSaldoDevedorInt(c.saldoAnterior)}
              </td>
              <td
                style={{
                  padding: '3px 0 3px 8px',
                  textAlign: 'right',
                  fontSize: 11,
                  verticalAlign: 'middle',
                }}
              >
                <GeradoValor cliente={c} />
              </td>
              <td
                style={{
                  padding: '3px 0 3px 8px',
                  textAlign: 'right',
                  color: TEXT,
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  verticalAlign: 'middle',
                }}
              >
                {formatSaldoDevedorInt(c.acumulado)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function SaldoDevedorCopySlide({ data }: { data: EvolucaoSaldoDevedorData }) {
  const { ano, anoAnterior, mesInicio, mesFim, clientes } = data
  const lista = clientes.slice(0, SALDO_DEVEDOR_COPY_LIMITE)
  const totais = montarTotaisSaldoDevedor(lista)
  const [colA, colB] = splitColunas(lista)
  const abrev = periodoAbrevLabel(mesInicio, mesFim)
  const posicao = periodoPosicaoLabel(ano, mesInicio, mesFim)
  const leitura = buildLeituraSaldoDevedor({ ...data, clientes: lista, totais })
  const pctEstoque = totais.acumulado > 0 ? (totais.saldoAnterior / totais.acumulado) * 100 : 0
  const pctGerado = totais.saldoAnterior > 0 ? (totais.geradoAno / totais.saldoAnterior) * 100 : 0
  const recorte =
    clientes.length > lista.length
      ? `Os ${lista.length} maiores saldos acumulados`
      : 'Base completa de clientes em acompanhamento'

  return (
    <div
      style={{
        width: 1280,
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        color: TEXT,
        padding: '18px 20px 16px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: TITLE,
          lineHeight: 1.1,
        }}
      >
        Evolução do saldo devedor por cliente
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: MUTED }}>
        {recorte} · do maior para o menor saldo acumulado · posição de {posicao}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 8,
          marginTop: 12,
        }}
      >
        <SlideCard
          title="Saldo devedor acumulado"
          value={formatCurrency(totais.acumulado)}
          hint={`${totais.qtd} cliente${totais.qtd === 1 ? '' : 's'} na régua`}
          accent="blue"
        />
        <SlideCard
          title={`Estoque de ${anoAnterior}`}
          value={formatCurrency(totais.saldoAnterior)}
          hint={`${formatPercent(pctEstoque)} do acumulado`}
          accent="blue"
        />
        <SlideCard
          title={`Gerado em ${ano} (${abrev})`}
          value={formatCurrency(totais.geradoAno)}
          hint={
            totais.saldoAnterior > 0
              ? `${pctGerado >= 0 ? '+' : ''}${formatPercent(pctGerado)} sobre o estoque de ${anoAnterior}`
              : `Em aberto com vencimento em ${ano}`
          }
          accent={totais.geradoAno >= 0 ? 'red' : 'green'}
        />
        <SlideCard
          title="Clientes que cresceram"
          value={`${totais.qtdCresceram} de ${totais.qtd}`}
          hint={`${formatCurrency(totais.dividaNova)} de dívida nova`}
          accent="red"
        />
        <SlideCard
          title="Clientes que reduziram"
          value={`${totais.qtdReduziram} de ${totais.qtd}`}
          hint={
            totais.amortizado > 0.5
              ? `${formatCurrency(totais.amortizado)} amortizados`
              : 'Sem redução no período'
          }
          accent="green"
        />
      </div>

      {lista.length === 0 ? (
        <div style={{ marginTop: 16, color: MUTED, fontSize: 13 }}>
          Nenhum cliente inadimplente no período.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: colB.length > 0 ? '1fr 1fr' : '1fr',
            gap: 22,
            marginTop: 14,
          }}
        >
          <TabelaSlide clientes={colA} offset={0} ano={ano} anoAnterior={anoAnterior} />
          {colB.length > 0 ? (
            <TabelaSlide clientes={colB} offset={colA.length} ano={ano} anoAnterior={anoAnterior} />
          ) : null}
        </div>
      )}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: 10,
          background: 'transparent',
          borderTop: '2px solid #0f2744',
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                padding: '8px 10px',
                color: TEXT,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Total · {totais.qtd} cliente{totais.qtd === 1 ? '' : 's'}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontSize: 11 }}>
              Saldo {anoAnterior}{' '}
              <span style={{ color: TEXT, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {formatSaldoDevedorInt(totais.saldoAnterior)}
              </span>
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontSize: 11 }}>
              Gerado em {ano}{' '}
              <span
                style={{
                  color: totais.geradoAno >= 0 ? RED : GREEN,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totais.geradoAno >= 0 ? '▲' : '▼'} {formatSaldoDevedorInt(Math.abs(totais.geradoAno))}
              </span>
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontSize: 11 }}>
              Saldo acumulado{' '}
              <span style={{ color: TEXT, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {formatSaldoDevedorInt(totais.acumulado)}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 6, fontSize: 10, color: '#64748b' }}>
        Valores em R$ · Gerado {ano} é o saldo em aberto com vencimento no ano. Acumulado é o saldo
        em aberto agora, não a soma das colunas.
      </div>

      <div
        style={{
          marginTop: 10,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#0369a1',
            marginBottom: 4,
          }}
        >
          LEITURA
        </div>
        {leitura.map((p) => (
          <div key={p} style={{ fontSize: 12, lineHeight: 1.45, color: '#1e293b' }}>
            {p}
          </div>
        ))}
      </div>
    </div>
  )
}
