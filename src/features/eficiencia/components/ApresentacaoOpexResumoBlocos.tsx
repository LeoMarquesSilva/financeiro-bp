import { useState, type CSSProperties, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { formatCurrency } from '@/shared/utils/format'
import { opexMesAtualRef } from '../utils/apresentacaoOpex'
import {
  listaPtBr,
  type ApresentacaoOpexMesData,
  type ApresentacaoOpexPeriodoData,
} from '../utils/apresentacaoOpexResumo'
import { MesSelect } from './ApresentacaoOpexBloco'

const FONT = 'Segoe UI, system-ui, sans-serif'
const NAVY = '#101F2E'
const GOLD = '#D5B170'
const GOLD_TXT = '#C49A45'
const GOLD_ESCURO = '#A8843A'
const VERDE = '#4F7A2A'
/** Gasto acima (ruim) / abaixo (bom). */
const ALTA = '#C2410C'
const QUEDA = '#15803D'
const MENOS = '−'

function num(v: number, casas: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function sinal(v: number): string {
  return v > 0 ? '+' : v < 0 ? MENOS : ''
}

/** `+17,4%` / `−4,4%`. */
function pctSinal(v: number | null, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${sinal(v)}${num(Math.abs(v), casas)}%`
}

/** `↑ 17,40%` */
function pctSeta(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const seta = v > 0 ? '↑ ' : v < 0 ? '↓ ' : ''
  return `${seta}${num(Math.abs(v), 2)}%`
}

function corSeta(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v === 0) return '#475569'
  return v > 0 ? ALTA : QUEDA
}

/** `R$ 1,05 mi` / `R$ 227 mil`. */
function valorCurto(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${num(a / 1_000_000, 2)} mi`
  return `R$ ${num(a / 1_000, 0)} mil`
}

function acimaAbaixo(v: number): string {
  return v >= 0 ? 'acima' : 'abaixo'
}

// ─── Peças visuais ─────────────────────────────────────────────────────────

/** Só a linha do período — o título "OPEX" fica no slide do PPT, não no print. */
function SlideTitulo({ subtitulo }: { subtitulo: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        data-chart-export-preserve-bg
        style={{
          borderLeft: `3px solid ${GOLD}`,
          paddingLeft: 8,
          fontSize: 14,
          color: '#334155',
          lineHeight: 1.3,
        }}
      >
        {subtitulo}
      </span>
    </div>
  )
}

function KpiCard({
  titulo,
  valor,
  cor,
  sub,
}: {
  titulo: string
  valor: string
  cor: string
  sub: string
}) {
  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        flex: 1,
        minWidth: 0,
        background: '#FFFFFF',
        borderLeft: `4px solid ${GOLD}`,
        borderRadius: 6,
        padding: '12px 14px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: '#1F2937',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        {titulo}
      </span>
      <span
        style={{
          fontSize: 25,
          fontWeight: 700,
          color: cor,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </span>
      <span style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.3 }}>{sub}</span>
    </div>
  )
}

function CardBranco({
  titulo,
  subtitulo,
  children,
  rodape,
}: {
  titulo: string
  subtitulo: string
  children: ReactNode
  rodape: ReactNode
}) {
  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        flex: 1.55,
        minWidth: 0,
        background: '#FFFFFF',
        borderRadius: 8,
        padding: '16px 18px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>{titulo}</div>
        <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{subtitulo}</div>
      </div>
      {children}
      <div style={{ fontSize: 12.5, color: '#334155' }}>{rodape}</div>
    </div>
  )
}

type LeituraItem = { destaque: string; texto: string }

function LeituraCard({ titulo, itens }: { titulo: string; itens: LeituraItem[] }) {
  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: NAVY,
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>{titulo}</span>
      {itens.map((it) => (
        <div key={it.destaque + it.texto} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: GOLD,
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {it.destaque}
          </span>
          <span style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.35 }}>{it.texto}</span>
        </div>
      ))}
    </div>
  )
}

