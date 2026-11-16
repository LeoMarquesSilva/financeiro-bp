import { useState, type CSSProperties } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { MESES_CURTOS, MESES_LONGOS } from '@/features/opex/constants'
import {
  mesesApresentacaoOpex,
  opexMesAtualRef,
  type ApresentacaoOpexData,
} from '../utils/apresentacaoOpex'

const FONT = 'Segoe UI, system-ui, sans-serif'
const COR_ANTERIOR = '#7B8794'
const COR_ATUAL = '#0E7C5A'
/** Custo subiu (ruim) / caiu (bom). */
const COR_ALTA = '#C2410C'
const COR_QUEDA = '#15803D'
const BG_ALTA = '#FDECE4'
const BG_QUEDA = '#E3F4EA'
const GRID = '#E2E8F0'
const GOLD_DARK = '#C6A361'
const PLOT_H = 230
const PCT_ROW_H = 30
const EIXO_W = 72

const FORA_DO_OPEX =
  'distribuição de lucros e retiradas dos sócios, repasses a terceiros, investimentos (CAPEX), empréstimos e adiantamentos, deduções da receita.'

type Props = {
  data: ApresentacaoOpexData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mesInicio: number
  mesFim: number
  onMesInicioChange: (mes: number) => void
  onMesFimChange: (mes: number) => void
  /** Filtro de planos da página OPEX com itens ocultos. */
  planoFiltroAtivo?: boolean
}

