/**
 * Fênix na Receita: Gestão à vista, Inadimplência e Custos e resultado.
 *
 * Funções puras. Recebem os mesmos valores que o card mostra (nada é recalculado
 * por outro caminho), então a explicação sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import { PLANOS_CONTAS_INCLUIDOS_COTA, RECEITA_META_INADIMPLENCIA_PCT } from '../constants.ts'
import type { GestaoVistaMesRow, GestaoVistaResumo, ReceitaResultadoCaixaMesRow } from '../types/receita.types.ts'
import { isMesAtual } from '../utils/receitaMes.ts'
import {
  SAIDAS_FORA_CALCULO,
  SAIDAS_NAO_OPEX,
  variacaoPct,
  type CascataLinha,
  type ResultadoCaixaTotais,
} from '../utils/receitaResultadoCaixa.ts'
import { periodoMeses, rotuloMesAno } from './receitaFenix.ts'

const moeda = formatCurrency

function pctBr(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function listaComE(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

const PLANOS_COTA_TEXTO = listaComE(
  PLANOS_CONTAS_INCLUIDOS_COTA.map((p) => p.replace(/^HONORÁRIOS\s+(DE\s+|POR\s+)?/i, '').toLowerCase()),
)

const REGRA_COTA = `Só entram os honorários da cota (${PLANOS_COTA_TEXTO}). Parcerias, reembolsos, adiantamentos e outras receitas ficam fora.`

const REGRA_RECEBIDO =
  'O recebido segue as regras do card Recebido do Resumo: conta pela data de pagamento, só honorários da cota e sem encargos (tarifa de boleto e juros).'

const FONTE_FINANCEIRO = 'Financeiro do VIOS: itens dos títulos a receber, sincronizados no SIOE.'

function total(rotulo: string, v: number): FenixLinha {
  return { rotulo, valor: moeda(v), numero: v, operador: '=', tipo: 'total' }
}

function info(rotulo: string, v: number, detalhe?: string): FenixLinha {
  return { rotulo, valor: moeda(v), numero: v, tipo: 'info', detalhe }
}

function linhasMensais(
  ano: number,
  itens: readonly { mes: number; valor: number }[],
  detalhe?: (mes: number) => string | undefined,
): FenixLinha[] {
  return itens.map((it, i) => ({
    rotulo: rotuloMesAno(ano, it.mes),
    valor: moeda(it.valor),
    numero: it.valor,
    operador: i === 0 ? undefined : '+',
    detalhe: detalhe?.(it.mes),
  }))
}

const centavos = (v: number) => Math.round(v * 100)

/** Soma, em centavos, das parcelas como aparecem na tela (respeitando o sinal de "−"). */
function somaExibida(linhas: readonly FenixLinha[]): number {
  return linhas.reduce((s, l) => s + (l.operador === '−' ? -1 : 1) * centavos(l.numero ?? 0), 0)
}

/**
 * Quando as parcelas exibidas (arredondadas a centavos) não somam o total do card,
 * explica a diferença em uma linha própria em vez de esconder.
 */
function notaDiferenca(parcelas: readonly FenixLinha[], totalExato: number, motivo: string): FenixLinha[] {
  const dif = (centavos(totalExato) - somaExibida(parcelas)) / 100
  if (dif === 0) return []
  return [
    {
      rotulo: 'Diferença de arredondamento',
      valor: moeda(Math.abs(dif)),
      numero: dif,
      tipo: 'info',
      detalhe: `as linhas somam ${moeda(somaExibida(parcelas) / 100)}; ${motivo}`,
    },
  ]
}

function porMes<T extends { mes: number }>(linhas: readonly T[]): Map<number, T> {
  return new Map(linhas.map((l) => [l.mes, l]))
}

function ontem(hoje: Date): Date {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  d.setDate(d.getDate() - 1)
  return d
}

function dataCurta(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Mesmo texto da barra do card: limita em 100% quando passa. */
function notaBarraLimitada(pct: number): FenixLinha[] {
  if (pct <= 100) return []
  return [
    {
      rotulo: 'Barra do card',
      valor: formatPercent(100),
      numero: 100,
      tipo: 'info',
      detalhe: `a barra para em 100%; o percentual real é ${formatPercent(pct)}`,
    },
  ]
}

// ---------------------------------------------------------------------------
// Receita › Gestão à vista
// ---------------------------------------------------------------------------

export type GestaoVistaFenixContexto = {
  ano: number
  /** Área filtrada nos botões da seção; ausente = escritório inteiro. */
  area?: { label: string; pct: number } | null
  /** O mesmo resumo que alimenta os cards. */
  resumo: GestaoVistaResumo
  /** As mesmas linhas da tabela ao lado (recebido e previsto por mês). */
  meses: readonly GestaoVistaMesRow[]
  /** Previsto do mês em andamento já cortado em ontem (o valor que entra no card). */
  previstoCortePorMes?: ReadonlyMap<number, number>
  /** Inadimplência vencida de cada mês (as parcelas somadas no card). */
  inadPorMes?: readonly { mes: number; valor: number }[]
  hoje?: Date
}

const TELA_GESTAO = 'Receita › Gestão à vista'

function sufixoArea(c: GestaoVistaFenixContexto): string {
  return c.area ? ` (${c.area.label})` : ''
}

function filtrosGestao(c: GestaoVistaFenixContexto): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    c.area ? { rotulo: 'Área', valor: c.area.label } : { rotulo: 'Visão', valor: 'Escritório (todas as áreas)' },
    { rotulo: 'Meses considerados', valor: c.resumo.periodoMetaLabel },
    { rotulo: 'Vigência da meta', valor: c.resumo.periodoMetaAnualLabel },
  ]
}

function regrasArea(c: GestaoVistaFenixContexto): string[] {
  if (!c.area) return []
  return [
    `Visão por área: entram só os títulos do departamento ${c.area.label} no VIOS (departamento de cada item do título).`,
  ]
}

