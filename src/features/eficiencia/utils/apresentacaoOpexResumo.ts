import { MESES_CURTOS, MESES_LONGOS } from '@/features/opex/constants'
import { opexService } from '@/features/opex/services/opexService'
import { opexGrupoChave } from '@/features/opex/utils/opexGrupoNome'
import { yoyPct } from '@/features/opex/utils/opexPeriodo'
import type { OpexPlanoFiltroState } from '@/features/opex/utils/opexPlanoFiltro'
import { nomeCurtoGrupoOpex, opexMesAtualRef } from './apresentacaoOpex'

/** Blocos 14 (período) e 15 (mês) — resumo OPEX: realizado x orçamento x ano anterior. */

export type OpexResumoTopGrupo = {
  nome: string
  realizado: number
  /** Participação no realizado do recorte (%). */
  participacao: number
}

export type ApresentacaoOpexPeriodoData = {
  ano: number
  anoAnterior: number
  meses: number[]
  /** `jan–set` */
  periodoCurto: string
  /** `Janeiro / Setembro 2026` */
  titulo: string
  realizado: number
  orcamento: number
  previstoVios: number
  orcamentoAno: number
  previstoViosAno: number
  realizadoAnterior: number
  variacaoOrcPct: number | null
  variacaoViosPct: number | null
  yoyPct: number | null
  topGrupos: OpexResumoTopGrupo[]
  top5Pct: number
  /** Recorte começa em janeiro (consumo do ano e projeção fazem sentido). */
  ytd: boolean
  consumoAnoPct: number | null
  /** Projeção linear do ano pelo ritmo dos meses fechados do recorte. */
  projecaoAno: number | null
  projecaoVsOrcAnoPct: number | null
  mesesFechados: number
  /** Meses fechados do recorte com realizado acima do orçado (modo %). */
  mesesAcimaOrcado: number
  mesesComOrcado: number
  mesParcial: number | null
  parcialAte: string | null
}

export type OpexResumoMesLinha = {
  nome: string
  realizado: number
  orcado: number
  variacao: number
  /** Realizado / orçado (%). `null` sem orçamento. */
  pctOrcado: number | null
  participacao: number
}

export type ApresentacaoOpexMesData = {
  ano: number
  anoAnterior: number
  mes: number
  /** `set` */
  mesCurto: string
  /** `Setembro 2026` */
  titulo: string
  parcial: boolean
  parcialAte: string | null
  realizado: number
  orcamento: number
  previstoVios: number
  orcamentoAno: number
  previstoViosAno: number
  realizadoAnterior: number
  variacaoOrcPct: number | null
  variacaoViosPct: number | null
  yoyPct: number | null
  linhas: OpexResumoMesLinha[]
  top5Pct: number
  /** Grupos com realizado acima do orçado no mês (modo %). */
  gruposAcimaOrcado: number
  gruposTotal: number
  /** Contas que explicam o desvio do mês (estouro ou economia). */
  desvio: {
    tipo: 'estouro' | 'economia'
    pct: number
    contas: string[]
  } | null
  maior: { nome: string; variacaoPct: number | null } | null
}

function pctSobre(atual: number, base: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(base) || base === 0) return null
  return ((atual - base) / base) * 100
}

/** Mesmo número da página OPEX (`variancia_ytd_pct`, 1 casa). Sem orçamento → `null`. */
function variacaoOrcamento(k: { previsto_ytd: number; variancia_ytd_pct: number }): number | null {
  return k.previsto_ytd > 0 ? k.variancia_ytd_pct : null
}

