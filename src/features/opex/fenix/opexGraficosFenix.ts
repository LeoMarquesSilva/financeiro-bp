/**
 * Fênix nos gráficos do OPEX: explica o mês (ou o grupo, plano, área) sob o mouse, ou o gráfico inteiro.
 *
 * Funções puras. Recebem o mesmo array `data` que o gráfico desenha, então os valores da explicação
 * são os do tooltip. Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type {
  FenixExplicacao,
  FenixFiltro,
  FenixLinha,
  FenixPontoGrafico,
} from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import type { OpexMesRow } from '../types/opex.types.ts'
import {
  GRUPOS_FIXOS,
  REGRA_FOLHA,
  REGRA_FORA_OPEX,
  REGRA_PREVISTO_VIOS,
  REGRA_REALIZADO,
  regraOrcamento,
  regraPlanoFiltro,
  type OpexFenixContexto,
} from './opexFenix.ts'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const moeda = formatCurrency

function rotuloMes(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes}/${String(ano).slice(-2)}`
}

function mesAno(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes}/${ano}`
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function linhaTotal(rotulo: string, v: number, valor = moeda(v)): FenixLinha {
  return { rotulo, valor, numero: v, operador: '=', tipo: 'total' }
}

/** Parcelas com '+' a partir da segunda. */
function parcelas(itens: readonly { rotulo: string; v: number; detalhe?: string }[]): FenixLinha[] {
  return itens.map((it, i) => ({
    rotulo: it.rotulo,
    valor: moeda(it.v),
    numero: it.v,
    operador: i === 0 ? undefined : '+',
    detalhe: it.detalhe,
  }))
}

/** Parcelas arredondadas que não somam o total exibido: mostra a diferença. */
function notaArredondamento(linhas: readonly FenixLinha[], totalExato: number): FenixLinha[] {
  const soma = linhas.reduce((s, l) => s + Math.round(num(l.numero) * 100), 0)
  const dif = (Math.round(totalExato * 100) - soma) / 100
  if (dif === 0) return []
  return [
    {
      rotulo: 'Arredondamento',
      valor: moeda(Math.abs(dif)),
      numero: dif,
      tipo: 'info',
      detalhe: `as linhas aparecem arredondadas e somam ${moeda(soma / 100)}; o total usa os valores exatos`,
    },
  ]
}

/** Mantém as maiores parcelas e junta o resto numa linha, para a soma continuar fechando. */
function topComDemais(
  itens: readonly { rotulo: string; v: number }[],
  max: number,
  nomeDemais: (n: number) => string,
): { rotulo: string; v: number }[] {
  if (itens.length <= max) return [...itens]
  const top = itens.slice(0, max - 1)
  const resto = itens.slice(max - 1)
  return [...top, { rotulo: nomeDemais(resto.length), v: resto.reduce((s, x) => s + x.v, 0) }]
}

type Tempo = { ano: number; mesAtual: number; hoje?: Date }

function mesEmAndamento(t: Tempo, mes: number): boolean {
  const hoje = t.hoje ?? new Date()
  return t.ano === hoje.getFullYear() && mes === t.mesAtual
}

function mesFuturo(t: Tempo, mes: number): boolean {
  const hoje = t.hoje ?? new Date()
  return t.ano > hoje.getFullYear() || (t.ano === hoje.getFullYear() && mes > t.mesAtual)
}

function filtroPlano(ctx: Pick<OpexFenixContexto, 'planoFiltro'>): FenixFiltro {
  const g = ctx.planoFiltro?.gruposExcluidos.length ?? 0
  const p = ctx.planoFiltro?.planosExcluidos.length ?? 0
  return {
    rotulo: 'Plano de contas',
    valor:
      g + p === 0
        ? 'todos'
        : [g > 0 ? `${g} grupo(s) oculto(s)` : '', p > 0 ? `${p} plano(s) oculto(s)` : ''].filter(Boolean).join(' · '),
  }
}

const FONTE = 'Financeiro do VIOS: títulos a pagar sincronizados no SIOE.'
const FONTE_ORC = 'Orçamento congelado do ano (painel Orçamento) e títulos a pagar do VIOS.'
const REGRA_FIXAS = `Despesas fixas = grupos ${GRUPOS_FIXOS.join(', ')}.`

