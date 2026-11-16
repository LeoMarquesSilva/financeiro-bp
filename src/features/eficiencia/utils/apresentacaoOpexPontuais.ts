import { MESES_LONGOS } from '@/features/opex/constants'
import { opexService } from '@/features/opex/services/opexService'
import { yoyPct } from '@/features/opex/utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '@/features/opex/utils/opexPlanoFiltro'
import { nomeCurtoGrupoOpex, opexMesAtualRef } from './apresentacaoOpex'

/**
 * Bloco 16 — Desdobramento das altas. Tudo vem do OPEX (lançamentos do VIOS):
 * gasto pontual = pago no mês, em grupo não fixo, a partir de R$ 10 mil, e o
 * mesmo fornecedor não recebeu no mesmo plano em 3+ dos 12 meses anteriores.
 * Parcelas de um mesmo gasto (ex.: patrocínio em 3x) continuam pontuais.
 */

/** Menor valor buscado; o painel filtra a partir daqui. */
export const OPEX_PONTUAL_VALOR_MIN_BUSCA = 5_000
export const OPEX_PONTUAL_LIMITE_PADRAO = 10_000
/** Pago em até 2 dos 12 meses anteriores ainda conta como pontual. */
export const OPEX_PONTUAL_MAX_MESES_HISTORICO = 2

export type OpexCandidatoPontual = {
  ciItem: number
  descricao: string
  fornecedor: string
  grupoConta: string
  planoContas: string
  departamento: string
  /** ISO `yyyy-mm-dd` do último pagamento no mês. */
  dataPagamento: string | null
  valor: number
  /** Meses (dos 12 anteriores) com pagamento ao mesmo fornecedor no mesmo plano. */
  mesesHistorico: number
  /** Nome no slide. */
  gasto: string
  /** Grupo no slide. */
  grupo: string
}

export type ApresentacaoOpexPontuaisBase = {
  ano: number
  anoAnterior: number
  mes: number
  /** `Setembro` */
  mesNome: string
  realizado: number
  realizadoAnterior: number
  yoyPct: number | null
  /** Itens de grupos não fixos a partir de R$ 5 mil, do maior para o menor. */
  candidatos: OpexCandidatoPontual[]
  parcial: boolean
  parcialAte: string | null
}

export type OpexPontualLinha = {
  ciItem: number
  gasto: string
  grupo: string
  /** `dd/mm` */
  data: string
  valor: number
  /** % do realizado do mês. */
  pctMes: number
}

export type OpexDesdobramento = {
  linhas: OpexPontualLinha[]
  totalPontual: number
  pctPontualMes: number
  semPontuais: number
  semPontuaisYoyPct: number | null
}

export function ehPontualPelaRegra(c: OpexCandidatoPontual, limite: number): boolean {
  return c.valor >= limite && c.mesesHistorico <= OPEX_PONTUAL_MAX_MESES_HISTORICO
}

const MINUSCULAS = new Set([
  'a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'ao', 'aos', 'por', 'com', 'para', 'sem', 'um', 'uma', 'x',
])

/** Texto "em caixa alta" do VIOS (tolera o `ã` minúsculo do encoding, ex.: `INDENIZAÇãO`). */
function emCaixaAlta(s: string): boolean {
  const maiusculas = (s.match(/\p{Lu}/gu) ?? []).length
  const minusculas = (s.match(/\p{Ll}/gu) ?? []).length
  return maiusculas > 0 && maiusculas / (maiusculas + minusculas) >= 0.75
}

/**
 * `JANTAR - JUÍZES STF` → `Jantar - Juízes STF`; `PATROCÍNIO CONGRESSO TMA BRASIL` →
 * `Patrocínio Congresso TMA Brasil`. Siglas de 2–3 letras ficam; texto já em caixa
 * mista não muda.
 */
export function textoFrase(t: string): string {
  const s = t.trim().replace(/\s+/g, ' ')
  if (!s || !emCaixaAlta(s)) return s
  return s
    .split(' ')
    .map((p, i) => {
      const so = p.replace(/[^\p{L}]/gu, '')
      const baixa = p.toLocaleLowerCase('pt-BR')
      if (!so) return p
      if (MINUSCULAS.has(so.toLocaleLowerCase('pt-BR'))) return i === 0 ? cap(baixa) : baixa
      if (so.length >= 2 && so.length <= 3) return p.toLocaleUpperCase('pt-BR')
      return cap(baixa)
    })
    .join(' ')
}

function cap(p: string): string {
  return p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1)
}

/** Vazia, "Sem descrição" ou texto automático do VIOS com nome de colaborador. */
function semDescricao(t: string): boolean {
  const s = t.trim()
  return !s || /^sem descri/i.test(s) || /^pagamento de vencimento ao colaborador/i.test(s)
}