function Controles({
  titulo,
  children,
  mostrarValores,
  onToggle,
}: {
  titulo: string
  children: ReactNode
  mostrarValores: boolean
  onToggle: () => void
}) {
  return (
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
      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{titulo}</span>
      {children}
      <button
        type="button"
        onClick={onToggle}
        style={{
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
        }}
      >
        {mostrarValores ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        {mostrarValores ? 'Ocultar valores (só %)' : 'Mostrar valores'}
      </button>
    </div>
  )
}

function EstadoBloco({ loading, error }: { loading: boolean; error: Error | null }) {
  if (error) {
    return (
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
    )
  }
  if (!loading) return null
  return (
    <div style={{ display: 'grid', gap: 8, padding: 4 }}>
      <div style={{ height: 56, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
      <div style={{ height: 96, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
      <div style={{ height: 260, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
    </div>
  )
}

const exportRootStyle: CSSProperties = {
  width: '100%',
  minWidth: 1100,
  boxSizing: 'border-box',
  backgroundColor: 'transparent',
  padding: 4,
  fontFamily: FONT,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

function NotaParcial({ mes, ano, ate }: { mes: string; ano: number; ate: string }) {
  return (
    <div style={{ fontSize: 11.5, color: '#64748B' }}>
      *{mes}/{String(ano).slice(-2)} parcial, até {ate}.
    </div>
  )
}

// ─── Bloco 14 — período ─────────────────────────────────────────────────────

function BarrasTopGrupos({
  data,
  mostrarValores,
}: {
  data: ApresentacaoOpexPeriodoData
  mostrarValores: boolean
}) {
  const max = Math.max(1, ...data.topGrupos.map((g) => g.realizado))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.topGrupos.map((g) => (
        <div key={g.nome} style={{ display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              width: 200,
              flexShrink: 0,
              paddingRight: 10,
              textAlign: 'right',
              fontSize: 13,
              color: '#1F2937',
              whiteSpace: 'nowrap',
            }}
          >
            {g.nome}
          </span>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderLeft: '1px solid #94A3B8',
              height: 30,
            }}
          >
            <div
              data-chart-export-preserve-bg
              style={{
                width: `${(g.realizado / max) * 74}%`,
                height: 24,
                backgroundColor: NAVY,
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                color: '#1F2937',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {mostrarValores ? `R$ ${num(g.realizado, 0)}` : `${num(g.participacao, 1)}%`}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function leituraPeriodo(d: ApresentacaoOpexPeriodoData, mostrarValores: boolean): LeituraItem[] {
  const itens: LeituraItem[] = []
  const diff = d.realizado - d.orcamento
  const yoyTxt =
    d.yoyPct != null ? ` e ${pctSinal(d.yoyPct)} sobre ${d.periodoCurto}/${d.anoAnterior}` : ''

  if (d.variacaoOrcPct != null) {
    itens.push(
      mostrarValores
        ? {
            destaque: valorCurto(diff),
            texto: `${acimaAbaixo(diff)} do orçado no período (${pctSinal(d.variacaoOrcPct)})${yoyTxt}.`,
          }
        : {
            destaque: pctSinal(d.variacaoOrcPct),
            texto: `${acimaAbaixo(diff)} do orçado no período${yoyTxt}.`,
          },
    )
  }

  if (d.consumoAnoPct != null) {
    const n = d.meses.length
    itens.push({
      destaque: `${num(d.consumoAnoPct, 0)}%`,
      texto: d.ytd
        ? `do orçamento do ano já consumido em ${n} ${n === 1 ? 'mês' : 'meses'}.`
        : `do orçamento do ano consumido em ${d.periodoCurto}.`,
    })
  }

  if (d.projecaoAno != null && d.projecaoVsOrcAnoPct != null) {
    const v = d.projecaoVsOrcAnoPct
    itens.push(
      mostrarValores
        ? {
            destaque: `≈ ${valorCurto(d.projecaoAno)}`,
            texto: `projeção do ano no ritmo atual, ${num(Math.abs(v), 0)}% ${acimaAbaixo(v)} do orçamento anual.`,
          }
        : {
            destaque: `${sinal(v)}${num(Math.abs(v), 0)}%`,
            texto: `projeção do ano no ritmo atual ${v >= 0 ? 'acima' : 'abaixo'} do orçamento anual.`,
          },
    )
  } else if (d.mesesComOrcado > 0) {
    itens.push({
      destaque: `${d.mesesAcimaOrcado} de ${d.mesesComOrcado}`,
      texto: `${d.mesesComOrcado === 1 ? 'mês' : 'meses'} com realizado acima do orçado.`,
    })
  }

  return itens
}

type PeriodoProps = {
  data: ApresentacaoOpexPeriodoData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mesInicio: number
  mesFim: number
  onMesInicioChange: (mes: number) => void
  onMesFimChange: (mes: number) => void
}

export function ApresentacaoOpexPeriodoBloco({
  data,
  loading = false,
  error = null,
  ano,
  mesInicio,
  mesFim,
  onMesInicioChange,
  onMesFimChange,
}: PeriodoProps) {
  const [mostrarValores, setMostrarValores] = useState(false)
  const mesAtual = opexMesAtualRef(ano)
  const teto = mesAtual > 0 ? mesAtual : 12
  const mesEmCurso = ano === new Date().getFullYear() ? mesAtual : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      <Controles
        titulo="Período OPEX"
        mostrarValores={mostrarValores}
        onToggle={() => setMostrarValores((v) => !v)}
      >
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
        <span style={{ fontSize: 11, color: '#64748B' }}>mesmo período do Bloco 13</span>
      </Controles>

      <div data-apresentacao-export="opex_periodo" style={exportRootStyle}>
        {error || loading || !data ? (
          <EstadoBloco loading={loading || !data} error={error} />
        ) : (
          <>
            <SlideTitulo subtitulo={data.titulo} />
            <div style={{ display: 'flex', gap: 12 }}>
              {mostrarValores ? (
                <>
                  <KpiCard
                    titulo="Realizado no período"
                    valor={formatCurrency(data.realizado)}
                    cor={GOLD_TXT}
                    sub={`${data.periodoCurto} / ${data.ano}`}
                  />
                  <KpiCard
                    titulo="Orçamento no período"
                    valor={formatCurrency(data.orcamento)}
                    cor={VERDE}
                    sub={`Previsto VIOS: ${formatCurrency(data.previstoVios)}`}
                  />
                  <KpiCard
                    titulo="Orçamento no ano"
                    valor={formatCurrency(data.orcamentoAno)}
                    cor={VERDE}
                    sub={`Previsto VIOS anual: ${formatCurrency(data.previstoViosAno)}`}
                  />
                  <KpiCard
                    titulo="Variação do período"
                    valor={pctSeta(data.variacaoOrcPct)}
                    cor={corSeta(data.variacaoOrcPct)}
                    sub="Realizado vs orçamento no período"
                  />
                  <KpiCard
                    titulo="Vs. ano anterior"
                    valor={pctSeta(data.yoyPct)}
                    cor={corSeta(data.yoyPct)}
                    sub={`Realizado ${data.periodoCurto}/${data.anoAnterior}: ${formatCurrency(data.realizadoAnterior)}`}
                  />
                </>
              ) : (
                <>
                  <KpiCard
                    titulo="Variação do período"
                    valor={pctSeta(data.variacaoOrcPct)}
                    cor={corSeta(data.variacaoOrcPct)}
                    sub="Realizado vs orçamento no período"
                  />
                  <KpiCard
                    titulo="Meses acima do orçado"
                    valor={
                      data.mesesComOrcado > 0
                        ? `${data.mesesAcimaOrcado} de ${data.mesesComOrcado}`
                        : '—'
                    }
                    cor={data.mesesAcimaOrcado > 0 ? ALTA : QUEDA}
                    sub="Meses fechados com realizado acima do orçado"
                  />
                  <KpiCard
                    titulo="Orçamento do ano consumido"
                    valor={data.consumoAnoPct != null ? `${num(data.consumoAnoPct, 1)}%` : '—'}
                    cor={NAVY}
                    sub={
                      data.ytd
                        ? `Em ${data.meses.length} ${data.meses.length === 1 ? 'mês' : 'meses'} (${data.periodoCurto}/${data.ano})`
                        : `No período ${data.periodoCurto}/${data.ano}`
                    }
                  />
                  <KpiCard
                    titulo="Vs. ano anterior"
                    valor={pctSeta(data.yoyPct)}
                    cor={corSeta(data.yoyPct)}
                    sub={`${data.periodoCurto}/${data.ano} vs ${data.periodoCurto}/${data.anoAnterior}`}
                  />
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
              <CardBranco
                titulo="O que mais gasta"
                subtitulo={`Maiores grupos no realizado ${data.periodoCurto}/${data.ano}${mostrarValores ? '' : ' · % do realizado'}`}
                rodape={
                  <>
                    Top {data.topGrupos.length} concentram{' '}
                    <strong>{num(data.top5Pct, 2)}%</strong> do realizado
                    {data.topGrupos[0] ? (
                      <>
                        {' '}
                        · {data.topGrupos[0].nome.toLocaleLowerCase('pt-BR')} sozinha responde por{' '}
                        <strong>{num(data.topGrupos[0].participacao, 1)}%</strong>
                      </>
                    ) : null}
                  </>
                }
              >
                <BarrasTopGrupos data={data} mostrarValores={mostrarValores} />
              </CardBranco>
              <LeituraCard
                titulo="Leitura do período"
                itens={leituraPeriodo(data, mostrarValores)}
              />
            </div>
            {data.mesParcial != null && data.parcialAte ? (
              <NotaParcial
                mes={data.periodoCurto.split('–').pop() ?? ''}
                ano={data.ano}
                ate={data.parcialAte}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Bloco 15 — mês ─────────────────────────────────────────────────────────

const thMes: CSSProperties = {
  backgroundColor: NAVY,
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: 700,
  padding: '9px 10px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
}

function corDesvio(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v === 0) return '#334155'
  return v > 0 ? ALTA : GOLD_ESCURO
}

function TabelaMes({
  data,
  mostrarValores,
}: {
  data: ApresentacaoOpexMesData
  mostrarValores: boolean
}) {
  const td: CSSProperties = {
    padding: '9px 10px',
    fontSize: 12.5,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid #E5E7EB',
  }
  const cabecalho = mostrarValores
    ? ['Realizado (R$)', 'Orçado (R$)', 'Variação (R$)', '% do orçado']
    : ['Part. no mês', 'Variação (%)', '% do orçado']

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th data-chart-export-preserve-bg style={{ ...thMes, textAlign: 'left' }}>
            Grupo
          </th>
          {cabecalho.map((c) => (
            <th key={c} data-chart-export-preserve-bg style={thMes}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.linhas.map((l, i) => {
          const zebra = i % 2 === 1 ? '#F7F5F0' : '#FFFFFF'
          const varPct = l.pctOrcado != null ? l.pctOrcado - 100 : null
          return (
            <tr key={l.nome} data-chart-export-preserve-bg style={{ backgroundColor: zebra }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: '#1F2937' }}>
                {l.nome}
              </td>
              {mostrarValores ? (
                <>
                  <td style={{ ...td, color: '#1F2937' }}>{num(l.realizado, 2)}</td>
                  <td style={{ ...td, color: '#1F2937' }}>{num(l.orcado, 2)}</td>
                  <td style={{ ...td, color: corDesvio(l.variacao) }}>
                    {sinal(l.variacao)}
                    {num(Math.abs(l.variacao), 2)}
                  </td>
                </>
              ) : (
                <>
                  <td style={{ ...td, color: '#1F2937' }}>{num(l.participacao, 1)}%</td>
                  <td style={{ ...td, color: corDesvio(varPct) }}>{pctSinal(varPct)}</td>
                </>
              )}
              <td style={{ ...td, color: corDesvio(varPct) }}>
                {l.pctOrcado != null ? `${num(l.pctOrcado, 1)}%` : 'sem orçado'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function leituraMes(d: ApresentacaoOpexMesData, mostrarValores: boolean): LeituraItem[] {
  const itens: LeituraItem[] = []
  const diff = d.realizado - d.orcamento
  // Previsto VIOS só no modo com valores (como no modelo); no modo % a base é só o orçado.
  const viosTxt =
    mostrarValores && d.variacaoViosPct != null
      ? ` e ${num(Math.abs(d.variacaoViosPct), 1)}% ${acimaAbaixo(d.variacaoViosPct)} do previsto VIOS`
      : ''

  if (d.variacaoOrcPct != null) {
    itens.push(
      mostrarValores
        ? {
            destaque: valorCurto(diff),
            texto: `${acimaAbaixo(diff)} do orçado no mês (${pctSinal(d.variacaoOrcPct)})${viosTxt}.`,
          }
        : {
            destaque: pctSinal(d.variacaoOrcPct),
            texto: `${acimaAbaixo(diff)} do orçado no mês${viosTxt}.`,
          },
    )
  }

  if (d.desvio) {
    const n = d.desvio.contas.length
    itens.push({
      destaque: `${num(d.desvio.pct, 0)}% ${d.desvio.tipo === 'estouro' ? 'do desvio' : 'da economia'}`,
      texto: `vem de ${n} ${n === 1 ? 'conta' : 'contas'}: ${listaPtBr(d.desvio.contas)}.`,
    })
  }

  if (d.maior) {
    const v = d.maior.variacaoPct
    itens.push(
      v == null
        ? { destaque: '—', texto: `${d.maior.nome}, o maior gasto, não tinha orçamento no mês.` }
        : {
            destaque: pctSinal(v),
            texto: `${d.maior.nome}, o maior gasto, ficou ${acimaAbaixo(v)} do orçado.`,
          },
    )
  }

  return itens
}

type MesProps = {
  data: ApresentacaoOpexMesData | null
  loading?: boolean
  error?: Error | null
  ano: number
  mes: number
  onMesChange: (mes: number) => void
}

export function ApresentacaoOpexMesBloco({
  data,
  loading = false,
  error = null,
  ano,
  mes,
  onMesChange,
}: MesProps) {
  const [mostrarValores, setMostrarValores] = useState(false)
  const mesAtual = opexMesAtualRef(ano)
  const teto = mesAtual > 0 ? mesAtual : 12
  const mesEmCurso = ano === new Date().getFullYear() ? mesAtual : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      <Controles
        titulo="Mês OPEX"
        mostrarValores={mostrarValores}
        onToggle={() => setMostrarValores((v) => !v)}
      >
        <MesSelect
          label="Mês"
          value={mes}
          onChange={onMesChange}
          teto={teto}
          mesEmCurso={mesEmCurso}
        />
      </Controles>

      <div data-apresentacao-export="opex_mes" style={exportRootStyle}>
        {error || loading || !data ? (
          <EstadoBloco loading={loading || !data} error={error} />
        ) : (
          <>
            <SlideTitulo subtitulo={data.titulo} />
            <div style={{ display: 'flex', gap: 12 }}>
              {mostrarValores ? (
                <>
                  <KpiCard
                    titulo="Realizado no mês"
                    valor={formatCurrency(data.realizado)}
                    cor={GOLD_TXT}
                    sub={`${data.mesCurto} / ${data.ano}${data.parcial ? '*' : ''}`}
                  />
                  <KpiCard
                    titulo="Orçamento no mês"
                    valor={formatCurrency(data.orcamento)}
                    cor={VERDE}
                    sub={`Previsto VIOS: ${formatCurrency(data.previstoVios)}`}
                  />
                  <KpiCard
                    titulo="Orçamento no ano"
                    valor={formatCurrency(data.orcamentoAno)}
                    cor={VERDE}
                    sub={`Previsto VIOS anual: ${formatCurrency(data.previstoViosAno)}`}
                  />
                  <KpiCard
                    titulo="Variação do mês"
                    valor={pctSeta(data.variacaoOrcPct)}
                    cor={corSeta(data.variacaoOrcPct)}
                    sub="Realizado vs orçamento no mês"
                  />
                  <KpiCard
                    titulo="Vs. ano anterior"
                    valor={pctSeta(data.yoyPct)}
                    cor={corSeta(data.yoyPct)}
                    sub={`Realizado ${data.mesCurto}/${data.anoAnterior}: ${formatCurrency(data.realizadoAnterior)}`}
                  />
                </>
              ) : (
                <>
                  <KpiCard
                    titulo="Variação do mês"
                    valor={pctSeta(data.variacaoOrcPct)}
                    cor={corSeta(data.variacaoOrcPct)}
                    sub="Realizado vs orçamento no mês"
                  />
                  <KpiCard
                    titulo="Grupos acima do orçado"
                    valor={
                      data.gruposTotal > 0
                        ? `${data.gruposAcimaOrcado} de ${data.gruposTotal}`
                        : '—'
                    }
                    cor={data.gruposAcimaOrcado > 0 ? ALTA : QUEDA}
                    sub="Grupos de conta com realizado acima do orçado no mês"
                  />
                  <KpiCard
                    titulo="Vs. ano anterior"
                    valor={pctSeta(data.yoyPct)}
                    cor={corSeta(data.yoyPct)}
                    sub={`${data.mesCurto}/${data.ano} vs ${data.mesCurto}/${data.anoAnterior}`}
                  />
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
              <CardBranco
                titulo="O que mais gasta"
                subtitulo={`Maiores grupos no realizado de ${data.titulo.split(' ')[0]!.toLocaleLowerCase('pt-BR')}, contra o orçado`}
                rodape={
                  <>
                    Top {data.linhas.length} concentram <strong>{num(data.top5Pct, 2)}%</strong>{' '}
                    do realizado do mês
                  </>
                }
              >
                <TabelaMes data={data} mostrarValores={mostrarValores} />
              </CardBranco>
              <LeituraCard titulo="Leitura do mês" itens={leituraMes(data, mostrarValores)} />
            </div>
            {data.parcial && data.parcialAte ? (
              <NotaParcial mes={data.mesCurto} ano={data.ano} ate={data.parcialAte} />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