function serieSobMouse(ponto: FenixPontoGrafico | null, nomes: Record<string, string>): FenixFiltro[] {
  if (!ponto?.serie) return []
  const nome = nomes[ponto.serie]
  return nome ? [{ rotulo: 'Série sob o mouse', valor: nome }] : []
}

// ---------------------------------------------------------------------------
// Orçamento x realizado mensal (gráfico principal)
// ---------------------------------------------------------------------------

/** Ponto do gráfico mensal: linha da evolução + projeção das fixas só nos meses futuros. */
export type OpexMensalPonto = OpexMesRow & { projetado_fixas_chart: number | null; ativo: boolean }

export type OpexGraficoMensalContexto = {
  ctx: Pick<OpexFenixContexto, 'ano' | 'mesAtual' | 'mesesFiltro' | 'orcamentoImportado' | 'planoFiltro' | 'hoje'>
  data: readonly OpexMensalPonto[]
}

const SERIES_MENSAL: Record<string, string> = {
  previsto: 'Orçamento',
  realizado: 'Realizado',
  projetado_fixas_chart: 'Projeção fixas',
}

function tituloMensal(importado: boolean): string {
  return importado ? 'Orçamento x realizado mensal' : 'Previsto x realizado mensal'
}

function regrasMensal(c: OpexGraficoMensalContexto): string[] {
  const { ctx } = c
  return [
    REGRA_REALIZADO,
    regraOrcamento(ctx.orcamentoImportado),
    ctx.orcamentoImportado
      ? `${REGRA_PREVISTO_VIOS} Não aparece no gráfico; vai na conta só para comparar.`
      : 'A barra se chama Orçamento mesmo sem orçamento importado: nesse caso ela mostra o previsto do VIOS.',
    REGRA_FORA_OPEX,
    'O gráfico mostra sempre os 12 meses. Meses fora do filtro de meses aparecem apagados, com os mesmos valores.',
    `Projeção fixas = média mensal do que foi pago nos grupos fixos de janeiro até o mês atual, repetida nos meses seguintes. ${REGRA_FIXAS}`,
    ...regraPlanoFiltro(ctx),
  ]
}