function regraRotuloPeriodo(r: GestaoVistaResumo): string[] {
  if (r.periodoMetaLabel === r.periodoMetaAnualLabel) return []
  return [
    `O título do card fala em ${r.periodoMetaAnualLabel} (vigência da meta), mas só entram os meses com meta que já começaram: ${r.periodoMetaLabel}.`,
  ]
}

function recebidoPorMes(c: GestaoVistaFenixContexto): { mes: number; valor: number }[] {
  const doMes = porMes(c.meses)
  return c.resumo.mesesMetaNoPeriodo.map((mes) => ({ mes, valor: doMes.get(mes)?.recebido ?? 0 }))
}

function detalheMesAndamento(c: GestaoVistaFenixContexto, texto: string) {
  const hoje = c.hoje ?? new Date()
  return (mes: number) => (isMesAtual(c.ano, mes, hoje) ? texto : undefined)
}

export function explicarGestaoMeta(c: GestaoVistaFenixContexto): FenixExplicacao {
  const r = c.resumo
  const pct = r.pctMeta ?? 0
  const parcelas = linhasMensais(c.ano, recebidoPorMes(c), detalheMesAndamento(c, 'mês em andamento: pago até hoje'))
  const gap = r.metaAcumulada - r.recebidoAtingimento
  const conta: FenixLinha[] = [
    ...parcelas,
    total('Recebido nos meses com meta', r.recebidoAtingimento),
    ...notaDiferenca(parcelas, r.recebidoAtingimento, 'o total usa os valores exatos'),
    {
      rotulo: `Meta ${r.periodoMetaAnualLabel}`,
      valor: moeda(r.metaAcumulada),
      numero: r.metaAcumulada,
      operador: '÷',
      detalhe: c.area
        ? `${pctBr(c.area.pct)} da meta original do escritório em cada mês`
        : 'soma da meta original de cada mês com meta',
    },
    { rotulo: 'Atingimento', valor: formatPercent(pct), numero: pct, operador: '=', tipo: 'total', detalhe: '× 100' },
    gap > 0.01
      ? info('Faltam para a meta', gap, 'meta − recebido')
      : gap < -0.01
        ? info('Acima da meta', -gap, 'recebido − meta')
        : info('Meta atingida', 0),
    ...notaBarraLimitada(pct),
  ]
  return {
    tela: TELA_GESTAO,
    titulo: `Meta · ${r.periodoMetaAnualLabel}${sufixoArea(c)}`,
    valor: moeda(r.recebidoAtingimento),
    resumo: `O valor do card é o que já entrou no caixa nos meses com meta (${r.periodoMetaLabel}); a barra mostra quanto isso representa da meta de ${r.periodoMetaAnualLabel}.`,
    formula: 'Atingimento = Recebido nos meses com meta já iniciados ÷ Meta do ano × 100',
    conta,
    filtros: filtrosGestao(c),
    regras: [
      `O divisor é a meta de todo o período de vigência (${r.periodoMetaAnualLabel}), não só a dos meses que já passaram. Por isso o percentual cresce ao longo do ano.`,
      'Usa a meta original de cada mês, sem o ajuste do que faltou nos meses anteriores. A coluna Meta da tabela mostra a meta do mês já ajustada; o Total da tabela usa a mesma meta deste card.',
      ...(c.area ? [`A meta da área é ${pctBr(c.area.pct)} da meta do escritório (contribuição da área definida para o ano).`] : []),
      REGRA_RECEBIDO,
      'Só entram os meses com meta que já começaram. O mês em andamento entra com o que foi pago até hoje.',
      ...regrasArea(c),
    ],
    fonte: `${FONTE_FINANCEIRO} Meta: Configurações da Receita.`,
    fonteTecnica: c.area
      ? 'buildGestaoVistaArea (receita/utils/receitaGestaoVista.ts) · receita_recebido_por_departamento_mensal · app_settings.receita_metas × RECEITA_META_CONTRIBUICAO_AREA'
      : 'buildGestaoVistaConsolidado → calcularAtingimentoMetaKpi (receitaAcumuladoChart.ts) · receita_totais_mensais · app_settings.receita_metas',
    detalhe: 'A tabela ao lado mostra mês a mês. Fora do Fênix, clique no Recebido de um mês para ver os títulos.',
  }
}