/** Descrição do VIOS; sem descrição, usa o plano e o departamento. */
function nomeGasto(r: { descricao: string; planoContas: string; departamento: string; fornecedor: string }): string {
  if (!semDescricao(r.descricao)) return textoFrase(r.descricao)
  const plano = textoFrase(r.planoContas)
  const dep = r.departamento.trim()
  if (plano && dep) return `${plano} (${dep})`
  return plano || textoFrase(r.fornecedor) || 'Lançamento'
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function ddmmIso(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}` : '—'
}

export async function fetchApresentacaoOpexPontuais(
  ano: number,
  mes: number,
  planoFiltro: OpexPlanoFiltroState,
  ref = new Date(),
): Promise<ApresentacaoOpexPontuaisBase> {
  const anoAnterior = ano - 1
  const [atual, anterior, lancamentos] = await Promise.all([
    opexService.fetchDashboard(ano, [mes], planoFiltro),
    opexService.fetchDashboard(anoAnterior, [mes], planoFiltro),
    opexService.fetchLancamentosPeriodo(ano, [mes], planoFiltro),
  ])

  // Pagos no mês, grupos não fixos, agrupados por item.
  const porItem = new Map<number, Omit<OpexCandidatoPontual, 'mesesHistorico' | 'gasto' | 'grupo'>>()
  for (const r of lancamentos) {
    if (r.mes_pagamento !== mes || !(r.valor_realizado > 0) || r.fixo) continue
    const e = porItem.get(r.ci_item)
    if (e) {
      e.valor += r.valor_realizado
      if ((r.data_pagamento ?? '') > (e.dataPagamento ?? '')) e.dataPagamento = r.data_pagamento
    } else {
      porItem.set(r.ci_item, {
        ciItem: r.ci_item,
        descricao: r.descricao,
        fornecedor: r.fornecedor,
        grupoConta: r.grupo_conta,
        planoContas: r.plano_contas,
        departamento: r.departamento,
        dataPagamento: r.data_pagamento,
        valor: r.valor_realizado,
      })
    }
  }
  const itens = [...porItem.values()]
    .filter((i) => i.valor >= OPEX_PONTUAL_VALOR_MIN_BUSCA)
    .sort((a, b) => b.valor - a.valor)

  // Histórico: 12 meses anteriores, só do grupo/plano de cada candidato.
  const mesesAtual = Array.from({ length: mes - 1 }, (_, i) => i + 1)
  const mesesAnterior = Array.from({ length: 13 - mes }, (_, i) => mes + i)
  /** Janela por data de pagamento: [mesmo mês do ano anterior, mês atual). */
  const mm = String(mes).padStart(2, '0')
  const janelaIni = `${anoAnterior}-${mm}`
  const janelaFim = `${ano}-${mm}`
  const cache = new Map<string, Promise<Array<{ fornecedor: string; data_pagamento: string | null; valor_realizado: number }>>>()
  const titulos = (a: number, grupo: string, plano: string, meses: number[]) => {
    if (meses.length === 0) return Promise.resolve([])
    const k = `${a}|${grupo}|${plano}`
    if (!cache.has(k)) {
      cache.set(k, opexService.fetchPlanoTitulos(a, grupo, plano, meses, planoFiltro))
    }
    return cache.get(k)!
  }

  const candidatos: OpexCandidatoPontual[] = await Promise.all(
    itens.map(async (i) => {
      const [h1, h2] = await Promise.all([
        titulos(ano, i.grupoConta, i.planoContas, mesesAtual),
        titulos(anoAnterior, i.grupoConta, i.planoContas, mesesAnterior),
      ])
      const forn = norm(i.fornecedor)
      const meses = new Set(
        [...h1, ...h2]
          .filter((t) => t.data_pagamento && t.valor_realizado > 0 && norm(t.fornecedor) === forn)
          .map((t) => t.data_pagamento!.slice(0, 7))
          .filter((ym) => ym >= janelaIni && ym < janelaFim),
      )
      return {
        ...i,
        mesesHistorico: meses.size,
        gasto: nomeGasto(i),
        grupo: nomeCurtoGrupoOpex(i.grupoConta),
      }
    }),
  )

  const realizado = atual.kpis.realizado_ytd
  const realizadoAnterior = anterior.kpis.realizado_ytd
  const parcial = ano === ref.getFullYear() && opexMesAtualRef(ano, ref) === mes

  return {
    ano,
    anoAnterior,
    mes,
    mesNome: MESES_LONGOS[mes - 1]!,
    realizado,
    realizadoAnterior,
    yoyPct: yoyPct(realizado, realizadoAnterior),
    candidatos,
    parcial,
    parcialAte: parcial ? ddmm(ref) : null,
  }
}

/** Monta o slide a partir dos itens escolhidos (regra ou ajuste no painel). */
export function montarDesdobramento(
  base: ApresentacaoOpexPontuaisBase,
  selecionados: ReadonlySet<number>,
): OpexDesdobramento {
  const linhas: OpexPontualLinha[] = base.candidatos
    .filter((c) => selecionados.has(c.ciItem))
    .map((c) => ({
      ciItem: c.ciItem,
      gasto: c.gasto,
      grupo: c.grupo,
      data: ddmmIso(c.dataPagamento),
      valor: c.valor,
      pctMes: base.realizado > 0 ? (c.valor / base.realizado) * 100 : 0,
    }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR') || b.valor - a.valor)
  const totalPontual = linhas.reduce((s, l) => s + l.valor, 0)
  const semPontuais = base.realizado - totalPontual
  return {
    linhas,
    totalPontual,
    pctPontualMes: base.realizado > 0 ? (totalPontual / base.realizado) * 100 : 0,
    semPontuais,
    semPontuaisYoyPct: yoyPct(semPontuais, base.realizadoAnterior),
  }
}