export function explicarGraficoOpexMensal(c: OpexGraficoMensalContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const { ctx } = c
  const tela = `OPEX › ${ctx.ano} › ${tituloMensal(ctx.orcamentoImportado)}`
  const d = ponto ? c.data[ponto.indice] : undefined
  if (ponto && d) {
    const andamento = mesEmAndamento(ctx, d.mes)
    const futuro = mesFuturo(ctx, d.mes)
    const dif = d.realizado - d.previsto
    const conta: FenixLinha[] = [
      {
        rotulo: 'Realizado',
        valor: moeda(d.realizado),
        numero: d.realizado,
        detalhe: andamento ? 'mês em andamento: pago até hoje' : futuro ? 'mês futuro: ainda sem pagamentos' : 'pago no mês',
      },
      {
        rotulo: 'Orçamento',
        valor: moeda(d.previsto),
        numero: d.previsto,
        operador: '−',
        detalhe: ctx.orcamentoImportado ? 'orçamento congelado do mês' : 'títulos do VIOS com vencimento no mês',
      },
      linhaTotal('Realizado − orçamento', dif),
    ]
    if (d.previsto > 0) {
      conta.push({
        rotulo: 'Variação',
        valor: formatPercent((dif / d.previsto) * 100),
        numero: (dif / d.previsto) * 100,
        tipo: 'info',
        detalhe: dif > 0 ? 'gastou mais que o orçado' : dif < 0 ? 'gastou menos que o orçado' : 'igual ao orçado',
      })
    }
    if (d.projetado_fixas_chart != null) {
      conta.push({
        rotulo: 'Projeção fixas',
        valor: moeda(d.projetado_fixas_chart),
        numero: d.projetado_fixas_chart,
        tipo: 'info',
        detalhe: 'linha tracejada: média mensal das fixas pagas até o mês atual',
      })
    }
    if (ctx.orcamentoImportado) {
      conta.push({
        rotulo: 'Previsto VIOS (fora do gráfico)',
        valor: moeda(d.previsto_vios),
        numero: d.previsto_vios,
        tipo: 'info',
        detalhe: 'títulos lançados no VIOS com vencimento no mês, só para comparar',
      })
    }
    const serie = ponto.serie && ponto.serie in SERIES_MENSAL ? ponto.serie : 'realizado'
    const valorSerie =
      serie === 'previsto' ? d.previsto : serie === 'projetado_fixas_chart' ? num(d.projetado_fixas_chart) : d.realizado
    return {
      tela,
      titulo: `${SERIES_MENSAL[serie]} · ${mesAno(ctx.ano, d.mes)}`,
      valor: moeda(valorSerie),
      resumo: `${mesAno(ctx.ano, d.mes)}: ${moeda(d.realizado)} pagos contra ${moeda(d.previsto)} ${ctx.orcamentoImportado ? 'orçados' : 'previstos no VIOS'}.`,
      formula: 'Diferença = Realizado (pago no mês) − Orçamento do mês',
      conta,
      filtros: [{ rotulo: 'Mês', valor: mesAno(ctx.ano, d.mes) }, filtroPlano(ctx), ...serieSobMouse(ponto, SERIES_MENSAL)],
      regras: [
        ...(andamento ? [`${rotuloMes(ctx.ano, d.mes)} está em andamento: o realizado tem só o que foi pago até hoje.`] : []),
        ...(d.ativo ? [] : ['Este mês está fora do filtro de meses do painel (barra apagada), mas os valores são os do mês inteiro.']),
        REGRA_FOLHA,
        ...regrasMensal(c),
      ],
      fonte: FONTE_ORC,
      fonteTecnica: 'Supabase › opex_dashboard › evolucao (opex_valor_pago por data_pagamento; opex_orcamento_linha ou opex_valor_item por data_vencimento)',
      detalhe: 'Fora do Fênix, clique na barra do mês para abrir os grupos de conta.',
    }
  }

  const comRealizado = c.data.filter((x) => x.realizado !== 0)
  const linhas = parcelas(comRealizado.map((x) => ({ rotulo: rotuloMes(ctx.ano, x.mes), v: x.realizado })))
  const totalRealizado = c.data.reduce((s, x) => s + x.realizado, 0)
  const totalOrc = c.data.reduce((s, x) => s + x.previsto, 0)
  const proj = c.data.filter((x) => x.projetado_fixas_chart != null)
  return {
    tela,
    titulo: tituloMensal(ctx.orcamentoImportado),
    valor: moeda(totalRealizado),
    resumo: `Mês a mês de ${ctx.ano}: quanto foi pago (realizado) ao lado do ${ctx.orcamentoImportado ? 'orçamento' : 'previsto do VIOS'}, e a projeção das despesas fixas nos meses que faltam.`,
    formula: 'Realizado do ano = soma do pago em cada mês',
    conta: [
      ...linhas,
      linhaTotal(`Realizado ${ctx.ano}`, totalRealizado),
      ...notaArredondamento(linhas, totalRealizado),
      { rotulo: `Orçamento ${ctx.ano} (12 meses)`, valor: moeda(totalOrc), numero: totalOrc, tipo: 'info' },
      ...(proj.length > 0
        ? [
            {
              rotulo: 'Projeção fixas por mês',
              valor: moeda(num(proj[0]!.projetado_fixas_chart)),
              numero: num(proj[0]!.projetado_fixas_chart),
              tipo: 'info' as const,
              detalhe: `de ${rotuloMes(ctx.ano, proj[0]!.mes)} a ${rotuloMes(ctx.ano, proj[proj.length - 1]!.mes)}`,
            },
          ]
        : []),
    ],
    filtros: [{ rotulo: 'Ano', valor: String(ctx.ano) }, filtroPlano(ctx)],
    regras: [...regrasMensal(c), 'Aponte um mês para ver orçamento, realizado e projeção daquele mês.'],
    fonte: FONTE_ORC,
    fonteTecnica: 'Supabase › opex_dashboard › evolucao',
    detalhe: 'Fora do Fênix, clique numa barra para abrir os grupos do mês, ou em "Ver ano".',
  }
}

// ---------------------------------------------------------------------------
// Detalhe por grupo de conta / plano (barras horizontais)
// ---------------------------------------------------------------------------

/** Mesmo formato da linha do gráfico de detalhe (DrillBarRow). */
export type OpexDetalheBarra = {
  key: string
  label: string
  previsto: number
  realizado: number
  projetado: number
  realizadoTotal: number
  realizadoAnterior: number
  variacao: number
  variacaoYoY: number
}