export function explicarGestaoBatimento(
  c: GestaoVistaFenixContexto & {
    /** Percentual exibido na barra (antes do limite de 100%). */
    pct: number
  },
): FenixExplicacao {
  const r = c.resumo
  const hoje = c.hoje ?? new Date()
  const doMes = porMes(c.meses)
  const recebido = linhasMensais(c.ano, recebidoPorMes(c), detalheMesAndamento(c, 'mês em andamento: pago até hoje'))
  const corteOntem = dataCurta(ontem(hoje))
  const previstos = r.mesesMetaNoPeriodo.map((mes) => {
    const cheio = doMes.get(mes)?.previsto ?? 0
    const cortado = c.previstoCortePorMes?.get(mes)
    return { mes, valor: cortado ?? cheio, cheio, cortado: cortado != null }
  })
  const temCorte = previstos.some((p) => p.cortado)
  const linhasPrevisto: FenixLinha[] = previstos.map((p) => ({
    rotulo: `Previsto ${rotuloMesAno(c.ano, p.mes)}`,
    valor: moeda(p.valor),
    numero: p.valor,
    tipo: 'info',
    detalhe: p.cortado ? `só o que venceu até ${corteOntem}; o mês inteiro prevê ${moeda(p.cheio)}` : undefined,
  }))
  const gap = r.previstoAcumulado - r.recebidoAcumulado
  const conta: FenixLinha[] = [
    ...recebido,
    total(`Recebido ${r.periodoMetaLabel}`, r.recebidoAcumulado),
    ...notaDiferenca(recebido, r.recebidoAcumulado, 'o total usa os valores exatos'),
    {
      rotulo: `Previsto ${r.periodoMetaLabel}`,
      valor: moeda(r.previstoAcumulado),
      numero: r.previstoAcumulado,
      operador: '÷',
      detalhe: temCorte ? `mês em andamento só até ${corteOntem}` : 'vencimentos dos meses considerados',
    },
    { rotulo: 'Batimento', valor: formatPercent(c.pct), numero: c.pct, operador: '=', tipo: 'total', detalhe: '× 100' },
    ...linhasPrevisto,
    ...notaDiferenca(linhasPrevisto, r.previstoAcumulado, 'o previsto do card usa os valores exatos'),
    gap > 0.01
      ? info('Faltam para bater o previsto', gap, 'previsto − recebido')
      : gap < -0.01
        ? info('Recebido acima do previsto', -gap, 'recebido − previsto')
        : info('Previsto batido', 0),
    ...notaBarraLimitada(c.pct),
  ]
  return {
    tela: TELA_GESTAO,
    titulo: `Recebido × previsto · ${r.periodoMetaLabel}${sufixoArea(c)}`,
    valor: moeda(r.recebidoAcumulado),
    resumo: `Quanto entrou no caixa nos meses com meta (${r.periodoMetaLabel}) comparado com o que estava programado para vencer nesses meses.`,
    formula: 'Batimento = Recebido ÷ Previsto × 100',
    conta,
    filtros: filtrosGestao(c),
    regras: [
      REGRA_RECEBIDO,
      'Previsto: soma dos títulos com vencimento nos meses considerados, pagos ou não, pelo valor do título.',
      ...(temCorte
        ? ['No mês em andamento, o previsto só conta o que venceu até ontem (vencimento de hoje ainda não é exigível).']
        : []),
      'O recebido de um mês inclui pagamentos de títulos de outros meses (atrasados ou antecipados); por isso o batimento pode passar de 100%.',
      ...regrasArea(c),
    ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: c.area
      ? 'buildGestaoVistaArea (receitaGestaoVista.ts) · receita_recebido_por_departamento_mensal · receita_previsto_por_departamento_mensal · receita_previsto_mes_itens (corte do mês)'
      : 'buildGestaoVistaConsolidado (receitaGestaoVista.ts) · receita_totais_mensais · receita_previsto_mes_itens (corte do mês) · somarPrevistoVencidoAteCorte',
    detalhe: 'Fora do Fênix, clique no Previsto ou no Recebido de um mês da tabela para ver a composição.',
  }
}

export function explicarGestaoInadimplencia(c: GestaoVistaFenixContexto): FenixExplicacao {
  const r = c.resumo
  const pct = r.inadimplenciaVencidoPctAno ?? 0
  const meta = RECEITA_META_INADIMPLENCIA_PCT
  const parcelas = c.inadPorMes
    ? linhasMensais(
        c.ano,
        r.mesesMetaNoPeriodo.map((mes) => ({ mes, valor: c.inadPorMes!.find((x) => x.mes === mes)?.valor ?? 0 })),
        detalheMesAndamento(c, 'mês em andamento: vencidos até ontem'),
      )
    : []
  const dif = pct - meta
  const conta: FenixLinha[] = [
    ...parcelas,
    total('Inadimplência vencida', r.inadimplenciaVencidoAno),
    ...notaDiferenca(parcelas, r.inadimplenciaVencidoAno, 'o total usa os valores exatos'),
    {
      rotulo: `Previsto ${r.periodoMetaLabel}`,
      valor: moeda(r.previstoAcumulado),
      numero: r.previstoAcumulado,
      operador: '÷',
      detalhe: 'o mesmo previsto do card Recebido × previsto',
    },
    {
      rotulo: 'Inadimplência sobre o previsto',
      valor: formatPercent(pct),
      numero: pct,
      operador: '=',
      tipo: 'total',
      detalhe: '× 100',
    },
    {
      rotulo: 'Meta (teto)',
      valor: formatPercent(meta),
      numero: meta,
      tipo: 'info',
      detalhe:
        Math.abs(dif) <= 0.01
          ? 'na meta'
          : dif > 0
            ? `${formatPercent(dif)} acima da meta`
            : `${formatPercent(-dif)} abaixo da meta`,
    },
  ]
  return {
    tela: TELA_GESTAO,
    titulo: `Inad. vencida · ${r.periodoMetaAnualLabel}${sufixoArea(c)}`,
    valor: moeda(r.inadimplenciaVencidoAno),
    resumo: `Títulos dos meses com meta que venceram e não foram pagos dentro do próprio mês, e quanto isso representa do previsto. Quanto menor, melhor; o teto é ${formatPercent(meta)}.`,
    formula: 'Inad. % = Vencido e não pago no mês do vencimento ÷ Previsto × 100',
    conta,
    filtros: filtrosGestao(c),
    regras: [
      'Entra o título com vencimento no mês que já venceu (no mês em andamento, vencimento até ontem; hoje ainda não conta) e não foi pago dentro desse mês.',
      'Se foi pago depois do mês, continua contando como inadimplência daquele mês. Título pago antes do mês do vencimento não conta.',
      'Conta título a título: pagamento a mais de um cliente não compensa o atraso de outro.',
      'Inclui clientes ativos e inativos.',
      REGRA_COTA,
      'O divisor é o mesmo previsto do card Recebido × previsto (no mês em andamento, só o que venceu até ontem).',
      `Meta: no máximo ${formatPercent(meta)} do previsto.`,
      'É uma conta diferente do Resultado da seção Inadimplência, que mede o saldo líquido por grupo (faturado − pago) no período.',
      ...regraRotuloPeriodo(r),
      ...regrasArea(c),
    ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: c.area
      ? 'receita_previsto_mes_itens + receita_previsto_itens_area · calcularInadVencidoNaoPagoMes (receita/utils/receitaPrevistoFechamento.ts)'
      : 'receita_previsto_fechamento_mes (inadimplencia_kpi) de cada mês · enrichGestaoVistaResumoInadVencidoAno (receitaGestaoVista.ts)',
    detalhe: 'A coluna Inad. da tabela ao lado mostra outra régua (saldo por grupo, congelado no fechamento).',
  }
}

// ---------------------------------------------------------------------------
// Receita › Inadimplência
// ---------------------------------------------------------------------------

export type InadimplenciaFenixContexto = {
  ano: number
  mesInicio: number
  mesFim: number
  /** Rótulo da área filtrada; null = todas as áreas. */
  areaLabel: string | null
  hoje?: Date
}

const TELA_INAD = 'Receita › Inadimplência'

function periodoInad(c: InadimplenciaFenixContexto): string {
  return periodoMeses(c.ano, c.mesInicio === c.mesFim ? [c.mesInicio] : [c.mesInicio, c.mesFim])
}

function filtrosInad(c: InadimplenciaFenixContexto): FenixFiltro[] {
  return [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Período', valor: periodoInad(c) },
    { rotulo: 'Área', valor: c.areaLabel ?? 'Todas as áreas' },
  ]
}

const REGRA_SALDO_GRUPO =
  'Para cada grupo de clientes: faturado com vencimento no período que já venceu (até ontem; vencimento de hoje ainda não conta) menos o que o grupo pagou. Pago = tudo o que entrou nos meses do período, de qualquer vencimento, mais o que foi pago antes ou depois desses meses por títulos que vencem no período.'

const REGRA_SALDO_POSITIVO =
  'Grupo que pagou mais do que devia fica com saldo zero e não abate a dívida de outro grupo.'

const REGRA_DESCONTO = 'Desconto concedido em título quitado não é dívida: sai do faturado.'

const REGRA_SEM_GRUPO = 'Cliente sem grupo conta sozinho, pela razão social.'

const REGRA_AREA_INAD =
  'Visão por área: o saldo devedor de cada cliente é repartido entre as áreas na proporção do que foi faturado para cada departamento no período (departamento do título no VIOS).'

/** Os 5 maiores grupos como parcelas, o restante agrupado, fechando no total do card. */
function composicaoPorGrupo(grupos: readonly { nome: string; valor: number }[], totalValor: number, rotuloTotal: string): FenixLinha[] {
  const ordenados = grupos.filter((g) => g.valor > 0).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'))
  const top = ordenados.slice(0, 5)
  const resto = ordenados.slice(5)
  const linhas: FenixLinha[] = top.map((g, i) => ({
    rotulo: g.nome,
    valor: moeda(g.valor),
    numero: g.valor,
    operador: i === 0 ? undefined : '+',
  }))
  if (resto.length > 0) {
    const somaResto = resto.reduce((s, g) => s + g.valor, 0)
    linhas.push({
      rotulo: `Demais ${resto.length} ${resto.length === 1 ? 'grupo' : 'grupos'}`,
      valor: moeda(somaResto),
      numero: somaResto,
      operador: '+',
    })
  }
  return [
    ...linhas,
    total(rotuloTotal, totalValor),
    ...notaDiferenca(linhas, totalValor, 'a lista por grupo pode estar desatualizada em relação ao total; recarregue a página'),
  ]
}

export function explicarInadResultadoValor(
  c: InadimplenciaFenixContexto,
  i: {
    valor: number
    /** Grupos que entram na soma (já sem os retirados à mão). Vazio = lista ainda não carregada. */
    grupos: readonly { nome: string; valor: number }[]
    /** Grupos retirados à mão na seleção do período. */
    gruposExcluidos?: number
    /** Total ajustado pela seleção de grupos. */
    ajustado?: boolean
  },
): FenixExplicacao {
  const area = c.areaLabel != null
  const conta: FenixLinha[] =
    i.grupos.length > 0
      ? composicaoPorGrupo(i.grupos, i.valor, 'Resultado R$')
      : [
          total('Resultado R$', i.valor),
          { rotulo: 'Lista por grupo', valor: '—', tipo: 'info', detalhe: 'indisponível neste momento (ainda carregando); o total vem pronto do cálculo da seção' },
        ]
  const qtdGrupos = i.grupos.filter((g) => g.valor > 0).length
  return {
    tela: TELA_INAD,
    titulo: `Resultado R$ · ${periodoInad(c)}${area ? ` (${c.areaLabel})` : ''}`,
    valor: moeda(i.valor),
    resumo: area
      ? `Saldo que os clientes ainda devem dos títulos de ${periodoInad(c)}, na parte que cabe a ${c.areaLabel}.`
      : `Saldo que os clientes ainda devem dos títulos de ${periodoInad(c)}: faturado já vencido menos o que foi pago, somado grupo a grupo${qtdGrupos > 0 ? ` (${qtdGrupos} grupos com saldo)` : ''}.`,
    formula: 'Resultado R$ = soma, por grupo, de (Faturado vencido − Pago), só quando o saldo é positivo',
    conta,
    filtros: filtrosInad(c),
    regras: [
      REGRA_SALDO_GRUPO,
      REGRA_SALDO_POSITIVO,
      REGRA_DESCONTO,
      REGRA_SEM_GRUPO,
      'Inclui clientes ativos e inativos.',
      REGRA_COTA,
      'É o saldo do período inteiro, ao vivo. Não é a soma da evolução mês a mês, que mostra os meses fechados congelados.',
      ...(area ? [REGRA_AREA_INAD] : []),
      ...(i.ajustado
        ? [
            i.gruposExcluidos && i.gruposExcluidos > 0
              ? `${i.gruposExcluidos} ${i.gruposExcluidos === 1 ? 'grupo foi retirado' : 'grupos foram retirados'} à mão na seleção de grupos e não ${i.gruposExcluidos === 1 ? 'entra' : 'entram'} na soma.`
              : 'O total foi ajustado pela seleção manual de grupos.',
          ]
        : []),
    ],
    fonte: `${FONTE_FINANCEIRO} Grupos de clientes: cadastro de pessoas do VIOS.`,
    fonteTecnica: area
      ? 'receita_inadimplencia_grupo_departamento_periodo (p_incluir_inativos = true) · inadimplenciaAreaPeriodo (receitaInadimplenciaAreaFilter.ts)'
      : 'receita_inadimplencia_dashboard → receita_inadimplencia_grupos_periodo (p_incluir_inativos = true) · receita_inadimplencia_periodo_net_clientes · finalizarKpiPeriodo (receitaInadimplenciaCalc.ts)',
    detalhe: area
      ? 'Fora do Fênix, clique no card para ver os grupos alocados à área.'
      : 'Fora do Fênix, clique no card para ver grupo a grupo e tirar grupos da conta.',
  }
}

export function explicarInadResultadoPct(
  c: InadimplenciaFenixContexto,
  i: {
    valor: number
    pct: number
    /** Previsto de cada mês do período (denominador do %). */
    previstoPorMes: readonly { mes: number; valor: number }[]
  },
): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const area = c.areaLabel != null
  const previstoTotal = i.previstoPorMes.reduce((s, m) => s + m.valor, 0)
  const temMesAtual = i.previstoPorMes.some((m) => isMesAtual(c.ano, m.mes, hoje))
  const conta: FenixLinha[] = [
    { rotulo: 'Resultado R$ (saldo do período)', valor: moeda(i.valor), numero: i.valor },
    { rotulo: `Previsto ${periodoInad(c)}`, valor: moeda(previstoTotal), numero: previstoTotal, operador: '÷' },
    { rotulo: 'Resultado %', valor: formatPercent(i.pct), numero: i.pct, operador: '=', tipo: 'total', detalhe: '× 100' },
    ...i.previstoPorMes.map<FenixLinha>((m) => ({
      rotulo: `Previsto ${rotuloMesAno(c.ano, m.mes)}`,
      valor: moeda(m.valor),
      numero: m.valor,
      tipo: 'info',
      detalhe: isMesAtual(c.ano, m.mes, hoje) ? 'mês em andamento: inclui o que ainda vai vencer' : undefined,
    })),
  ]
  return {
    tela: TELA_INAD,
    titulo: `Resultado % · ${periodoInad(c)}${area ? ` (${c.areaLabel})` : ''}`,
    valor: formatPercent(i.pct),
    resumo: `Quanto o saldo devedor do período representa do que estava previsto para vencer em ${periodoInad(c)}.`,
    formula: 'Resultado % = Resultado R$ ÷ Previsto do período × 100',
    conta,
    filtros: filtrosInad(c),
    regras: [
      'O numerador é o card Resultado R$ (saldo líquido por grupo no período).',
      'Previsto: soma dos títulos com vencimento em cada mês do período, pagos ou não.',
      ...(temMesAtual
        ? ['No mês em andamento o previsto entra cheio (inclusive o que ainda vai vencer), enquanto o saldo só conta o que venceu até ontem.']
        : []),
      'Inclui clientes ativos e inativos (regra da planilha do VIOS).',
      REGRA_COTA,
      ...(area ? ['Visão por área: previsto e saldo só do departamento da área.'] : []),
    ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: area
      ? 'receita_previsto_por_departamento_mensal · aplicarFiltroAreaInadimplencia (receitaInadimplenciaAreaFilter.ts)'
      : 'receita_inadimplencia_dashboard (evolucao.previsto via receita_previsto_mes) · finalizarKpiPeriodo (receitaInadimplenciaCalc.ts)',
  }
}

export function explicarInadTop5(
  c: InadimplenciaFenixContexto,
  i: { top5: readonly { cliente: string; valor: number }[]; total: number },
): FenixExplicacao {
  const area = c.areaLabel != null
  const linhas: FenixLinha[] = i.top5.map((g, idx) => ({
    rotulo: `${idx + 1}º ${g.cliente}`,
    valor: moeda(g.valor),
    numero: g.valor,
    operador: idx === 0 ? undefined : '+',
  }))
  return {
    tela: TELA_INAD,
    titulo: `Total dos 5 maiores inadimplentes · ${periodoInad(c)}${area ? ` (${c.areaLabel})` : ''}`,
    valor: moeda(i.total),
    resumo: area
      ? `Soma dos 5 grupos com maior saldo devedor alocado a ${c.areaLabel} em ${periodoInad(c)}.`
      : `Soma dos 5 grupos de clientes ativos com maior saldo devedor em ${periodoInad(c)}.`,
    formula: 'Total = soma do saldo dos 5 maiores grupos',
    conta: [...linhas, total('Total dos 5 maiores', i.total), ...notaDiferenca(linhas, i.total, 'o total usa os valores exatos')],
    filtros: filtrosInad(c),
    regras: area
      ? [
          'Mesmo saldo do card Resultado R$, na parte de cada grupo alocada à área (inclui inativos).',
          REGRA_AREA_INAD,
        ]
      : [
          'Mesmo saldo líquido por grupo do card Resultado R$, mas só com clientes ativos. O Resultado R$ inclui inativos.',
          REGRA_SALDO_GRUPO,
          'A seleção manual de grupos não muda esta lista.',
        ],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: area
      ? 'top5GruposPorAreaPeriodo (receitaInadimplenciaAreaFilter.ts) · receita_inadimplencia_grupo_departamento_periodo'
      : 'receita_inadimplencia_dashboard → receita_inadimplencia_grupos_periodo (p_incluir_inativos = false), 5 maiores',
  }
}

export function explicarInadConcentracao(
  c: InadimplenciaFenixContexto,
  i: { top5Total: number; valor: number; pct: number },
): FenixExplicacao {
  const area = c.areaLabel != null
  return {
    tela: TELA_INAD,
    titulo: `Concentração · ${periodoInad(c)}${area ? ` (${c.areaLabel})` : ''}`,
    valor: formatPercent(i.pct),
    resumo: 'Quanto da inadimplência do período está nos 5 maiores inadimplentes.',
    formula: 'Concentração = Total dos 5 maiores ÷ Resultado R$ × 100',
    conta: [
      { rotulo: 'Total dos 5 maiores', valor: moeda(i.top5Total), numero: i.top5Total },
      { rotulo: 'Resultado R$ do período', valor: moeda(i.valor), numero: i.valor, operador: '÷' },
      { rotulo: 'Concentração', valor: formatPercent(i.pct), numero: i.pct, operador: '=', tipo: 'total', detalhe: '× 100' },
    ],
    filtros: filtrosInad(c),
    regras: area
      ? ['Os dois valores são da área, com clientes ativos e inativos.']
      : [
          'As bases são diferentes: os 5 maiores só consideram clientes ativos; o Resultado R$ inclui inativos.',
          'Se grupos forem retirados à mão do Resultado R$, o divisor muda, mas a lista dos 5 maiores não.',
        ],
    fonte: 'Cards Resultado R$ e 5 maiores inadimplentes desta seção.',
    fonteTecnica: area
      ? 'aplicarFiltroAreaInadimplencia (receitaInadimplenciaAreaFilter.ts)'
      : 'finalizarKpiPeriodo → calcularPctInadimplencia(top5_total, valor_total_periodo) (receitaInadimplenciaCalc.ts)',
  }
}

export function explicarInadReducao(
  c: InadimplenciaFenixContexto,
  i: { primeiro: { mes: number; valor: number }; ultimo: { mes: number; valor: number }; pct: number },
): FenixExplicacao {
  const area = c.areaLabel != null
  const reducao = i.primeiro.valor - i.ultimo.valor
  const de = rotuloMesAno(c.ano, i.primeiro.mes)
  const para = rotuloMesAno(c.ano, i.ultimo.mes)
  return {
    tela: TELA_INAD,
    titulo: `Destaque do período · ${de} → ${para}${area ? ` (${c.areaLabel})` : ''}`,
    valor: formatPercent(i.pct),
    resumo: `Quanto a inadimplência do último mês da evolução (${para}) caiu em relação ao primeiro (${de}).`,
    formula: 'Redução = (Inadimplência do 1º mês − Inadimplência do último mês) ÷ Inadimplência do 1º mês × 100',
    conta: [
      { rotulo: `Inadimplência de ${de}`, valor: moeda(i.primeiro.valor), numero: i.primeiro.valor },
      { rotulo: `Inadimplência de ${para}`, valor: moeda(i.ultimo.valor), numero: i.ultimo.valor, operador: '−' },
      total('Redução em R$', reducao),
      { rotulo: `Inadimplência de ${de}`, valor: moeda(i.primeiro.valor), numero: i.primeiro.valor, operador: '÷' },
      {
        rotulo: 'Redução',
        valor: formatPercent(i.pct),
        numero: i.pct,
        operador: '=',
        tipo: 'total',
        detalhe: '× 100, arredondado para número inteiro',
      },
    ],
    filtros: filtrosInad(c),
    regras: [
      'Compara só o primeiro e o último mês da tabela Evolução da inadimplência; os meses do meio não entram.',
      'Mês fechado usa o valor congelado no fechamento; o mês em andamento é calculado ao vivo e ainda muda até o fim do mês.',
      'O valor de cada mês é o que venceu naquele mês e não foi pago (faturado − pago no mês, cliente a cliente). É uma régua diferente do Resultado R$, que olha o saldo do período inteiro.',
      'O destaque só aparece quando houve redução.',
      ...(area ? ['Visão por área: valores do departamento da área em cada mês.'] : []),
    ],
    fonte: 'Tabela Evolução da inadimplência desta seção.',
    fonteTecnica: area
      ? 'reducaoPctEvolucao (receitaInadimplenciaAreaFilter.ts) · receita_inadimplencia_departamento_mes'
      : 'receita_inadimplencia_dashboard (destaque_reducao_pct, evolução: receita_inadimplencia_fechamento_mensal / receita_inadimplencia_cliente_mes)',
  }
}

// ---------------------------------------------------------------------------
// Receita › Custos e resultado de caixa
// ---------------------------------------------------------------------------

export type ResultadoCaixaFenixContexto = {
  ano: number
  mesIni: number
  mesFim: number
  /** O último mês do recorte ainda está em andamento. */
  parcial: boolean
  /** As mesmas linhas mensais que a seção soma. */
  rows: readonly ReceitaResultadoCaixaMesRow[]
  /** Totais exibidos (ano escolhido e ano anterior, mesmo recorte de meses). */
  atual: ResultadoCaixaTotais
  anterior: ResultadoCaixaTotais
  /** Onde a seção aparece (padrão: "Receita › Custos e resultado"). */
  tela?: string
}

type CampoCaixa = keyof ResultadoCaixaTotais
export type SaidaCaixaKey = Exclude<CampoCaixa, 'receita' | 'opex'>
export type ResultadoCaixaKey = 'resultado_operacional' | 'fluxo_caixa_livre' | 'geracao_caixa_liquida'

function periodoCaixa(c: ResultadoCaixaFenixContexto, ano = c.ano): string {
  return periodoMeses(ano, c.mesIni === c.mesFim ? [c.mesIni] : [c.mesIni, c.mesFim])
}

function telaCaixa(c: ResultadoCaixaFenixContexto): string {
  return c.tela ?? 'Receita › Custos e resultado'
}

function filtrosCaixa(c: ResultadoCaixaFenixContexto): FenixFiltro[] {
  return [
    { rotulo: 'Período', valor: periodoCaixa(c) },
    { rotulo: 'Comparação', valor: periodoCaixa(c, c.ano - 1) },
    { rotulo: 'Base', valor: 'caixa (data de pagamento)' },
  ]
}

function formatVar(pct: number | null): string {
  if (pct == null) return '—'
  return `${pct > 0 ? '+' : ''}${formatPercent(pct)}`
}

function linhasCampo(c: ResultadoCaixaFenixContexto, campo: CampoCaixa): FenixLinha[] {
  const itens: { mes: number; valor: number }[] = []
  for (let mes = c.mesIni; mes <= c.mesFim; mes++) {
    const v = c.rows.find((r) => r.ano === c.ano && r.mes === mes)?.[campo] ?? 0
    if (v !== 0) itens.push({ mes, valor: v })
  }
  return linhasMensais(c.ano, itens, (m) => (c.parcial && m === c.mesFim ? 'mês em andamento: pago até hoje' : undefined))
}

function comparativo(c: ResultadoCaixaFenixContexto, atual: number, anterior: number, rotulo: string): FenixLinha[] {
  const v = variacaoPct(atual, anterior)
  return [
    info(`${rotulo} em ${periodoCaixa(c, c.ano - 1)}`, anterior),
    {
      rotulo: `Variação vs ${c.ano - 1}`,
      valor: formatVar(v),
      numero: v ?? undefined,
      tipo: 'info',
      detalhe: v == null ? 'sem base no ano anterior' : '(atual − anterior) ÷ |anterior| × 100',
    },
  ]
}

function regraParcial(c: ResultadoCaixaFenixContexto): string[] {
  return c.parcial
    ? [`O mês em andamento entra só com o que foi pago até hoje; a comparação com ${c.ano - 1} usa o mês inteiro.`]
    : []
}

const REGRA_BASE_CAIXA = 'Base caixa: cada valor entra no mês em que foi pago (data de pagamento), não no mês de competência.'

const FONTE_CAIXA = 'Financeiro do VIOS: títulos a receber e a pagar, sincronizados no SIOE.'

export function explicarCaixaReceita(c: ResultadoCaixaFenixContexto): FenixExplicacao {
  const parcelas = linhasCampo(c, 'receita')
  return {
    tela: telaCaixa(c),
    titulo: 'Receita Bruta',
    valor: moeda(c.atual.receita),
    resumo: `Honorários que entraram no caixa em ${periodoCaixa(c)}. É o mesmo Recebido do Resumo da Receita, sem encargos.`,
    formula: 'Receita Bruta = soma do recebido de cada mês, pela data de pagamento',
    conta: [
      ...parcelas,
      total('Receita Bruta', c.atual.receita),
      ...notaDiferenca(parcelas, c.atual.receita, 'o total usa os valores exatos'),
      ...comparativo(c, c.atual.receita, c.anterior.receita, 'Receita Bruta'),
    ],
    filtros: filtrosCaixa(c),
    regras: [REGRA_BASE_CAIXA, REGRA_COTA, 'Encargos de boleto e juros ficam fora.', ...regraParcial(c)],
    fonte: FONTE_FINANCEIRO,
    fonteTecnica: 'receita_resultado_caixa_mensal (coluna receita = receita_totais_mensais.recebido)',
  }
}

const GRUPOS_FORA_OPEX =
  'Distribuição de lucros, Sócios, Investimentos, Saídas - empréstimos e devoluções, Deduções da receita e Outras receitas operacionais'

export function explicarCaixaOpex(c: ResultadoCaixaFenixContexto): FenixExplicacao {
  const parcelas = linhasCampo(c, 'opex')
  return {
    tela: telaCaixa(c),
    titulo: 'Despesas operacionais (OPEX)',
    valor: moeda(c.atual.opex),
    resumo: `Tudo o que o escritório pagou em despesas operacionais em ${periodoCaixa(c)}, comparado com o mesmo período de ${c.ano - 1}.`,
    formula: 'OPEX = soma dos pagamentos de contas a pagar, fora os grupos que não são despesa operacional',
    conta: [
      ...parcelas,
      total('OPEX', c.atual.opex),
      ...notaDiferenca(parcelas, c.atual.opex, 'o total usa os valores exatos'),
      ...comparativo(c, c.atual.opex, c.anterior.opex, 'OPEX'),
    ],
    filtros: filtrosCaixa(c),
    regras: [
      REGRA_BASE_CAIXA,
      'Entra o valor pago de cada item de conta a pagar.',
      `Mesma regra do painel OPEX: entra todo pagamento, exceto os grupos de conta ${GRUPOS_FORA_OPEX}. Esses aparecem em Saídas fora do OPEX.`,
      'Despesa subindo aparece em vermelho; caindo, em verde.',
      ...regraParcial(c),
    ],
    fonte: FONTE_CAIXA,
    fonteTecnica: 'receita_resultado_caixa_mensal (opex_grupo_excluido, opex_valor_pago) sobre financeiro_parcelas_itens',
  }
}

const ORIGEM_SAIDA: Record<SaidaCaixaKey, string> = {
  distribuicao: 'Pagamentos dos grupos de conta Distribuição de lucros e Sócios.',
  investimentos: 'Pagamentos do grupo de conta Investimentos.',
  financeiro: 'Pagamentos do grupo de conta Saídas - empréstimos, aplicações e devoluções.',
  deducoes: 'Pagamentos do grupo de conta Deduções da receita.',
  repasses: 'Pagamentos do grupo de conta Outras receitas operacionais.',
  transferencias: 'Pagamentos classificados como transferência entre contas do próprio escritório.',
}

const LUGAR_NA_CASCATA: Record<SaidaCaixaKey, string> = {
  distribuicao: 'Entra na conta do resultado: é abatida do Fluxo de Caixa Livre para chegar à Geração de Caixa Líquida.',
  investimentos: 'Entra na conta do resultado: é abatida do Resultado Operacional para chegar ao Fluxo de Caixa Livre.',
  financeiro: 'Entra na conta do resultado: é abatida do Resultado Operacional para chegar ao Fluxo de Caixa Livre.',
  deducoes: 'Entra na conta do resultado: é abatida do Resultado Operacional para chegar ao Fluxo de Caixa Livre.',
  repasses: 'Fica fora da conta do resultado: a entrada correspondente não está na Receita Bruta.',
  transferencias: 'Fica fora da conta do resultado: é dinheiro mudando de conta dentro do escritório.',
}

export function explicarCaixaSaida(c: ResultadoCaixaFenixContexto, key: SaidaCaixaKey): FenixExplicacao {
  const def = [...SAIDAS_NAO_OPEX, ...SAIDAS_FORA_CALCULO].find((s) => s.key === key)
  const label = def?.label ?? key
  const parcelas = linhasCampo(c, key)
  return {
    tela: telaCaixa(c),
    titulo: label,
    valor: moeda(c.atual[key]),
    resumo: `${def?.descricao ?? label}: saídas de caixa em ${periodoCaixa(c)} que não são despesa operacional.`,
    formula: `${label} = soma dos pagamentos do grupo em cada mês`,
    conta: [
      ...parcelas,
      total(label, c.atual[key]),
      ...notaDiferenca(parcelas, c.atual[key], 'o total usa os valores exatos'),
      ...comparativo(c, c.atual[key], c.anterior[key], label),
    ],
    filtros: filtrosCaixa(c),
    regras: [ORIGEM_SAIDA[key], LUGAR_NA_CASCATA[key], REGRA_BASE_CAIXA, 'Não entra no OPEX.', ...regraParcial(c)],
    fonte: FONTE_CAIXA,
    fonteTecnica: `receita_resultado_caixa_mensal (coluna ${key}) sobre financeiro_parcelas_itens`,
  }
}

const PASSOS_RESULTADO: Record<ResultadoCaixaKey, { campo: CampoCaixa; rotulo: string }[]> = {
  resultado_operacional: [
    { campo: 'receita', rotulo: 'Receita Bruta' },
    { campo: 'opex', rotulo: 'Despesas operacionais (OPEX)' },
  ],
  fluxo_caixa_livre: [
    { campo: 'receita', rotulo: 'Receita Bruta' },
    { campo: 'opex', rotulo: 'Despesas operacionais (OPEX)' },
    { campo: 'investimentos', rotulo: 'Investimentos (CAPEX)' },
    { campo: 'financeiro', rotulo: 'Movimentações financeiras' },
    { campo: 'deducoes', rotulo: 'Deduções da receita' },
  ],
  geracao_caixa_liquida: [
    { campo: 'receita', rotulo: 'Receita Bruta' },
    { campo: 'opex', rotulo: 'Despesas operacionais (OPEX)' },
    { campo: 'investimentos', rotulo: 'Investimentos (CAPEX)' },
    { campo: 'financeiro', rotulo: 'Movimentações financeiras' },
    { campo: 'deducoes', rotulo: 'Deduções da receita' },
    { campo: 'distribuicao', rotulo: 'Distribuição de lucros aos sócios' },
  ],
}

const TEXTO_RESULTADO: Record<ResultadoCaixaKey, { titulo: string; resumo: string; formula: string }> = {
  resultado_operacional: {
    titulo: 'Resultado Operacional de Caixa',
    resumo: 'O que sobrou da receita depois das despesas operacionais, em regime de caixa (próximo de um EBITDA de caixa).',
    formula: 'Resultado Operacional = Receita Bruta − OPEX',
  },
  fluxo_caixa_livre: {
    titulo: 'Fluxo de Caixa Livre',
    resumo: 'Resultado operacional depois dos investimentos, das movimentações financeiras e das deduções da receita.',
    formula: 'Fluxo de Caixa Livre = Resultado Operacional − CAPEX − Movimentações financeiras − Deduções',
  },
  geracao_caixa_liquida: {
    titulo: 'Geração de Caixa Líquida',
    resumo: 'O que sobrou no caixa depois de tudo, inclusive da distribuição de lucros aos sócios.',
    formula: 'Geração de Caixa Líquida = Fluxo de Caixa Livre − Distribuição de lucros aos sócios',
  },
}

export function explicarCaixaResultado(c: ResultadoCaixaFenixContexto, linha: CascataLinha): FenixExplicacao {
  const key = linha.key as ResultadoCaixaKey
  const passos = PASSOS_RESULTADO[key]
  const texto = TEXTO_RESULTADO[key]
  if (!passos || !texto) throw new Error(`Linha de resultado desconhecida: ${linha.key}`)
  const parcelas: FenixLinha[] = passos.map((p, i) => ({
    rotulo: p.rotulo,
    valor: moeda(c.atual[p.campo]),
    numero: c.atual[p.campo],
    operador: i === 0 ? undefined : '−',
  }))
  const margem = c.atual.receita > 0 ? (linha.atual / c.atual.receita) * 100 : null
  const margemAnt = c.anterior.receita > 0 ? (linha.anterior / c.anterior.receita) * 100 : null
  const conta: FenixLinha[] = [
    ...parcelas,
    total(texto.titulo, linha.atual),
    ...notaDiferenca(parcelas, linha.atual, 'o total usa os valores exatos'),
  ]
  if (margem != null) {
    conta.push({
      rotulo: linha.margem ?? 'Margem',
      valor: formatPercent(margem),
      numero: margem,
      tipo: 'info',
      detalhe: `${texto.titulo} ÷ Receita Bruta × 100`,
    })
  }
  conta.push(...comparativo(c, linha.atual, linha.anterior, texto.titulo))
  if (margem != null && margemAnt != null) {
    const pp = margem - margemAnt
    conta.push({
      rotulo: `${linha.margem ?? 'Margem'} em ${c.ano - 1}`,
      valor: formatPercent(margemAnt),
      numero: margemAnt,
      tipo: 'info',
      detalhe: `${pp >= 0 ? '+' : ''}${pp.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p. em ${c.ano}`,
    })
  }
  return {
    tela: telaCaixa(c),
    titulo: texto.titulo,
    valor: moeda(linha.atual),
    resumo: `${texto.resumo} Período: ${periodoCaixa(c)}.`,
    formula: texto.formula,
    conta,
    filtros: filtrosCaixa(c),
    regras: [
      REGRA_BASE_CAIXA,
      'Repasses a terceiros e transferências entre contas do próprio escritório ficam fora da conta.',
      'A variação compara com o mesmo período do ano anterior, sobre o valor absoluto do ano anterior (funciona mesmo com resultado negativo).',
      ...regraParcial(c),
    ],
    fonte: FONTE_CAIXA,
    fonteTecnica: 'receita_resultado_caixa_mensal · buildCascataResultado (receita/utils/receitaResultadoCaixa.ts)',
  }
}

/** Explicação de qualquer linha da tabela "Resultado de caixa (DRE gerencial)". */
export function explicarCaixaLinhaDre(c: ResultadoCaixaFenixContexto, linha: CascataLinha): FenixExplicacao {
  if (linha.tipo === 'resultado') return explicarCaixaResultado(c, linha)
  if (linha.key === 'receita') return explicarCaixaReceita(c)
  if (linha.key === 'opex') return explicarCaixaOpex(c)
  return explicarCaixaSaida(c, linha.key as SaidaCaixaKey)
}