function num(v: number, casas: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function formatVariacao(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${num(v, 1)}%`
}

function corVariacao(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v === 0) return '#64748B'
  return v > 0 ? COR_ALTA : COR_QUEDA
}

function formatTotal(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${num(v / 1_000_000, 2)} mi`
  return `R$ ${num(v / 1_000, 0)} mil`
}

function formatTick(v: number, topo: boolean): string {
  if (v === 0) return '0'
  const casas = (x: number) => (Number.isInteger(x) ? 0 : 1)
  const txt =
    v >= 1_000_000
      ? `${num(v / 1_000_000, casas(v / 1_000_000))} mi`
      : `${num(v / 1_000, casas(v / 1_000))} mil`
  return topo ? `R$ ${txt}` : txt
}

/** Passo "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) com no máximo 4 faixas. */
function escalaEixo(max: number): { topo: number; ticks: number[] } {
  if (!(max > 0)) return { topo: 1, ticks: [0] }
  const mag = 10 ** Math.floor(Math.log10(max))
  const passos = [1, 2, 2.5, 5, 10, 20, 25, 50, 100].map((m) => (m * mag) / 10)
  const passo = passos.find((p) => Math.ceil(max / p) <= 4) ?? 10 * mag
  const n = Math.max(1, Math.ceil(max / passo))
  const topo = passo * n
  return { topo, ticks: Array.from({ length: n + 1 }, (_, i) => i * passo) }
}

function periodoTexto(meses: number[]): string {
  if (meses.length === 0) return ''
  const a = MESES_CURTOS[meses[0] - 1]
  const b = MESES_CURTOS[meses[meses.length - 1] - 1]
  return meses.length === 1 ? a : `${a}–${b}`
}

function MesSelect({
  label,
  value,
  onChange,
  teto,
  mesEmCurso,
}: {
  label: string
  value: number
  onChange: (mes: number) => void
  teto: number
  mesEmCurso: number | null
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
        {MESES_LONGOS.map((nome, i) => {
          const mes = i + 1
          return (
            <option key={nome} value={mes} disabled={mes > teto}>
              {MESES_CURTOS[i]} — {nome}
              {mes === mesEmCurso ? ' (parcial)' : ''}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span
        style={{
          display: 'inline-block',
          width: 16,
          height: 16,
          borderRadius: 3,
          backgroundColor: cor,
          printColorAdjust: 'exact',
          WebkitPrintColorAdjust: 'exact',
        }}
      />
      <span style={{ fontSize: 15, fontWeight: 500, color: '#334155' }}>{texto}</span>
    </span>
  )
}

function BadgeVariacao({ valor }: { valor: number | null }) {
  const alta = valor != null && valor > 0
  const queda = valor != null && valor < 0
  return (
    <span
      data-chart-export-preserve-bg
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: 8,
        backgroundColor: alta ? BG_ALTA : queda ? BG_QUEDA : '#F1F5F9',
        color: corVariacao(valor),
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.15,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {formatVariacao(valor)}
    </span>
  )
}

function KpiTotal({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#64748B' }}>{rotulo}</span>
      <span
        style={{
          fontSize: 30,
          fontWeight: 700,
          color: cor,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </span>
    </div>
  )
}

function Grafico({
  data,
  mostrarValores,
}: {
  data: ApresentacaoOpexData
  mostrarValores: boolean
}) {
  const max = Math.max(0, ...data.meses.flatMap((m) => [m.anterior, m.atual]))
  const { topo, ticks } = escalaEixo(max)
  const h = (v: number) => Math.max(0, Math.round((v / topo) * PLOT_H))

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {mostrarValores ? (
        <div
          style={{
            width: EIXO_W,
            flexShrink: 0,
            position: 'relative',
            height: PLOT_H,
            marginTop: PCT_ROW_H,
          }}
        >
          {ticks.map((t, i) => (
            <span
              key={t}
              style={{
                position: 'absolute',
                right: 10,
                bottom: h(t) - 7,
                fontSize: 13,
                lineHeight: '14px',
                color: '#64748B',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTick(t, i === ticks.length - 1)}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ width: 12, flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', height: PCT_ROW_H, alignItems: 'flex-start' }}>
          {data.meses.map((m) => (
            <div
              key={m.mes}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 15,
                fontWeight: 700,
                color: corVariacao(m.variacaoPct),
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {formatVariacao(m.variacaoPct)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', height: PLOT_H }}>
          {ticks.map((t) =>
            t === 0 ? null : (
              <div
                key={t}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: h(t),
                  height: 1,
                  backgroundColor: GRID,
                }}
              />
            ),
          )}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 1,
              backgroundColor: '#94A3B8',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'flex-end',
            }}
          >
            {data.meses.map((m) => (
              <div
                key={m.mes}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {[
                  { v: m.anterior, cor: COR_ANTERIOR },
                  { v: m.atual, cor: COR_ATUAL },
                ].map((b, i) => (
                  <div
                    key={i}
                    data-chart-export-preserve-bg
                    style={{
                      width: '34%',
                      maxWidth: 46,
                      height: h(b.v),
                      backgroundColor: b.cor,
                      borderRadius: '4px 4px 0 0',
                      printColorAdjust: 'exact',
                      WebkitPrintColorAdjust: 'exact',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', paddingTop: 6 }}>
          {data.meses.map((m) => (
            <div
              key={m.mes}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 15,
                fontWeight: 500,
                color: '#334155',
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function GruposCard({ data }: { data: ApresentacaoOpexData }) {
  const parcialMes = data.mesParcial != null ? MESES_CURTOS[data.mesParcial - 1] : null
  const anoCurto = String(data.ano).slice(-2)

  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        background: '#FFFFFF',
        border: '1px solid #E6E8EB',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1F2937', marginBottom: 8 }}>
        Grupos de conta considerados no OPEX · {data.grupos.length} grupos, {data.totalPlanos}{' '}
        planos (em ordem de valor em {data.ano})
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          columnGap: 18,
          rowGap: 4,
        }}
      >
        {data.grupos.map((g) => (
          <div
            key={g.grupoConta}
            style={{
              fontSize: 14,
              color: '#334155',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {g.nome} <span style={{ color: '#94A3B8' }}>({g.planos})</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.4, color: '#475569' }}>
        <strong style={{ fontWeight: 700, color: '#334155' }}>Fora do OPEX:</strong>{' '}
        {FORA_DO_OPEX} Base caixa (data de pagamento), fonte SIOE/VIOS.
        {parcialMes && data.parcialAte
          ? ` *${parcialMes}/${anoCurto} parcial, até ${data.parcialAte}.`
          : ''}
      </div>
    </div>
  )
}

export function ApresentacaoOpexBloco({
  data,
  loading = false,
  error = null,
  ano,
  mesInicio,
  mesFim,
  onMesInicioChange,
  onMesFimChange,
  planoFiltroAtivo = false,
}: Props) {
  const [mostrarValores, setMostrarValores] = useState(false)

  const mesAtual = opexMesAtualRef(ano)
  const teto = mesAtual > 0 ? mesAtual : 12
  const mesEmCurso = ano === new Date().getFullYear() ? mesAtual : null
  const meses = mesesApresentacaoOpex(ano, mesInicio, mesFim)
  const periodo = periodoTexto(meses)

  const anoAnterior = ano - 1
  const ytd = ano === new Date().getFullYear() && meses[0] === 1
  const anoInteiro = meses.length === 12
  const sufixoPeriodo = ytd || anoInteiro ? '' : ` · ${periodo}`
  const rotuloAnterior = `${anoAnterior}${sufixoPeriodo}`
  const rotuloAtual = ytd ? `${ano}-YTD` : `${ano}${sufixoPeriodo}`

  const thinBtn: CSSProperties = {
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    borderRadius: 6,
    border: '1px solid #CBD5E1',
    background: mostrarValores ? '#F8FAFC' : '#FFFFFF',
    padding: '0 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: FONT,
      }}
    >
      {/* Controles — fora do export PPT */}
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
          Período OPEX (YoY)
        </span>
        <MesSelect
          label="De"
          value={mesInicio}
          onChange={onMesInicioChange}
          teto={teto}
          mesEmCurso={mesEmCurso}
        />
        <MesSelect
          label="Até"
          value={mesFim}
          onChange={onMesFimChange}
          teto={teto}
          mesEmCurso={mesEmCurso}
        />
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD_DARK }}>
          {periodo} · {ano} vs {anoAnterior}
        </span>
        {planoFiltroAtivo ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#B45309' }}>
            Usando o filtro de planos da página OPEX
          </span>
        ) : null}
        <button type="button" onClick={() => setMostrarValores((v) => !v)} style={thinBtn}>
          {mostrarValores ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {mostrarValores ? 'Ocultar valores (só %)' : 'Mostrar valores'}
        </button>
      </div>

      <div
        data-apresentacao-export="opex"
        style={{
          width: '100%',
          minWidth: 1100,
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: 4,
          fontFamily: FONT,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {error ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #FECACA',
              background: '#FEF2F2',
              fontSize: 12,
              color: '#B91C1C',
            }}
          >
            Erro ao carregar OPEX: {error.message}
          </div>
        ) : loading || !data ? (
          <div style={{ display: 'grid', gap: 8, padding: 4 }}>
            <div style={{ height: 44, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
            <div style={{ height: 240, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
            <div style={{ height: 110, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                flexWrap: 'nowrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <Legenda cor={COR_ANTERIOR} texto={`Realizado ${anoAnterior}`} />
                <Legenda cor={COR_ATUAL} texto={`Realizado ${ano}`} />
                <span style={{ fontSize: 13, color: '#64748B' }}>
                  % acima das barras = variação de {ano} sobre {anoAnterior}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexShrink: 0 }}>
                {mostrarValores ? (
                  <>
                    <KpiTotal
                      rotulo={rotuloAnterior}
                      valor={formatTotal(data.totalAnterior)}
                      cor="#475569"
                    />
                    <KpiTotal
                      rotulo={rotuloAtual}
                      valor={formatTotal(data.totalAtual)}
                      cor={COR_ATUAL}
                    />
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#64748B',
                      textAlign: 'right',
                      lineHeight: 1.3,
                    }}
                  >
                    Variação {rotuloAtual}
                    <br />
                    sobre {rotuloAnterior}
                  </span>
                )}
                <BadgeVariacao valor={data.variacaoPct} />
              </div>
            </div>

            <Grafico data={data} mostrarValores={mostrarValores} />

            <GruposCard data={data} />
          </>
        )}
      </div>
    </div>
  )
}