export type OpexGraficoDetalheContexto = {
  ctx: Pick<OpexFenixContexto, 'ano' | 'mesAtual' | 'orcamentoImportado' | 'planoFiltro' | 'hoje'>
  data: readonly OpexDetalheBarra[]
  /** Mês do detalhe ou o ano inteiro. */
  periodo: number | 'ano'
  /** Grupo aberto (o gráfico mostra os planos dele); nulo = grupos de conta. */
  grupo: string | null
  compararAnoAnterior: boolean
  /** No detalhe do ano, os grupos fixos ganham a projeção até dezembro. */
  mostrarProjecao: boolean
}

function periodoDetalhe(c: OpexGraficoDetalheContexto): string {
  return c.periodo === 'ano' ? `ano de ${c.ctx.ano}` : mesAno(c.ctx.ano, c.periodo)
}

function regrasDetalhe(c: OpexGraficoDetalheContexto): string[] {
  const { ctx } = c
  const anoAnt = ctx.ano - 1
  const r: string[] = []
  r.push(
    c.periodo === 'ano'
      ? 'Realizado = pago de janeiro até hoje (pela data de pagamento); Orçamento = orçamento dos 12 meses do ano.'
      : `Realizado = pago em ${mesAno(ctx.ano, c.periodo)} (pela data de pagamento); Orçamento = orçamento de ${mesAno(ctx.ano, c.periodo)}.`,
  )
  r.push(regraOrcamento(ctx.orcamentoImportado))
  if (c.mostrarProjecao) {
    r.push(
      `Projetado (barra laranja) = só nos grupos fixos: pago no ano ÷ ${ctx.mesAtual} meses decorridos × ${Math.max(0, 12 - ctx.mesAtual)} meses restantes. Grupos variáveis não têm projeção. Aqui a projeção não soma o orçamento dos meses seguintes, diferente do card Projeção de despesas fixas.`,
    )
    r.push(REGRA_FIXAS)
  }
  r.push('Variação = realizado (+ projetado, no ano) − orçamento. Positivo = gastou mais que o orçado.')
  if (c.compararAnoAnterior) {
    r.push(
      `${anoAnt} usa o mesmo período (${c.periodo === 'ano' ? `o ano de ${anoAnt} inteiro` : mesAno(anoAnt, c.periodo)}) e o mesmo filtro de plano de contas.`,
    )
    r.push(
      c.grupo
        ? `Os planos de ${anoAnt} vêm dos grupos que o De-Para liga a ${c.grupo}.`
        : `Grupos de ${anoAnt} que mudaram de nome passam pelo De-Para de grupos para casar com o nome de ${ctx.ano}.`,
    )
    if (anoAnt === 2025) {
      r.push('Atenção com 2025: em alguns meses parte da folha foi paga fora do VIOS, então o realizado de 2025 pode estar abaixo do real.')
    }
  }
  r.push(REGRA_FORA_OPEX)
  r.push(...regraPlanoFiltro(ctx))
  if (c.grupo && (ctx.planoFiltro?.planosExcluidos.length ?? 0) > 0) {
    r.push('Atenção: no detalhe por plano, o orçamento não aplica o filtro de plano de contas (só o realizado aplica).')
  }
  return r
}

function seriesDetalhe(c: OpexGraficoDetalheContexto): Record<string, string> {
  return c.compararAnoAnterior
    ? { realizadoAnterior: `Realizado ${c.ctx.ano - 1}`, realizado: `Realizado ${c.ctx.ano}`, projetado: 'Projetado' }
    : { previsto: 'Orçamento', realizado: 'Realizado', projetado: 'Projetado' }
}

