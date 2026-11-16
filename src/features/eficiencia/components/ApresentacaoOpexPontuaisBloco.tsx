import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { opexMesAtualRef } from '../utils/apresentacaoOpex'
import {
  OPEX_PONTUAL_LIMITE_PADRAO,
  OPEX_PONTUAL_MAX_MESES_HISTORICO,
  ddmmIso,
  ehPontualPelaRegra,
  montarDesdobramento,
  type ApresentacaoOpexPontuaisBase,
  type OpexDesdobramento,
} from '../utils/apresentacaoOpexPontuais'
import { MesSelect } from './ApresentacaoOpexBloco'

const FONT = 'Segoe UI, system-ui, sans-serif'
const NAVY = '#14213A'
const ALTA = '#C2410C'
const ALTA_BG = '#FBE7DE'
const OK = '#0E7C5A'
const OK_BG = '#E3F1EA'
const NEUTRO_BG = '#F1F0EC'
const NEUTRO_TXT = '#4B5563'
const BORDA = '#CFCCC6'
const MENOS = '−'
const LIMITES = [5_000, 10_000, 20_000, 50_000]

function num(v: number, casas: number): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function pctSinal(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = v > 0 ? '+' : v < 0 ? MENOS : ''
  return `${s}${num(Math.abs(v), 1)}%`
}

/** `R$ 735,8 mil` / `R$ 1,23 mi` */
function valorMil(v: number, casas = 1): string {
  const a = Math.abs(v)
  const s = v < 0 ? MENOS : ''
  if (a >= 1_000_000) return `${s}R$ ${num(a / 1_000_000, 2)} mi`
  return `${s}R$ ${num(a / 1_000, casas)} mil`
}

function rotuloMes(nome: string, ano: number): string {
  return `${nome}/${String(ano).slice(-2)}`
}

// ─── Painel (fora do print) ──────────────────────────────────────────────────