/** Meses fechados com orçamento e quantos deles tiveram realizado acima do orçado. */
function mesesContraOrcado(
  evolucao: Array<{ mes: number; previsto: number; realizado: number }>,
  fechados: number[],
): { mesesAcimaOrcado: number; mesesComOrcado: number } {
  const comOrcado = evolucao.filter((e) => fechados.includes(e.mes) && e.previsto > 0)
  return {
    mesesAcimaOrcado: comOrcado.filter((e) => e.realizado > e.previsto).length,
    mesesComOrcado: comOrcado.length,
  }
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesEmCurso(ano: number, ref: Date): number | null {
  return ano === ref.getFullYear() ? opexMesAtualRef(ano, ref) : null
}

/** Nome de conta para frase corrida: `Impostos, taxas e seguros` → `impostos`. */
export function nomeContaFrase(nomeCurto: string): string {
  const t = nomeCurto.toLocaleLowerCase('pt-BR')
  if (t === 'copa e cozinha') return t
  return t.split(/,|\/| e /)[0]!.trim() || t
}

export function listaPtBr(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export async function fetchApresentacaoOpexPeriodo(
  ano: number,
  meses: number[],
  planoFiltro: OpexPlanoFiltroState,
  ref = new Date(),
): Promise<ApresentacaoOpexPeriodoData> {
  const anoAnterior = ano - 1
  const [atual, anterior] = await Promise.all([
    opexService.fetchDashboard(ano, meses, planoFiltro),
    opexService.fetchDashboard(anoAnterior, meses, planoFiltro),
  ])

  const k = atual.kpis
  const realizado = k.realizado_ytd
  const primeiro = meses[0] ?? 1
  const ultimo = meses[meses.length - 1] ?? primeiro

  const emCurso = mesEmCurso(ano, ref)
  const mesParcial = emCurso != null && meses.includes(emCurso) ? emCurso : null
  const fechados = meses.filter((m) => m !== mesParcial)
  const realizadoFechados = atual.evolucao
    .filter((e) => fechados.includes(e.mes))
    .reduce((s, e) => s + e.realizado, 0)

  const ytd = primeiro === 1
  const projecaoAno =
    ytd && ultimo < 12 && fechados.length > 0
      ? (realizadoFechados / fechados.length) * 12
      : null

  const grupos = atual.grupos.filter((g) => g.realizado_ytd > 0)
  const top = grupos.slice(0, 5)
  const topGrupos = top.map((g) => ({
    nome: nomeCurtoGrupoOpex(g.grupo_conta),
    realizado: g.realizado_ytd,
    participacao: realizado > 0 ? (g.realizado_ytd / realizado) * 100 : 0,
  }))

  const titulo =
    primeiro === ultimo
      ? `${MESES_LONGOS[primeiro - 1]} ${ano}`
      : `${MESES_LONGOS[primeiro - 1]} / ${MESES_LONGOS[ultimo - 1]} ${ano}`

  return {
    ano,
    anoAnterior,
    meses,
    periodoCurto:
      primeiro === ultimo
        ? MESES_CURTOS[primeiro - 1]!
        : `${MESES_CURTOS[primeiro - 1]}–${MESES_CURTOS[ultimo - 1]}`,
    titulo,
    realizado,
    orcamento: k.previsto_ytd,
    previstoVios: k.previsto_vios_ytd,
    orcamentoAno: k.previsto_ano,
    previstoViosAno: k.previsto_vios_ano,
    realizadoAnterior: anterior.kpis.realizado_ytd,
    variacaoOrcPct: variacaoOrcamento(k),
    variacaoViosPct: pctSobre(realizado, k.previsto_vios_ytd),
    yoyPct: yoyPct(realizado, anterior.kpis.realizado_ytd),
    topGrupos,
    top5Pct: topGrupos.reduce((s, g) => s + g.participacao, 0),
    ytd,
    consumoAnoPct: k.previsto_ano > 0 ? (realizado / k.previsto_ano) * 100 : null,
    projecaoAno,
    projecaoVsOrcAnoPct: projecaoAno != null ? pctSobre(projecaoAno, k.previsto_ano) : null,
    mesesFechados: fechados.length,
    ...mesesContraOrcado(atual.evolucao, fechados),
    mesParcial,
    parcialAte: mesParcial != null ? ddmm(ref) : null,
  }
}

/** Contas que somam ≥ 75% do desvio (máx. 4), da maior para a menor. */
function contasDoDesvio(
  linhas: Array<{ nome: string; variacao: number }>,
  total: number,
): ApresentacaoOpexMesData['desvio'] {
  if (!(Math.abs(total) > 0)) return null
  const tipo = total > 0 ? 'estouro' : 'economia'
  const mesmoSentido = linhas
    .filter((l) => (tipo === 'estouro' ? l.variacao > 0 : l.variacao < 0))
    .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))
  const escolhidas: typeof mesmoSentido = []
  let soma = 0
  for (const l of mesmoSentido) {
    escolhidas.push(l)
    soma += Math.abs(l.variacao)
    if (soma / Math.abs(total) >= 0.75 || escolhidas.length >= 4) break
  }
  if (escolhidas.length === 0) return null
  return {
    tipo,
    pct: (soma / Math.abs(total)) * 100,
    contas: escolhidas.map((l) => nomeContaFrase(l.nome)),
  }
}