export function explicarGraficoOpexDetalhe(c: OpexGraficoDetalheContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const { ctx } = c
  const anoAnt = ctx.ano - 1
  const nivel = c.grupo ? 'Plano' : 'Grupo de conta'
  const tela = `OPEX › ${ctx.ano} › Detalhe de ${periodoDetalhe(c)}${c.grupo ? ` › ${c.grupo}` : ''}`
  const filtros: FenixFiltro[] = [
    { rotulo: 'Período', valor: periodoDetalhe(c) },
    ...(c.grupo ? [{ rotulo: 'Grupo', valor: c.grupo }] : []),
    filtroPlano(ctx),
    ...(c.compararAnoAnterior ? [{ rotulo: 'Comparado com', valor: String(anoAnt) }] : []),
  ]
  const b = ponto ? c.data[ponto.indice] : undefined
  if (ponto && b) {
    const temProj = c.mostrarProjecao && b.projetado > 0
    const conta: FenixLinha[] = [
      { rotulo: c.compararAnoAnterior ? `Realizado ${ctx.ano}` : 'Realizado', valor: moeda(b.realizado), numero: b.realizado },
    ]
    if (temProj) {
      conta.push({
        rotulo: 'Projetado até dezembro',
        valor: moeda(b.projetado),
        numero: b.projetado,
        operador: '+',
        detalhe: `${moeda(b.realizado)} ÷ ${ctx.mesAtual} × ${Math.max(0, 12 - ctx.mesAtual)} meses restantes`,
      })
    }
    if (c.compararAnoAnterior) {
      conta.push(
        { rotulo: `Realizado ${anoAnt}`, valor: moeda(b.realizadoAnterior), numero: b.realizadoAnterior, operador: '−' },
        linhaTotal(`Diferença vs ${anoAnt}`, b.variacaoYoY),
      )
      if (b.realizadoAnterior > 0) {
        const pct = (b.variacaoYoY / b.realizadoAnterior) * 100
        conta.push({ rotulo: `Variação vs ${anoAnt}`, valor: formatPercent(pct), numero: pct, tipo: 'info', detalhe: 'diferença ÷ realizado do ano anterior' })
      }
      conta.push({ rotulo: `Orçamento ${ctx.ano} (fora do gráfico)`, valor: moeda(b.previsto), numero: b.previsto, tipo: 'info' })
    } else {
      conta.push(
        { rotulo: 'Orçamento', valor: moeda(b.previsto), numero: b.previsto, operador: '−' },
        linhaTotal('Variação', b.variacao),
      )
    }
    if (temProj) {
      conta.push({
        rotulo: 'Realizado + projetado (número no fim da barra)',
        valor: moeda(b.realizadoTotal),
        numero: b.realizadoTotal,
        tipo: 'info',
      })
    }
    return {
      tela,
      titulo: `${b.label} · ${periodoDetalhe(c)}`,
      valor: moeda(b.realizado),
      resumo: c.compararAnoAnterior
        ? `${nivel} ${b.label}: pago em ${periodoDetalhe(c)} comparado com o mesmo período de ${anoAnt}.`
        : `${nivel} ${b.label}: pago em ${periodoDetalhe(c)} contra o orçamento do mesmo período.`,
      formula: c.compararAnoAnterior
        ? `Diferença = Realizado ${ctx.ano}${temProj ? ' + Projetado' : ''} − Realizado ${anoAnt}`
        : `Variação = Realizado${temProj ? ' + Projetado' : ''} − Orçamento`,
      conta,
      filtros: [...filtros, ...serieSobMouse(ponto, seriesDetalhe(c))],
      regras: regrasDetalhe(c),
      fonte: FONTE_ORC,
      fonteTecnica: c.grupo
        ? 'Supabase › opex_planos_grupo (realizado_ytd, previsto_ano) · projetadoRestanteFixas'
        : 'Supabase › opex_mes_grupos (previsto, realizado) · projetadoRestanteFixas · De-Para de grupos',
      detalhe: c.grupo
        ? 'Fora do Fênix, clique no plano para ver os títulos.'
        : 'Fora do Fênix, clique no grupo para ver os planos.',
    }
  }

  const realizado = parcelas(c.data.map((x) => ({ rotulo: x.label, v: x.realizado })))
  const totalReal = c.data.reduce((s, x) => s + x.realizado, 0)
  const totalProj = c.data.reduce((s, x) => s + x.projetado, 0)
  const totalOrc = c.data.reduce((s, x) => s + x.previsto, 0)
  const totalAnt = c.data.reduce((s, x) => s + x.realizadoAnterior, 0)
  const conta: FenixLinha[] = [
    ...realizado,
    linhaTotal('Realizado', totalReal),
    ...notaArredondamento(realizado, totalReal),
  ]
  if (c.mostrarProjecao && totalProj > 0) {
    conta.push({ rotulo: 'Projetado (grupos fixos)', valor: moeda(totalProj), numero: totalProj, tipo: 'info' })
  }
  conta.push({ rotulo: 'Orçamento', valor: moeda(totalOrc), numero: totalOrc, tipo: 'info' })
  conta.push({
    rotulo: 'Variação',
    valor: moeda(totalReal + totalProj - totalOrc),
    numero: totalReal + totalProj - totalOrc,
    tipo: 'info',
    detalhe: c.mostrarProjecao ? 'realizado + projetado − orçamento' : 'realizado − orçamento',
  })
  if (c.compararAnoAnterior) {
    conta.push({ rotulo: `Realizado ${anoAnt}`, valor: moeda(totalAnt), numero: totalAnt, tipo: 'info' })
  }
  return {
    tela,
    titulo: c.grupo ? `${c.grupo} · planos de ${periodoDetalhe(c)}` : `Grupos de conta · ${periodoDetalhe(c)}`,
    valor: moeda(totalReal),
    resumo: `${c.grupo ? 'Planos do grupo' : 'Grupos de conta'} em ${periodoDetalhe(c)}: ${c.compararAnoAnterior ? `realizado de ${ctx.ano} contra ${anoAnt}` : 'orçamento contra realizado'}, um por barra.`,
    formula: 'Realizado = soma do realizado de cada barra',
    conta,
    filtros,
    regras: [...regrasDetalhe(c), `Aponte uma barra para ver a conta daquele ${c.grupo ? 'plano' : 'grupo'}.`],
    fonte: FONTE_ORC,
    fonteTecnica: c.grupo ? 'Supabase › opex_planos_grupo' : 'Supabase › opex_mes_grupos',
  }
}