function PainelPontuais({
  base,
  limite,
  onLimiteChange,
  selecionados,
  onToggle,
  ajustado,
  onVoltarRegra,
}: {
  base: ApresentacaoOpexPontuaisBase
  limite: number
  onLimiteChange: (v: number) => void
  selecionados: ReadonlySet<number>
  onToggle: (ciItem: number) => void
  ajustado: boolean
  onVoltarRegra: () => void
}) {
  const th: CSSProperties = {
    padding: 6,
    fontSize: 10.5,
    fontWeight: 700,
    color: '#475569',
    textAlign: 'left',
    borderBottom: '1px solid #E2E8F0',
    position: 'sticky',
    top: 0,
    background: '#F8FAFC',
  }
  const td: CSSProperties = {
    padding: '5px 6px',
    fontSize: 11,
    borderBottom: '1px solid #EEF0F3',
    verticalAlign: 'middle',
  }

  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        background: '#FFFFFF',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.45 }}>
        <strong>Regra (dados do OPEX):</strong> pago no mês, em grupo não fixo, a partir do
        limite, e o mesmo fornecedor não recebeu no mesmo plano em mais de{' '}
        {OPEX_PONTUAL_MAX_MESES_HISTORICO} dos 12 meses anteriores (parcelas de um mesmo gasto
        continuam pontuais). Marque ou desmarque para ajustar o print; o ajuste não é salvo.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <span style={{ fontWeight: 600, color: '#64748B' }}>A partir de</span>
          <select
            value={limite}
            onChange={(e) => onLimiteChange(Number(e.target.value))}
            style={{
              height: 28,
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              background: '#fff',
              padding: '0 8px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {LIMITES.map((l) => (
              <option key={l} value={l}>
                R$ {num(l / 1000, 0)} mil
              </option>
            ))}
          </select>
        </label>
        {ajustado ? (
          <button
            type="button"
            onClick={onVoltarRegra}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 28,
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              padding: '0 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} aria-hidden />
            Voltar à regra
          </button>
        ) : null}
        <span style={{ fontSize: 11, color: '#64748B' }}>
          {base.candidatos.length} lançamentos de grupos não fixos a partir de R$ 5 mil
        </span>
      </div>
      <div style={{ maxHeight: 340, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }} />
              <th style={{ ...th, textAlign: 'right' }}>Valor</th>
              <th style={th}>Pago em</th>
              <th style={th}>Lançamento no OPEX</th>
              <th style={th}>Nome no slide</th>
              <th style={th}>Histórico (12 meses)</th>
            </tr>
          </thead>
          <tbody>
            {base.candidatos.map((c) => {
              const marcado = selecionados.has(c.ciItem)
              const pelaRegra = ehPontualPelaRegra(c, limite)
              const recorrente = c.mesesHistorico > OPEX_PONTUAL_MAX_MESES_HISTORICO
              return (
                <tr key={c.ciItem} style={{ background: marcado ? '#FFF7ED' : undefined }}>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => onToggle(c.ciItem)}
                      aria-label={`Incluir ${c.gasto}`}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {valorMil(c.valor)}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748B' }}>
                    {ddmmIso(c.dataPagamento)}
                  </td>
                  <td style={{ ...td, color: '#334155' }}>
                    <div style={{ fontWeight: 600 }}>{c.descricao || '—'}</div>
                    <div style={{ color: '#64748B' }}>
                      {c.fornecedor} · {c.grupo} / {c.planoContas}
                      {c.departamento ? ` · ${c.departamento}` : ''}
                    </div>
                  </td>
                  <td style={{ ...td, color: '#1F2937' }}>
                    {c.gasto}
                    <div style={{ color: '#64748B' }}>{c.grupo}</div>
                  </td>
                  <td
                    style={{
                      ...td,
                      whiteSpace: 'nowrap',
                      color: recorrente ? '#B45309' : '#047857',
                      fontWeight: 600,
                    }}
                  >
                    {c.mesesHistorico === 0
                      ? 'Primeira vez'
                      : `Pago em ${c.mesesHistorico} de 12 meses`}
                    <div style={{ fontWeight: 400, color: '#64748B' }}>
                      {pelaRegra
                        ? 'Pontual pela regra'
                        : recorrente
                          ? 'Recorrente'
                          : 'Abaixo do limite'}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Slide ───────────────────────────────────────────────────────────────────

function CardComparativo({
  rotulo,
  valor,
  cor,
  fundo,
}: {
  rotulo: string
  valor: string
  cor: string
  fundo: string
}) {
  return (
    <div
      data-overview-copy-card
      data-chart-export-preserve-bg
      style={{
        backgroundColor: fundo,
        borderRadius: 8,
        padding: '14px 20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <span style={{ fontSize: 15, color: '#374151' }}>{rotulo}</span>
      <span
        style={{
          fontSize: 32,
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

function manchete(
  b: ApresentacaoOpexPontuaisBase,
  d: OpexDesdobramento,
  mostrarValores: boolean,
): string {
  const mes = rotuloMes(b.mesNome, b.ano)
  if (d.linhas.length === 0) return `${mes}: nenhum gasto pontual no mês`
  const explicaPico =
    b.yoyPct != null &&
    b.yoyPct > 0 &&
    d.semPontuaisYoyPct != null &&
    d.semPontuaisYoyPct < b.yoyPct
  if (explicaPico) {
    const quanto = mostrarValores
      ? `${valorMil(d.totalPontual, 0)} em gastos pontuais`
      : `gastos pontuais (${num(d.pctPontualMes, 1)}% do mês)`
    return `${mes}: ${quanto} explicam o pico`
  }
  return mostrarValores
    ? `${mes}: ${valorMil(d.totalPontual, 0)} em gastos pontuais no mês`
    : `${mes}: gastos pontuais somam ${num(d.pctPontualMes, 1)}% do mês`
}

function SlidePontuais({
  base,
  d,
  mostrarValores,
}: {
  base: ApresentacaoOpexPontuaisBase
  d: OpexDesdobramento
  mostrarValores: boolean
}) {
  const mesAtualTxt = rotuloMes(base.mesNome, base.ano)
  const mesAntTxt = rotuloMes(base.mesNome, base.anoAnterior)
  const subiu = (base.yoyPct ?? 0) > 0
  const semMelhor =
    d.semPontuaisYoyPct != null && (base.yoyPct == null || d.semPontuaisYoyPct < base.yoyPct)
  const mesMin = base.mesNome.toLocaleLowerCase('pt-BR')
  const aa = String(base.ano).slice(-2)

  const th: CSSProperties = {
    padding: '9px 8px',
    fontSize: 15,
    fontWeight: 700,
    color: '#1F2937',
    textAlign: 'left',
    border: `1px solid ${BORDA}`,
    backgroundColor: '#E9E7E2',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
  }
  const td: CSSProperties = {
    padding: '9px 8px',
    fontSize: 15,
    color: '#1F2937',
    border: `1px solid ${BORDA}`,
    verticalAlign: 'top',
  }
  const tdValor: CSSProperties = {
    ...td,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }

  return (
    <>
      <div style={{ fontSize: 32, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>
        {manchete(base, d, mostrarValores)}
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mostrarValores ? (
            <CardComparativo
              rotulo={mesAntTxt}
              valor={valorMil(base.realizadoAnterior)}
              cor={NEUTRO_TXT}
              fundo={NEUTRO_BG}
            />
          ) : (
            <CardComparativo
              rotulo="Gastos pontuais"
              valor={`${num(d.pctPontualMes, 1)}% do mês`}
              cor={NEUTRO_TXT}
              fundo={NEUTRO_BG}
            />
          )}
          <CardComparativo
            rotulo={
              mostrarValores ? `${mesAtualTxt}, como está` : `${mesAtualTxt}, como está · vs ${mesAntTxt}`
            }
            valor={
              mostrarValores
                ? `${valorMil(base.realizado)} ${pctSinal(base.yoyPct)}`
                : pctSinal(base.yoyPct)
            }
            cor={subiu ? ALTA : OK}
            fundo={subiu ? ALTA_BG : OK_BG}
          />
          <CardComparativo
            rotulo={
              mostrarValores
                ? `${mesAtualTxt}, sem os pontuais`
                : `${mesAtualTxt}, sem os pontuais · vs ${mesAntTxt}`
            }
            valor={
              mostrarValores
                ? `${valorMil(d.semPontuais)} ${pctSinal(d.semPontuaisYoyPct)}`
                : pctSinal(d.semPontuaisYoyPct)
            }
            cor={semMelhor ? OK : ALTA}
            fundo={semMelhor ? OK_BG : ALTA_BG}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>
            Gastos que não se repetem em {mesMin}/{aa}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th data-chart-export-preserve-bg style={th}>Gasto</th>
                <th data-chart-export-preserve-bg style={th}>Grupo</th>
                <th data-chart-export-preserve-bg style={{ ...th, width: 90 }}>Data</th>
                <th data-chart-export-preserve-bg style={{ ...th, width: 140, textAlign: 'right' }}>
                  {mostrarValores ? 'Valor' : '% do mês'}
                </th>
              </tr>
            </thead>
            <tbody>
              {d.linhas.length === 0 ? (
                <tr>
                  <td style={{ ...td, color: '#64748B' }} colSpan={4}>
                    Nenhum gasto pontual neste mês.
                  </td>
                </tr>
              ) : (
                d.linhas.map((l) => (
                  <tr key={l.ciItem}>
                    <td style={td}>{l.gasto}</td>
                    <td style={td}>{l.grupo}</td>
                    <td style={td}>{l.data}</td>
                    <td style={tdValor}>
                      {mostrarValores ? valorMil(l.valor) : `${num(l.pctMes, 1)}%`}
                    </td>
                  </tr>
                ))
              )}
              <tr data-chart-export-preserve-bg style={{ backgroundColor: NEUTRO_BG }}>
                <td style={td}>Total pontual</td>
                <td style={td} />
                <td style={td} />
                <td style={tdValor}>
                  {mostrarValores ? valorMil(d.totalPontual) : `${num(d.pctPontualMes, 1)}%`}
                </td>
              </tr>
            </tbody>
          </table>
          {base.parcial && base.parcialAte ? (
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {mesMin}/{aa} parcial, até {base.parcialAte}.
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

type Props = {
  data: ApresentacaoOpexPontuaisBase | null
  loading?: boolean
  error?: Error | null
  ano: number
  mes: number
  onMesChange: (mes: number) => void
}

export function ApresentacaoOpexPontuaisBloco({
  data,
  loading = false,
  error = null,
  ano,
  mes,
  onMesChange,
}: Props) {
  const [mostrarValores, setMostrarValores] = useState(false)
  const [painelAberto, setPainelAberto] = useState(false)
  const [limite, setLimite] = useState(OPEX_PONTUAL_LIMITE_PADRAO)
  /** Ajustes manuais do print (não salvos), por ano/mês. */
  const [ajustes, setAjustes] = useState<{ chave: string; mapa: Record<number, boolean> }>({
    chave: '',
    mapa: {},
  })
  const mesAtual = opexMesAtualRef(ano)
  const teto = mesAtual > 0 ? mesAtual : 12
  const mesEmCurso = ano === new Date().getFullYear() ? mesAtual : null

  const chave = data ? `${data.ano}-${data.mes}` : ''
  const mapa = ajustes.chave === chave ? ajustes.mapa : {}

  const selecionados = useMemo(() => {
    const s = new Set<number>()
    for (const c of data?.candidatos ?? []) {
      const manual = mapa[c.ciItem]
      if (manual ?? ehPontualPelaRegra(c, limite)) s.add(c.ciItem)
    }
    return s
  }, [data, mapa, limite])

  const desdobramento = useMemo(
    () => (data ? montarDesdobramento(data, selecionados) : null),
    [data, selecionados],
  )

  const alternar = (ciItem: number) => {
    const atual = selecionados.has(ciItem)
    setAjustes({ chave, mapa: { ...mapa, [ciItem]: !atual } })
  }

  const botao: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    borderRadius: 6,
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    padding: '0 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      <div
        data-chart-export-ignore
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          background: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
            Desdobramento das altas
          </span>
          <MesSelect
            label="Mês"
            value={mes}
            onChange={onMesChange}
            teto={teto}
            mesEmCurso={mesEmCurso}
          />
          <span style={{ fontSize: 11, color: '#64748B' }}>mesmo mês do Bloco 15</span>
          <button
            type="button"
            style={{ ...botao, background: painelAberto ? '#F8FAFC' : '#FFFFFF' }}
            onClick={() => setPainelAberto((v) => !v)}
            disabled={!data}
          >
            {painelAberto ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            Gastos pontuais{desdobramento ? ` (${desdobramento.linhas.length})` : ''}
          </button>
          <button
            type="button"
            style={{ ...botao, marginLeft: 'auto' }}
            onClick={() => setMostrarValores((v) => !v)}
          >
            {mostrarValores ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
            {mostrarValores ? 'Ocultar valores (só %)' : 'Mostrar valores'}
          </button>
        </div>
        {painelAberto && data ? (
          <PainelPontuais
            base={data}
            limite={limite}
            onLimiteChange={setLimite}
            selecionados={selecionados}
            onToggle={alternar}
            ajustado={Object.keys(mapa).length > 0}
            onVoltarRegra={() => setAjustes({ chave, mapa: {} })}
          />
        ) : null}
      </div>

      <div
        data-apresentacao-export="opex_pontuais"
        style={{
          width: '100%',
          minWidth: 1100,
          boxSizing: 'border-box',
          backgroundColor: 'transparent',
          padding: 4,
          fontFamily: FONT,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
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
        ) : loading || !data || !desdobramento ? (
          <div style={{ display: 'grid', gap: 8, padding: 4 }}>
            <div style={{ height: 40, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
            <div style={{ height: 300, borderRadius: 6, background: 'rgba(0,0,0,0.06)' }} />
          </div>
        ) : (
          <SlidePontuais base={data} d={desdobramento} mostrarValores={mostrarValores} />
        )}
      </div>
    </div>
  )
}