export async function fetchApresentacaoOpexMes(
  ano: number,
  mes: number,
  planoFiltro: OpexPlanoFiltroState,
  ref = new Date(),
): Promise<ApresentacaoOpexMesData> {
  const anoAnterior = ano - 1
  const [atual, anterior, gruposMes] = await Promise.all([
    opexService.fetchDashboard(ano, [mes], planoFiltro),
    opexService.fetchDashboard(anoAnterior, [mes], planoFiltro),
    opexService.fetchMesGrupos(ano, mes, planoFiltro),
  ])

  const k = atual.kpis
  const realizado = k.realizado_ytd
  const orcamento = k.previsto_ytd

  // Junta grafias do mesmo grupo (ÇãO vs ÇÃO).
  const porGrupo = new Map<string, { nome: string; realizado: number; orcado: number }>()
  for (const g of gruposMes) {
    const chave = opexGrupoChave(g.grupo_conta)
    const atualG = porGrupo.get(chave)
    if (atualG) {
      atualG.realizado += g.realizado
      atualG.orcado += g.previsto
    } else {
      porGrupo.set(chave, {
        nome: nomeCurtoGrupoOpex(g.grupo_conta),
        realizado: g.realizado,
        orcado: g.previsto,
      })
    }
  }
  const todas = [...porGrupo.values()].map((g) => ({
    ...g,
    variacao: g.realizado - g.orcado,
  }))
  const linhas: OpexResumoMesLinha[] = todas
    .filter((g) => g.realizado > 0)
    .sort((a, b) => b.realizado - a.realizado)
    .slice(0, 5)
    .map((g) => ({
      nome: g.nome,
      realizado: g.realizado,
      orcado: g.orcado,
      variacao: g.variacao,
      pctOrcado: g.orcado > 0 ? (g.realizado / g.orcado) * 100 : null,
      participacao: realizado > 0 ? (g.realizado / realizado) * 100 : 0,
    }))

  const maiorLinha = linhas[0]
  const emCurso = mesEmCurso(ano, ref)
  const parcial = emCurso === mes

  return {
    ano,
    anoAnterior,
    mes,
    mesCurto: MESES_CURTOS[mes - 1]!,
    titulo: `${MESES_LONGOS[mes - 1]} ${ano}`,
    parcial,
    parcialAte: parcial ? ddmm(ref) : null,
    realizado,
    orcamento,
    previstoVios: k.previsto_vios_ytd,
    orcamentoAno: k.previsto_ano,
    previstoViosAno: k.previsto_vios_ano,
    realizadoAnterior: anterior.kpis.realizado_ytd,
    variacaoOrcPct: variacaoOrcamento(k),
    variacaoViosPct: pctSobre(realizado, k.previsto_vios_ytd),
    yoyPct: yoyPct(realizado, anterior.kpis.realizado_ytd),
    linhas,
    top5Pct: linhas.reduce((s, l) => s + l.participacao, 0),
    gruposAcimaOrcado: todas.filter((g) => g.variacao > 0).length,
    gruposTotal: todas.filter((g) => g.orcado > 0 || g.realizado > 0).length,
    desvio: contasDoDesvio(todas, realizado - orcamento),
    maior: maiorLinha
      ? {
          nome: maiorLinha.nome,
          variacaoPct: maiorLinha.pctOrcado != null ? maiorLinha.pctOrcado - 100 : null,
        }
      : null,
  }
}