// ---------------------------------------------------------------------------
// Custos por área / departamento (barras empilhadas)
// ---------------------------------------------------------------------------

export type OpexDepartamentoFatia = { departamento: string; label: string; dataKey: string }

export type OpexGraficoDepartamentosContexto = {
  ano: number
  mesAtual: number
  mesesFiltro: readonly number[]
  metric: 'realizado' | 'previsto'
  somenteFixas: boolean
  /** Áreas visíveis, na ordem das barras (a mesma do tooltip). */
  fatias: readonly OpexDepartamentoFatia[]
  /** Áreas ocultas pelo X. */
  ocultas: readonly string[]
  /** Mesmo array do gráfico (uma linha por mês, uma coluna por área, `total`). */
  data: readonly Record<string, unknown>[]
  /** Total do cabeçalho do gráfico. */
  total: number
  hoje?: Date
}

function regrasDepartamentos(c: OpexGraficoDepartamentosContexto): string[] {
  const r: string[] = []
  r.push(
    c.metric === 'realizado'
      ? 'Realizado = valor pago de cada título a pagar, no mês da data de pagamento, no departamento do título.'
      : 'Previsto = valor dos títulos a pagar lançados no VIOS com vencimento no mês, pagos ou não. Aqui não é o orçamento congelado.',
  )
  r.push(
    'Este gráfico inclui investimentos (os cards do OPEX não incluem). Ficam fora: distribuição de lucros, sócios, empréstimos e devoluções, deduções da receita e outras receitas operacionais.',
  )
  r.push('O filtro de plano de contas do painel não vale aqui.')
  r.push('Departamento = o do título no VIOS; sem departamento aparece como "Sem departamento".')
  if (c.somenteFixas) r.push(`Somente despesas fixas: ${REGRA_FIXAS}`)
  if (c.mesesFiltro.length > 0) {
    r.push('Com meses escolhidos no painel, só esses meses têm valor; os outros aparecem apagados e zerados.')
  } else if (c.metric === 'realizado') {
    r.push('Sem meses escolhidos, o realizado vai de janeiro até o mês atual; meses futuros ficam zerados.')
  }
  if (c.ocultas.length > 0) r.push(`Áreas ocultas no gráfico não entram no total: ${c.ocultas.join(', ')}.`)
  return r
}

export function explicarGraficoOpexDepartamentos(
  c: OpexGraficoDepartamentosContexto,
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const tela = `OPEX › ${c.ano} › Custos por área / departamento`
  const nomeMetric = c.metric === 'realizado' ? 'Realizado' : 'Previsto'
  const filtros: FenixFiltro[] = [
    { rotulo: 'Série', valor: nomeMetric },
    { rotulo: 'Meses', valor: c.mesesFiltro.length > 0 ? c.mesesFiltro.map((m) => MESES[m - 1]).join(', ') : `ano de ${c.ano}` },
    ...(c.somenteFixas ? [{ rotulo: 'Despesas', valor: 'somente fixas' }] : []),
    ...(c.ocultas.length > 0 ? [{ rotulo: 'Áreas ocultas', valor: String(c.ocultas.length) }] : []),
  ]
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) {
    const mes = num(p.mes)
    const comValor = c.fatias.map((f) => ({ rotulo: f.label, v: num(p[f.dataKey]) })).filter((x) => x.v !== 0)
    const zeradas = c.fatias.length - comValor.length
    const linhas = parcelas(comValor)
    const total = num(p.total)
    const andamento = c.metric === 'realizado' && mesEmAndamento(c, mes)
    return {
      tela,
      titulo: `${nomeMetric} por área · ${mesAno(c.ano, mes)}`,
      valor: moeda(total),
      resumo: `${c.metric === 'realizado' ? 'Despesas pagas' : 'Títulos com vencimento'} em ${mesAno(c.ano, mes)}, separadas pelo departamento do título.`,
      formula: `Total do mês = soma do ${nomeMetric.toLowerCase()} de cada área`,
      conta: [
        ...linhas,
        linhaTotal(`Total ${rotuloMes(c.ano, mes)}`, total),
        ...notaArredondamento(linhas, total),
        ...(zeradas > 0
          ? [{ rotulo: 'Áreas sem valor no mês', valor: String(zeradas), numero: zeradas, tipo: 'info' as const, detalhe: 'aparecem com R$ 0,00 no tooltip' }]
          : []),
      ],
      filtros: [{ rotulo: 'Mês', valor: mesAno(c.ano, mes) }, ...filtros],
      regras: [
        ...(andamento ? [`${rotuloMes(c.ano, mes)} está em andamento: só o que foi pago até hoje.`] : []),
        ...regrasDepartamentos(c),
      ],
      fonte: FONTE,
      fonteTecnica: 'Supabase › opex_departamentos_mensal (opex_item_elegivel_departamento) · buildOpexDepartamentosChartData',
      detalhe: 'Fora do Fênix, clique numa área na legenda para ver os grupos e planos dela.',
    }
  }

  const porArea = c.fatias
    .map((f) => ({ rotulo: f.label, v: c.data.reduce((s, row) => s + num(row[f.dataKey]), 0) }))
    .filter((x) => x.v !== 0)
  const linhas = parcelas(porArea)
  return {
    tela,
    titulo: `${nomeMetric} por área / departamento`,
    valor: moeda(c.total),
    resumo: `${c.metric === 'realizado' ? 'Despesas pagas' : 'Títulos com vencimento'} em ${c.ano}, mês a mês, empilhadas pelo departamento do título.`,
    formula: 'Total = soma de todas as áreas visíveis em todos os meses',
    conta: [...linhas, linhaTotal('Total do gráfico', c.total), ...notaArredondamento(linhas, c.total)],
    filtros,
    regras: [...regrasDepartamentos(c), 'Aponte um mês para ver a conta daquele mês.'],
    fonte: FONTE,
    fonteTecnica: 'Supabase › opex_departamentos_mensal (opex_item_elegivel_departamento)',
  }
}

// ---------------------------------------------------------------------------
// Distribuição mensal do orçamento (painel Orçamento)
// ---------------------------------------------------------------------------

export type OpexOrcamentoLinhaFenix = { mes: number; grupo_conta: string; plano_contas: string; valor: number }

export type OpexGraficoOrcamentoContexto = {
  ano: number
  /** Linhas que o gráfico somou (já com busca e mês selecionado). */
  linhas: readonly OpexOrcamentoLinhaFenix[]
  /** Mesmo array do gráfico (12 meses). */
  data: readonly { mes: number; label: string; total: number }[]
  /** Grupo de conta, quando é o gráfico dentro de um grupo. */
  grupo?: string | null
  busca?: string
  mesSelecionado: number | null
}

const MAX_PARCELAS_ORC = 10

function regrasOrcamento(c: OpexGraficoOrcamentoContexto): string[] {
  const r = [
    'Orçamento congelado do ano: linhas importadas da planilha ou lançadas e editadas neste painel.',
    'É o planejado, não o pago: o realizado vem dos títulos do VIOS.',
    'Cada linha tem mês, grupo de conta, plano, fornecedor/descrição, departamento e valor; o ponto do mês soma as linhas daquele mês.',
  ]
  if (c.busca?.trim()) r.push(`Só entram as linhas que batem com a busca "${c.busca.trim()}".`)
  if (c.mesSelecionado != null) {
    r.push(`Com ${mesAno(c.ano, c.mesSelecionado)} selecionado, a tabela e o gráfico ficam só com esse mês; os outros aparecem zerados.`)
  }
  if (c.grupo) r.push(`Gráfico do grupo de conta ${c.grupo}: só as linhas desse grupo.`)
  r.push('O filtro de plano de contas do painel não vale aqui.')
  return r
}

export function explicarGraficoOpexOrcamento(c: OpexGraficoOrcamentoContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const tela = `OPEX › ${c.ano} › Orçamento${c.grupo ? ` › ${c.grupo}` : ''}`
  const porGrupo = !c.grupo
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    ...(c.grupo ? [{ rotulo: 'Grupo', valor: c.grupo }] : []),
    ...(c.busca?.trim() ? [{ rotulo: 'Busca', valor: c.busca.trim() }] : []),
    ...(c.mesSelecionado != null ? [{ rotulo: 'Mês selecionado', valor: mesAno(c.ano, c.mesSelecionado) }] : []),
  ]
  const d = ponto ? c.data[ponto.indice] : undefined
  if (ponto && d) {
    const agrupado = new Map<string, number>()
    for (const l of c.linhas) {
      if (l.mes !== d.mes) continue
      const k = (porGrupo ? l.grupo_conta : l.plano_contas) || (porGrupo ? 'Sem grupo' : 'Sem plano')
      agrupado.set(k, (agrupado.get(k) ?? 0) + l.valor)
    }
    const itens = topComDemais(
      [...agrupado.entries()].map(([rotulo, v]) => ({ rotulo, v })).sort((a, b) => b.v - a.v),
      MAX_PARCELAS_ORC,
      (n) => `Demais ${n} ${porGrupo ? 'grupos' : 'planos'}`,
    )
    const linhas = parcelas(itens)
    const qtd = c.linhas.filter((l) => l.mes === d.mes).length
    return {
      tela,
      titulo: `Orçamento · ${mesAno(c.ano, d.mes)}`,
      valor: moeda(d.total),
      resumo: `Quanto o orçamento prevê para ${mesAno(c.ano, d.mes)}${c.grupo ? ` no grupo ${c.grupo}` : ''}, somando ${qtd} linha(s).`,
      formula: `Orçamento do mês = soma das linhas do mês, por ${porGrupo ? 'grupo de conta' : 'plano'}`,
      conta: [...linhas, linhaTotal(`Orçamento ${rotuloMes(c.ano, d.mes)}`, d.total), ...notaArredondamento(linhas, d.total)],
      filtros,
      regras: regrasOrcamento(c),
      fonte: 'Orçamento congelado do ano (painel Orçamento do OPEX).',
      fonteTecnica: 'Supabase › opex_orcamento_list (opex_orcamento_linha) · buildTotaisPorMes',
      detalhe: 'Fora do Fênix, clique no ponto do mês para filtrar a tabela.',
    }
  }

  const comValor = c.data.filter((x) => x.total !== 0)
  const linhas = parcelas(comValor.map((x) => ({ rotulo: rotuloMes(c.ano, x.mes), v: x.total })))
  const total = c.data.reduce((s, x) => s + x.total, 0)
  return {
    tela,
    titulo: `Distribuição mensal do orçamento${c.grupo ? ` · ${c.grupo}` : ''}`,
    valor: moeda(total),
    resumo: `Orçamento de ${c.ano} mês a mês${c.grupo ? ` no grupo ${c.grupo}` : ''}, com as linhas que estão na tabela.`,
    formula: 'Total = soma do orçamento de cada mês',
    conta: [...linhas, linhaTotal(`Orçamento ${c.ano}`, total), ...notaArredondamento(linhas, total)],
    filtros,
    regras: [...regrasOrcamento(c), 'Aponte um mês para ver o que compõe aquele mês.'],
    fonte: 'Orçamento congelado do ano (painel Orçamento do OPEX).',
    fonteTecnica: 'Supabase › opex_orcamento_list (opex_orcamento_linha)',
  }
}
