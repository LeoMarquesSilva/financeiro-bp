/**
 * Fênix nos gráficos da Eficiência Operacional e de Operações Legais:
 * linha de evolução (EficienciaEvolucaoChart), rankings de desvio (EficienciaRankingChart)
 * e as mini-linhas do Overview de Operações Legais (visão "Gráfico de linha").
 *
 * Funções puras. Recebem o mesmo array `data`/`rows` que o gráfico desenha (o índice do
 * ponto sob o mouse aponta para ele) e as quantidades da mesma fonte da série, então o
 * ponto explicado mostra o mesmo valor do tooltip e a conta fecha com ele.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type {
  FenixExplicacao,
  FenixFiltro,
  FenixLinha,
  FenixPontoGrafico,
} from '../../../shared/fenix/fenix.types.ts'
import { formatCurrency, formatPercent } from '../../../shared/utils/format.ts'
import type { GestaoVistaMesRow, ReceitaMesRow } from '../../receita/types/receita.types.ts'
import {
  EFICIENCIA_META_INDICE_INADIMPLENCIA,
  EFICIENCIA_META_PDI,
  MESES_EFICIENCIA,
  OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE,
  OPS_FECHAMENTO_AUTOMACAO_MES_INICIO,
  OPS_FECHAMENTO_HISTORICO_MANUAL,
  type MesFiltroEficiencia,
} from '../constants.ts'
import {
  descreverFiltroMes,
  explicarRazao,
  horasMinutos,
  infoIndicador,
  periodoMesesTexto,
  rotuloDia,
  rotuloMesAno,
  type FenixMesContagem,
  type IndicadorRazao,
} from './eficienciaOperacionalFenix.ts'
import { explicarGestaoPdiPeriodo, explicarReceitaBrutaPct } from './eficienciaPessoasFinanceiroFenix.ts'

const pct = (v: number) => formatPercent(v)
const moeda = formatCurrency
const int = (n: number) => n.toLocaleString('pt-BR')

/** O objeto vai para a IA na etapa 2: sem chaves `undefined` (JSON de ida e volta igual). */
function limpo(e: FenixExplicacao): FenixExplicacao {
  return JSON.parse(JSON.stringify(e)) as FenixExplicacao
}

export function explicarGraficoEvolucao(
  ...args: Parameters<typeof explicarGraficoEvolucaoBruto>
): FenixExplicacao {
  return limpo(explicarGraficoEvolucaoBruto(...args))
}

export function explicarRanking(...args: Parameters<typeof explicarRankingBruto>): FenixExplicacao {
  return limpo(explicarRankingBruto(...args))
}

export function explicarSerieUnificada(
  ...args: Parameters<typeof explicarSerieUnificadaBruto>
): FenixExplicacao {
  return limpo(explicarSerieUnificadaBruto(...args))
}

export function explicarDesenvolvimentoAcumuladoNoMes(
  ...args: Parameters<typeof explicarDesenvolvimentoAcumuladoNoMesBruto>
): FenixExplicacao {
  return limpo(explicarDesenvolvimentoAcumuladoNoMesBruto(...args))
}

export function explicarIniciativasAcumuladoNoMes(
  ...args: Parameters<typeof explicarIniciativasAcumuladoNoMesBruto>
): FenixExplicacao {
  return limpo(explicarIniciativasAcumuladoNoMesBruto(...args))
}

// ---------------------------------------------------------------------------
// Linha de evolução: o que o gráfico desenha
// ---------------------------------------------------------------------------

/** Mesmo formato de `EvolucaoPoint` (EficienciaEvolucaoChart). */
export type EvolucaoPontoFenix = {
  mes: number
  valor: number | null
  meta?: number | null
  label?: string
}

export type GraficoEvolucaoBase = {
  tela: string
  /** Título do gráfico na tela. */
  titulo: string
  ano: number
  granularidade?: 'mes' | 'dia'
  /** Mês do drill-down diário. */
  mesDia?: number | null
  /** O mesmo array `data` do gráfico. */
  data: readonly EvolucaoPontoFenix[]
  metaFixa?: number | null
  /** Rótulo verde quando valor ≤ meta (ex.: inadimplência). */
  metaAbaixoMelhor?: boolean
  /** Indicador em que menor é melhor (o selo "Melhor mês" marca o maior valor mesmo assim). */
  menorEhMelhor?: boolean
  resumo: string
  formula?: string
  regras?: readonly string[]
  fonte?: string
  fonteTecnica?: string
  filtros?: readonly FenixFiltro[]
  detalhe?: string
}

/** Mesma meta da linha tracejada: `metaFixa` ou a primeira meta da série. */
export function metaDaLinha(data: readonly EvolucaoPontoFenix[], metaFixa?: number | null): number | null {
  const m =
    metaFixa ?? data.map((d) => d.meta).find((x) => x != null && Number.isFinite(Number(x))) ?? null
  return m == null ? null : Number(m)
}

/** Mesmo critério do selo "Melhor mês": maior valor; empate → o mais recente. */
export function melhorPonto(
  data: readonly EvolucaoPontoFenix[],
): { indice: number; valor: number } | null {
  const validos = data
    .map((d, indice) => ({ indice, valor: d.valor == null ? NaN : Number(d.valor) }))
    .filter((x) => Number.isFinite(x.valor))
  if (validos.length < 2) return null
  let best = validos[0]!
  for (const cur of validos.slice(1)) {
    if (cur.valor > best.valor || (cur.valor === best.valor && cur.indice > best.indice)) best = cur
  }
  return best
}

function rotuloPonto(c: GraficoEvolucaoBase, p: EvolucaoPontoFenix): string {
  if (c.granularidade === 'dia' && c.mesDia != null) return rotuloDia(c.ano, c.mesDia, p.mes)
  if (p.label) return p.label
  return rotuloMesAno(c.ano, p.mes)
}

function metaDoPonto(c: GraficoEvolucaoBase, p: EvolucaoPontoFenix): number | null {
  const linha = metaDaLinha(c.data, c.metaFixa)
  const m = linha ?? p.meta ?? null
  return m == null || !Number.isFinite(Number(m)) ? null : Number(m)
}

function atingiu(valor: number, meta: number, abaixo?: boolean): boolean {
  return abaixo ? valor <= meta : valor >= meta
}

/**
 * Põe a explicação de um ponto no contexto do gráfico: título com o rótulo do ponto,
 * valor igual ao do tooltip e a meta da linha (cor do rótulo).
 */
export function comoPontoDoGrafico(
  base: FenixExplicacao,
  g: {
    tela: string
    grafico: string
    rotulo: string
    /** Valor como aparece no tooltip/rótulo do ponto. */
    valor: string
    meta?: { texto: string; numero: number; atingiu: boolean | null } | null
  },
): FenixExplicacao {
  const extras: FenixLinha[] = g.meta
    ? [
        {
          rotulo: 'Meta da linha',
          valor: g.meta.texto,
          numero: g.meta.numero,
          tipo: 'info',
          detalhe:
            g.meta.atingiu == null
              ? 'linha tracejada do gráfico'
              : g.meta.atingiu
                ? 'rótulo verde: atingiu a meta'
                : 'rótulo vermelho: não atingiu a meta',
        },
      ]
    : []
  return {
    ...base,
    tela: g.tela,
    titulo: `${g.grafico} · ${g.rotulo}`,
    valor: g.valor,
    conta: [...(base.conta ?? []), ...extras],
    filtros: [
      { rotulo: 'Gráfico', valor: g.grafico },
      { rotulo: 'Ponto', valor: g.rotulo },
      ...(base.filtros ?? []),
    ],
    regras: [
      ...(base.regras ?? []),
      `No gráfico, o ponto e o tooltip de ${g.rotulo} mostram ${g.valor}.`,
    ],
  }
}

/**
 * Explica o ponto sob o mouse (com `explicarPonto` da aba) ou, sem ponto,
 * a linha inteira: todos os pontos, a meta e o selo "Melhor mês".
 */
function explicarGraficoEvolucaoBruto(
  c: GraficoEvolucaoBase & {
    explicarPonto?: (p: EvolucaoPontoFenix, indice: number) => FenixExplicacao | null
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const p = ponto ? c.data[ponto.indice] : undefined
  if (p && ponto) {
    const rotulo = rotuloPonto(c, p)
    const valor = p.valor == null ? '—' : pct(p.valor)
    const meta = metaDoPonto(c, p)
    const base =
      c.explicarPonto?.(p, ponto.indice) ??
      ({
        tela: c.tela,
        titulo: c.titulo,
        valor,
        resumo: c.resumo,
        formula: c.formula,
        conta: [{ rotulo, valor, numero: p.valor ?? undefined, tipo: 'total' }],
        filtros: c.filtros ? [...c.filtros] : undefined,
        regras: c.regras ? [...c.regras] : undefined,
        fonte: c.fonte,
        fonteTecnica: c.fonteTecnica,
        detalhe: c.detalhe,
      } satisfies FenixExplicacao)
    return comoPontoDoGrafico(base, {
      tela: c.tela,
      grafico: c.titulo,
      rotulo,
      valor,
      meta:
        meta != null
          ? {
              texto: pct(meta),
              numero: meta,
              atingiu: p.valor == null ? null : atingiu(p.valor, meta, c.metaAbaixoMelhor),
            }
          : null,
    })
  }

  const meta = metaDaLinha(c.data, c.metaFixa)
  const conta: FenixLinha[] = []
  c.data.forEach((d) => {
    if (d.valor == null) return
    const m = metaDoPonto(c, d)
    conta.push({
      rotulo: rotuloPonto(c, d),
      valor: pct(d.valor),
      numero: d.valor,
      tipo: 'info',
      detalhe:
        m == null
          ? undefined
          : atingiu(d.valor, m, c.metaAbaixoMelhor)
            ? 'atingiu a meta'
            : 'não atingiu a meta',
    })
  })
  const melhor = melhorPonto(c.data)
  const nomeSelo = c.granularidade === 'dia' ? 'Melhor dia' : 'Melhor mês'
  if (melhor) {
    const d = c.data[melhor.indice]!
    conta.push({
      rotulo: `Selo "${nomeSelo}"`,
      valor: `${rotuloPonto(c, d)} · ${pct(melhor.valor)}`,
      numero: melhor.valor,
      tipo: 'info',
      detalhe: 'maior valor da linha (empate: o mais recente)',
    })
  }
  if (meta != null) {
    conta.push({ rotulo: 'Meta (linha tracejada)', valor: pct(meta), numero: meta, tipo: 'info' })
  }
  const mesesComValor = c.data.filter((d) => d.valor != null)
  const valor =
    c.granularidade === 'dia' && c.mesDia != null
      ? `${MESES_EFICIENCIA[c.mesDia - 1]}/${c.ano}, dia a dia`
      : mesesComValor.length === 1 && mesesComValor[0]!.label
        ? mesesComValor[0]!.label
        : periodoMesesTexto(
            c.ano,
            mesesComValor.map((d) => d.mes),
          )
  return {
    tela: c.tela,
    titulo: c.titulo,
    valor,
    resumo: c.resumo,
    formula: c.formula,
    conta,
    filtros: c.filtros ? [...c.filtros] : undefined,
    regras: [
      ...(c.regras ?? []),
      c.granularidade === 'dia'
        ? 'Cada ponto é o percentual do dia, só com os itens daquele dia. Dias sem movimento não aparecem.'
        : 'Cada ponto é o percentual do mês, só com os itens daquele mês. Para ver a conta de um ponto, aponte o Fênix para ele.',
      ...(c.menorEhMelhor
        ? [`Atenção: neste indicador menor é melhor, mas o selo "${nomeSelo}" marca o maior valor da linha.`]
        : []),
    ],
    fonte: c.fonte,
    fonteTecnica: c.fonteTecnica,
    detalhe: c.detalhe,
  }
}

// ---------------------------------------------------------------------------
// Linha de evolução dos indicadores "X de Y" (Jurídico e Operações Legais)
// ---------------------------------------------------------------------------

export type GraficoRazaoCtx = {
  indicador: IndicadorRazao
  tela?: string
  titulo: string
  ano: number
  area?: string | null
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  granularidade?: 'mes' | 'dia'
  mesDia?: number | null
  data: readonly EvolucaoPontoFenix[]
  metaFixa?: number | null
  /** Quantidades da série mensal da equipe (mesma RPC dos pontos). */
  meses?: readonly (FenixMesContagem & { meta?: number | null })[]
  /** Quantidades da série diária (ok só quando a apuração diária traz o numerador). */
  dias?: readonly { dia: number; ok?: number | null; total: number }[]
  /** Gráfico de um ponto só com filtro de semana/dias: os totais do período. */
  periodoCurto?: { ok: number; total: number } | null
  hoje?: Date
}

const SEM_CONTAGEM_RESPONSAVEL =
  'Com filtro de responsável, o ponto é montado com as linhas do Racional da pessoa; as quantidades aparecem item a item no Racional.'

export function explicarGraficoRazao(c: GraficoRazaoCtx, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const info = infoIndicador(c.indicador)
  const tela = c.tela ?? info.tela
  const hoje = c.hoje ?? new Date()
  const responsavel = c.responsavel?.trim() || null
  const dia = c.granularidade === 'dia' && c.mesDia != null

  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
    ...(info.temArea ? [{ rotulo: 'Área', valor: c.area ?? 'Todas' }] : []),
    ...(responsavel ? [{ rotulo: 'Responsável', valor: responsavel }] : []),
  ]

  const comum = {
    ano: c.ano,
    indicador: c.indicador,
    tela,
    area: c.area ?? null,
    responsavel,
    hoje,
  }

  const explicarPonto = (p: EvolucaoPontoFenix): FenixExplicacao | null => {
    const v = p.valor
    const valor = v == null ? '—' : pct(v)
    const meta = metaDaLinha(c.data, c.metaFixa) ?? p.meta ?? undefined
    if (c.periodoCurto) {
      return explicarRazao({
        ...comum,
        escopo: 'periodo',
        mesFiltro: c.mesFiltro,
        origem: 'periodo_curto',
        ok: c.periodoCurto.ok,
        total: c.periodoCurto.total,
        pct: v,
        valor,
        meta,
      })
    }
    if (dia) {
      if (responsavel) {
        return explicarRazao({ ...comum, escopo: 'mes', mes: c.mesDia!, dia: p.mes, ok: 0, total: 0, pct: v, valor, meta, semContagem: SEM_CONTAGEM_RESPONSAVEL })
      }
      const d = c.dias?.find((x) => x.dia === p.mes)
      if (!d) return null
      return d.ok != null
        ? explicarRazao({ ...comum, escopo: 'mes', mes: c.mesDia!, dia: p.mes, ok: d.ok, total: d.total, pct: v, valor, meta })
        : explicarRazao({ ...comum, escopo: 'mes', mes: c.mesDia!, dia: p.mes, ok: 0, total: d.total, pct: v, valor, meta, semNumerador: true })
    }
    if (responsavel) {
      return explicarRazao({ ...comum, escopo: 'mes', mes: p.mes, ok: 0, total: 0, pct: v, valor, meta, semContagem: SEM_CONTAGEM_RESPONSAVEL })
    }
    const m = c.meses?.find((x) => x.mes === p.mes)
    if (!m) return null
    return explicarRazao({ ...comum, escopo: 'mes', mes: p.mes, ok: m.ok, total: m.total, pct: v, valor, meta: meta ?? m.meta ?? undefined })
  }

  return explicarGraficoEvolucao(
    {
      tela,
      titulo: c.titulo,
      ano: c.ano,
      granularidade: c.granularidade,
      mesDia: c.mesDia,
      data: c.data,
      metaFixa: c.metaFixa,
      resumo: dia
        ? `${info.nome} dia a dia em ${MESES_EFICIENCIA[c.mesDia! - 1]}/${c.ano}${responsavel ? `, só de ${responsavel}` : ''}.`
        : c.periodoCurto
          ? `${info.nome} do período do filtro, num ponto só.`
          : `${info.nome} mês a mês${responsavel ? `, só de ${responsavel}` : ''}.`,
      formula: info.formula,
      regras: [
        ...info.regras,
        ...(responsavel && info.pessoa
          ? [`Com filtro de responsável, entram só os itens em que ${info.pessoa} é ${responsavel}.`]
          : []),
      ],
      fonte: info.fonte,
      fonteTecnica: info.fonteTecnica,
      filtros,
      detalhe: 'Para ver item a item, feche o Fênix e clique em "Racional" no gráfico.',
      explicarPonto,
    },
    ponto,
  )
}

// ---------------------------------------------------------------------------
// Razão simples (Operações Legais › Financeiro e Efetividade na Cobrança)
// ---------------------------------------------------------------------------

export type GraficoRazaoSimplesTipo = 'antecipacao' | 'efetividade' | 'fechamento'

const SIMPLES: Record<
  GraficoRazaoSimplesTipo,
  { nome: string; ok: string; total: string; formula: string; regras: string[]; fonte: string; fonteTecnica: string }
> = {
  antecipacao: {
    nome: 'Antecipação de Faturamento',
    ok: 'Faturamentos no prazo',
    total: 'Faturamentos concluídos',
    formula: 'Antecipação = faturamentos concluídos no prazo ÷ faturamentos concluídos × 100',
    regras: [
      'Conta as tarefas "REALIZAR FATURAMENTO" concluídas no VIOS, pelo mês da conclusão.',
      'No prazo: concluída até a data limite. Também conta no prazo o faturamento com prazo estimado num mês anterior ao da conclusão (ex.: prazo em maio, concluído em junho).',
      'Só tarefas concluídas estão na base: faturamento ainda aberto não entra.',
    ],
    fonte: 'Tarefas concluídas exportadas do VIOS (arquivo Tarefas.csv no SharePoint da Controladoria), sincronizadas no SIOE.',
    fonteTecnica: 'Supabase › eficiencia_ops_legais_antecipacao_mensal sobre sp_tarefas',
  },
  efetividade: {
    nome: 'Efetividade na Cobrança Inicial',
    ok: 'Cobrados por WhatsApp no D+1',
    total: 'Títulos com vencimento no mês',
    formula: 'Efetividade = títulos cobrados por WhatsApp no D+1 ÷ títulos × 100',
    regras: [
      'Conta os títulos a receber do painel de Cobrança pelo mês de vencimento. Títulos de saldo parcial ficam fora.',
      'Cobrado no D+1: WhatsApp enviado entre o vencimento e o próximo dia útil (fins de semana e feriados não contam).',
    ],
    fonte: 'Painel de Cobrança do SIOE (títulos a receber do VIOS e envios de WhatsApp registrados).',
    fonteTecnica: 'view cobranca_painel (tem_whatsapp_d1) · serieMensalEfetividade (eficiencia/utils/opsEfetividadeCobranca.ts)',
  },
  fechamento: {
    nome: 'Fechamento',
    ok: 'Fechamentos no prazo',
    total: 'Fechamentos da competência',
    formula: 'Fechamento = competências fechadas no prazo ÷ competências × 100',
    regras: [
      'Competência = mês anterior ao da data limite da tarefa "ENVIO FECHAMENTO COMPLETO E DL APURADA" no VIOS (meta: 7º dia útil do mês seguinte).',
      'No prazo: tarefa concluída até a data limite. Sem conclusão conta como fora do prazo.',
      `Jun a ago/${OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE} vêm do histórico validado antes da automação; de ${MESES_EFICIENCIA[OPS_FECHAMENTO_AUTOMACAO_MES_INICIO - 1]!.toLowerCase()}/${OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE} em diante, das tarefas do VIOS.`,
    ],
    fonte: 'Tarefas do ciclo de fechamento no VIOS, sincronizadas no SIOE (e histórico manual jun–ago/2026).',
    fonteTecnica:
      'Supabase › eficiencia_ops_legais_fechamento_mensal sobre sp_tarefas_fechamento · mergeOpsFechamentoMensal (utils/opsFechamentoFinanceiro.ts)',
  },
}

function fechamentoManual(ano: number, mes: number): boolean {
  return (
    ano === OPS_FECHAMENTO_AUTOMACAO_ANO_CORTE &&
    mes < OPS_FECHAMENTO_AUTOMACAO_MES_INICIO &&
    OPS_FECHAMENTO_HISTORICO_MANUAL[ano]?.[mes] != null
  )
}

export function explicarGraficoRazaoSimples(
  c: {
    tipo: GraficoRazaoSimplesTipo
    tela: string
    titulo: string
    ano: number
    mesFiltro: MesFiltroEficiencia
    data: readonly EvolucaoPontoFenix[]
    metaFixa: number
    meses: readonly FenixMesContagem[]
    hoje?: Date
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const s = SIMPLES[c.tipo]
  const hoje = c.hoje ?? new Date()
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
  ]
  const regras = [...s.regras, `Meta: ${pct(c.metaFixa)}.`]
  return explicarGraficoEvolucao(
    {
      tela: c.tela,
      titulo: c.titulo,
      ano: c.ano,
      data: c.data,
      metaFixa: c.metaFixa,
      resumo: `${s.nome} mês a mês.`,
      formula: s.formula,
      regras,
      fonte: s.fonte,
      fonteTecnica: s.fonteTecnica,
      filtros,
      explicarPonto: (p) => {
        const m = c.meses.find((x) => x.mes === p.mes)
        if (!m) return null
        const valor = p.valor == null ? '—' : pct(p.valor)
        const manual = c.tipo === 'fechamento' && fechamentoManual(c.ano, p.mes)
        const nok = m.total - m.ok
        const conta: FenixLinha[] =
          m.total > 0
            ? [
                { rotulo: s.ok, valor: int(m.ok), numero: m.ok },
                { rotulo: s.total, valor: int(m.total), numero: m.total, operador: '÷' },
                { rotulo: s.nome, valor, numero: p.valor ?? undefined, operador: '=', tipo: 'total', detalhe: '× 100' },
                { rotulo: 'Fora do prazo / sem cobrança', valor: int(nok), numero: nok, tipo: 'info' },
              ]
            : [{ rotulo: s.total, valor: '0', numero: 0, tipo: 'info', detalhe: 'sem itens no mês' }]
        if (manual) {
          conta.push({
            rotulo: 'Origem do mês',
            valor: 'histórico manual',
            tipo: 'info',
            detalhe: 'percentual validado antes da automação; vale como 1 competência',
          })
        }
        return {
          tela: c.tela,
          titulo: s.nome,
          valor,
          resumo: `${s.nome} em ${rotuloMesAno(c.ano, p.mes)}.`,
          formula: s.formula,
          conta,
          filtros: [...filtros, { rotulo: 'Mês', valor: rotuloMesAno(c.ano, p.mes) }],
          regras,
          fonte: s.fonte,
          fonteTecnica: s.fonteTecnica,
        }
      },
    },
    ponto,
  )
}

// ---------------------------------------------------------------------------
// Gestão de PDI, Receita Bruta e Índice de Inadimplência
// ---------------------------------------------------------------------------

export type PdiMesFenix = {
  mes: number
  elegiveis: number
  aptas: number
  desvios: number
  pct_aptas: number | null
}

export function explicarGraficoGestaoPdi(
  c: {
    tela: string
    ano: number
    area: string | null
    mesFiltro: MesFiltroEficiencia
    responsavel?: string | null
    data: readonly EvolucaoPontoFenix[]
    meses: readonly PdiMesFenix[]
    hoje?: Date
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const responsavel = c.responsavel?.trim() || null
  return explicarGraficoEvolucao(
    {
      tela: c.tela,
      titulo: 'Gestão de PDI',
      ano: c.ano,
      data: c.data,
      metaFixa: EFICIENCIA_META_PDI,
      resumo: `Percentual das avaliações mensais de PDI que ficaram aptas, mês a mês${responsavel ? `, só de ${responsavel}` : ''}.`,
      formula: 'Gestão de PDI do mês = aptas ÷ (aptas + desvios) × 100',
      regras: [
        'Junho é a base do indicador: todos contam como aptos (100%).',
        'De julho em diante, apta = o progresso do PDI mudou em relação ao mês anterior, evidência de execução = "Sim" e pelo menos um 1:1 no mês.',
        'Só entra quem tem evidência, 1:1 e progresso preenchidos; um desvio só conta com o critério de apuração preenchido.',
        ...(responsavel ? ['Com filtro de pessoa, o ponto vem das avaliações dessa pessoa no mês.'] : []),
        `Meta: ${pct(EFICIENCIA_META_PDI)}.`,
      ],
      fonte: 'Planilha de Gestão de PDI (SharePoint): aba Elegíveis e aba de desvios.',
      fonteTecnica: 'Supabase › eficiencia_gestao_pdi_mensal (eficiencia_gestao_pdi_avaliacao)',
      filtros: [
        { rotulo: 'Ano', valor: String(c.ano) },
        { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
        { rotulo: 'Área', valor: c.area ?? 'Todas' },
        ...(responsavel ? [{ rotulo: 'Pessoa', valor: responsavel }] : []),
      ],
      explicarPonto: (p) => {
        if (responsavel) return null
        const m = c.meses.find((x) => x.mes === p.mes)
        if (!m) return null
        return explicarGestaoPdiPeriodo({
          tela: c.tela,
          ano: c.ano,
          area: c.area,
          periodo: rotuloMesAno(c.ano, m.mes),
          meses: [m],
          pct: m.pct_aptas,
          aptas: m.aptas,
          desvios: m.desvios,
          pessoa: null,
        })
      },
    },
    ponto,
  )
}

export function explicarGraficoReceitaBruta(
  c: {
    tela: string
    ano: number
    mesFiltro: MesFiltroEficiencia
    data: readonly EvolucaoPontoFenix[]
    meses: readonly GestaoVistaMesRow[]
    rows: readonly ReceitaMesRow[]
    metaFixa: number
    hoje?: Date
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  return explicarGraficoEvolucao(
    {
      tela: c.tela,
      titulo: 'Receita Bruta',
      ano: c.ano,
      data: c.data,
      metaFixa: c.metaFixa,
      resumo: 'Recebido de cada mês dividido pela meta ajustada do mês, de junho em diante.',
      formula: 'Receita Bruta do mês = recebido do mês ÷ meta ajustada do mês × 100',
      regras: [
        'Recebido: honorários da cota que entraram no caixa, pela data de pagamento e sem encargos.',
        'A meta de cada mês é a meta ajustada da Receita: a meta original mais a parte do que faltou nos meses já fechados.',
        'O mês em andamento entra com o que foi pago até hoje.',
        `Meta: ${pct(c.metaFixa)}.`,
      ],
      fonte: 'Financeiro do VIOS (títulos a receber) e Configurações da Receita (meta mensal).',
      fonteTecnica: 'buildGestaoVistaConsolidado (receita/utils/receitaGestaoVista.ts) · receita_totais_mensais',
      filtros: [
        { rotulo: 'Ano', valor: String(c.ano) },
        { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
      ],
      explicarPonto: (p) => {
        const m = c.meses.find((x) => x.mes === p.mes)
        if (!m) return null
        return explicarReceitaBrutaPct({
          ano: c.ano,
          escopo: 'periodo',
          pct: m.pctMeta,
          recebido: m.recebido,
          meta: m.meta,
          modo: 'mes',
          mesesConta: [m.mes],
          meses: c.meses,
          rows: c.rows,
          periodo: rotuloMesAno(c.ano, m.mes),
          hoje,
        })
      },
    },
    ponto,
  )
}

export function explicarGraficoInadimplencia(
  c: {
    tela: string
    ano: number
    mesFiltro: MesFiltroEficiencia
    data: readonly EvolucaoPontoFenix[]
    meses: readonly GestaoVistaMesRow[]
    hoje?: Date
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const regras = [
    'Cada ponto é a foto do mês: saldo inadimplente dos títulos do mês ÷ previsto do mês, congelado no fechamento. O mês em andamento ainda é recalculado.',
    'Os cards usam o saldo de hoje (ao vivo), por isso podem ser diferentes dos pontos.',
    'Só de junho em diante.',
    `Meta: no máximo ${pct(EFICIENCIA_META_INDICE_INADIMPLENCIA)} (menor é melhor). Este gráfico não desenha a linha de meta.`,
  ]
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
  ]
  const fonte = 'Financeiro do VIOS (títulos a receber vencidos e não pagos) e previsto da Receita.'
  const fonteTecnica =
    'receita_inadimplencia_dashboard (evolução mensal congelada) · buildGestaoVistaConsolidado (inadimplencia, inadimplenciaPct)'
  return explicarGraficoEvolucao(
    {
      tela: c.tela,
      titulo: 'Índice de Inadimplência',
      ano: c.ano,
      data: c.data,
      menorEhMelhor: true,
      resumo: 'Índice de inadimplência de cada mês, como ficou no fechamento.',
      formula: 'Índice do mês = saldo inadimplente do mês ÷ previsto do mês × 100',
      regras,
      fonte,
      fonteTecnica,
      filtros,
      explicarPonto: (p) => {
        const m = c.meses.find((x) => x.mes === p.mes)
        if (!m || m.inadimplenciaPct == null) return null
        const valor = pct(m.inadimplenciaPct)
        return {
          tela: c.tela,
          titulo: 'Índice de Inadimplência',
          valor,
          resumo: `Quanto do previsto de ${rotuloMesAno(c.ano, m.mes)} estava vencido e não pago ${m.congelado ? 'no fechamento do mês' : 'hoje (mês ainda aberto)'}.`,
          formula: 'Índice do mês = saldo inadimplente do mês ÷ previsto do mês × 100',
          conta: [
            {
              rotulo: m.congelado ? 'Saldo inadimplente no fechamento' : 'Saldo inadimplente (mês aberto)',
              valor: moeda(m.inadimplencia ?? 0),
              numero: m.inadimplencia ?? 0,
            },
            {
              rotulo: 'Índice do mês',
              valor,
              numero: m.inadimplenciaPct,
              tipo: 'total',
              detalhe: 'saldo ÷ previsto do mês × 100, já calculado na evolução da Receita',
            },
            {
              rotulo: 'Meta',
              valor: `máx. ${pct(EFICIENCIA_META_INDICE_INADIMPLENCIA)}`,
              numero: EFICIENCIA_META_INDICE_INADIMPLENCIA,
              tipo: 'info',
              detalhe: m.inadimplenciaPct <= EFICIENCIA_META_INDICE_INADIMPLENCIA ? 'dentro da meta' : 'acima da meta',
            },
          ],
          filtros: [...filtros, { rotulo: 'Mês', valor: rotuloMesAno(c.ano, m.mes) }],
          regras,
          fonte,
          fonteTecnica,
        }
      },
    },
    ponto,
  )
}

// ---------------------------------------------------------------------------
// Rankings de desvio (barras)
// ---------------------------------------------------------------------------

/** Barra do ranking como o gráfico mostra. */
export type RankingBarraFenix = {
  /** Nome no eixo (já resolvido). */
  rotulo: string
  /** Valor da barra (o `valueKey` do gráfico). */
  valor: number
  /** Valor como o rótulo da barra mostra. */
  valorTexto: string
  posicao: number
  /** Quantidade de desvios da barra. */
  qtd: number
  /** % do total do tooltip (pct_do_total), quando o gráfico mostra. */
  pctDoTotal: number | null
}

export type RankingDimensao = 'responsavel' | 'grupo' | 'tipo' | 'justificativa'

export type RankingFenixCtx = {
  tela: string
  /** Título do gráfico. */
  titulo: string
  ano: number
  area: string | null
  mesFiltro: MesFiltroEficiencia
  responsavel?: string | null
  /** O que cada barra conta (ex.: "FATAL"). */
  oQue: string
  dimensao: RankingDimensao
  /** Quem é a "pessoa" do ranking por responsável (ex.: "quem concluiu a tarefa"). */
  pessoa?: string
  /** Todas as barras (mesma ordem do gráfico). */
  barras: readonly RankingBarraFenix[]
  regras: readonly string[]
  fonte: string
  fonteTecnica: string
  hoje?: Date
}

const DIMENSAO_TEXTO: Record<RankingDimensao, string> = {
  responsavel: 'responsável',
  grupo: 'grupo cliente',
  tipo: 'tipo',
  justificativa: 'justificativa',
}

const REGRA_RANKING_MESES =
  'O ranking usa os meses do filtro. Com filtro de semana ou de dias, entram os meses inteiros que o intervalo toca.'

function explicarRankingBruto(c: RankingFenixCtx, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const responsavel = c.responsavel?.trim() || null
  const totalQtd = c.barras.reduce((s, b) => s + b.qtd, 0)
  const filtros: FenixFiltro[] = [
    { rotulo: 'Ano', valor: String(c.ano) },
    { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
    { rotulo: 'Área', valor: c.area ?? 'Todas' },
    { rotulo: 'Agrupado por', valor: DIMENSAO_TEXTO[c.dimensao] },
    ...(responsavel && c.dimensao === 'responsavel' ? [{ rotulo: 'Responsável', valor: responsavel }] : []),
  ]
  const regras = [
    ...c.regras,
    ...(c.dimensao === 'responsavel' && c.pessoa ? [`Responsável = ${c.pessoa}.`] : []),
    '% do total = desvios da barra ÷ todos os desvios do ranking × 100.',
    ...(responsavel && c.dimensao === 'responsavel'
      ? ['Com filtro de responsável, o ranking mostra só essa pessoa e o % do total vira 100%.']
      : []),
    REGRA_RANKING_MESES,
  ]

  const b = ponto ? c.barras[ponto.indice] : undefined
  if (b) {
    const pctCalc = totalQtd > 0 ? (b.qtd / totalQtd) * 100 : 0
    const pctTela = b.pctDoTotal ?? pctCalc
    const conta: FenixLinha[] = [
      { rotulo: `${c.oQue} de ${b.rotulo}`, valor: int(b.qtd), numero: b.qtd },
      { rotulo: `${c.oQue} no ranking (todas as barras)`, valor: int(totalQtd), numero: totalQtd, operador: '÷' },
      { rotulo: '% do total', valor: pct(pctTela), numero: pctTela, operador: '=', tipo: 'total', detalhe: '× 100' },
      {
        rotulo: 'Posição',
        valor: `${b.posicao}º de ${c.barras.length}`,
        numero: b.posicao,
        tipo: 'info',
        detalhe: 'ranking do maior para o menor',
      },
    ]
    if (b.pctDoTotal != null && Math.abs(b.pctDoTotal - pctCalc) >= 0.01) {
      conta.push({
        rotulo: 'Conta com as barras da tela',
        valor: pct(pctCalc),
        numero: pctCalc,
        tipo: 'info',
        detalhe: 'o % do tooltip veio calculado sobre outra base (ex.: filtro de responsável)',
      })
    }
    return {
      tela: c.tela,
      titulo: `${c.titulo} · ${b.rotulo}`,
      valor: b.valorTexto,
      resumo: `${c.oQue} de ${b.rotulo} no período e o peso no total de ${c.oQue.toLowerCase()} do ranking.`,
      formula: `% do total = ${c.oQue} de ${b.rotulo} ÷ ${c.oQue} de todas as barras × 100`,
      conta,
      filtros: [...filtros, { rotulo: 'Barra', valor: b.rotulo }],
      regras,
      fonte: c.fonte,
      fonteTecnica: c.fonteTecnica,
      detalhe: 'Para ver item a item, feche o Fênix e clique em "Racional" no gráfico.',
    }
  }

  const conta: FenixLinha[] = c.barras.map((x, i) => ({
    rotulo: x.rotulo,
    valor: int(x.qtd),
    numero: x.qtd,
    operador: i === 0 ? undefined : '+',
    detalhe: x.pctDoTotal != null ? `${pct(x.pctDoTotal)} do total` : undefined,
  }))
  conta.push({ rotulo: `${c.oQue} no ranking`, valor: int(totalQtd), numero: totalQtd, operador: c.barras.length > 0 ? '=' : undefined, tipo: 'total' })
  return {
    tela: c.tela,
    titulo: c.titulo,
    valor: `${c.barras.length} ${c.barras.length === 1 ? 'barra' : 'barras'}`,
    resumo: `${c.oQue} do período agrupados por ${DIMENSAO_TEXTO[c.dimensao]}, do maior para o menor.`,
    formula: `% do total = ${c.oQue} da barra ÷ ${c.oQue} de todas as barras × 100`,
    conta,
    filtros,
    regras,
    fonte: c.fonte,
    fonteTecnica: c.fonteTecnica,
    detalhe: 'Para ver item a item, feche o Fênix e clique em "Racional" no gráfico.',
  }
}

// ---------------------------------------------------------------------------
// Operações Legais › Overview, visão "Gráfico de linha" (mini-linhas)
// ---------------------------------------------------------------------------

export type SerieUnificadaFenix = {
  titulo: string
  metaLabel: string
  yKind: 'pct' | 'horas' | 'numero'
  meta: number
  /** Pontos como a mini-linha desenha (mesmo índice do mouse). */
  pontos: readonly { label: string; valor: number | null; rotulo?: string }[]
}

function formatarY(kind: SerieUnificadaFenix['yKind'], v: number): string {
  if (kind === 'horas') return horasMinutos(v)
  if (kind === 'numero') return String(Math.round(v))
  return pct(v)
}

/**
 * Mini-linha do Overview de Operações Legais. `explicarPonto` recebe o índice do ponto
 * e devolve a explicação do mês (a mesma da célula do Overview); sem ela, ou sem ponto,
 * explica a série inteira.
 */
function explicarSerieUnificadaBruto(
  c: {
    tela: string
    ano: number
    mesFiltro: MesFiltroEficiencia
    serie: SerieUnificadaFenix
    resumo: string
    regras?: readonly string[]
    fonte?: string
    fonteTecnica?: string
    explicarPonto?: (indice: number) => FenixExplicacao | null | undefined
    hoje?: Date
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const hoje = c.hoje ?? new Date()
  const s = c.serie
  const p = ponto ? s.pontos[ponto.indice] : undefined
  const texto = (x: { valor: number | null; rotulo?: string }) =>
    x.valor == null ? '—' : (x.rotulo ?? formatarY(s.yKind, x.valor))
  const atingiuMeta = (v: number) => v >= s.meta
  if (p && ponto) {
    const base = c.explicarPonto?.(ponto.indice)
    if (base) {
      return comoPontoDoGrafico(base, {
        tela: c.tela,
        grafico: s.titulo,
        rotulo: p.label,
        valor: texto(p),
        meta:
          Number.isFinite(s.meta) && s.meta > 0
            ? { texto: s.metaLabel, numero: s.meta, atingiu: p.valor == null ? null : atingiuMeta(p.valor) }
            : null,
      })
    }
  }
  const conta: FenixLinha[] = s.pontos
    .filter((x) => x.valor != null)
    .map((x) => ({
      rotulo: x.label,
      valor: texto(x),
      numero: x.valor ?? undefined,
      tipo: 'info' as const,
    }))
  conta.push({ rotulo: 'Meta (linha tracejada)', valor: s.metaLabel, numero: s.meta, tipo: 'info' })
  return {
    tela: c.tela,
    titulo: `${s.titulo} · gráfico de linha`,
    valor: p ? texto(p) : `${conta.length - 1} ${conta.length - 1 === 1 ? 'ponto' : 'pontos'}`,
    resumo: c.resumo,
    conta,
    filtros: [
      { rotulo: 'Ano', valor: String(c.ano) },
      { rotulo: 'Período', valor: descreverFiltroMes(c.ano, c.mesFiltro, hoje) },
      ...(p ? [{ rotulo: 'Ponto', valor: p.label }] : []),
    ],
    regras: [...(c.regras ?? [])],
    fonte: c.fonte,
    fonteTecnica: c.fonteTecnica,
    detalhe: 'A visão em tabela mostra os mesmos números com o Acum.; o botão "Racional" de cada linha lista item a item.',
  }
}

/** Ponto da linha de Desenvolvimento Contínuo: horas acumuladas até o mês. */
function explicarDesenvolvimentoAcumuladoNoMesBruto(c: {
  tela: string
  ano: number
  /** Mês do ponto. */
  mes: number
  /** Minutos de cada mês somado até o ponto (só os meses do gráfico com dado). */
  parcelas: readonly { mes: number; minutos: number }[]
  metaMinutos: number
  metaLabel: string
}): FenixExplicacao {
  const parcelas = [...c.parcelas].sort((a, b) => a.mes - b.mes)
  const acumulado = parcelas.reduce((s, x) => s + x.minutos, 0)
  const conta: FenixLinha[] = parcelas.map((x, i) => ({
    rotulo: rotuloMesAno(c.ano, x.mes),
    valor: horasMinutos(x.minutos),
    numero: x.minutos,
    operador: i === 0 ? undefined : '+',
  }))
  conta.push({ rotulo: `Horas acumuladas até ${rotuloMesAno(c.ano, c.mes)}`, valor: horasMinutos(acumulado), numero: acumulado, operador: parcelas.length > 0 ? '=' : undefined, tipo: 'total' })
  if (c.metaMinutos > 0) {
    conta.push({
      rotulo: 'Meta do ano',
      valor: horasMinutos(c.metaMinutos),
      numero: c.metaMinutos,
      tipo: 'info',
      detalhe: `acumulado = ${pct((acumulado / c.metaMinutos) * 100)} da meta`,
    })
  }
  return {
    tela: c.tela,
    titulo: 'Desenvolvimento Contínuo',
    valor: horasMinutos(acumulado),
    resumo: `Horas de treinamento de Operações Legais somadas desde o primeiro mês do gráfico até ${rotuloMesAno(c.ano, c.mes)}.`,
    formula: 'Ponto = soma das horas lançadas nos meses até o ponto',
    conta,
    filtros: [{ rotulo: 'Ano', valor: String(c.ano) }, { rotulo: 'Área', valor: 'Operações Legais' }],
    regras: [
      'A linha é acumulada: cada ponto soma as horas dos meses anteriores do gráfico.',
      'Horas da lista de presença dos treinamentos de quem continua ativo no fim do ano; cargos de gestão ficam fora.',
      `Meta: ${c.metaLabel}.`,
    ],
    fonte: 'Lista de presença dos treinamentos (SharePoint) e base de colaboradores, sincronizadas no SIOE.',
    fonteTecnica: 'Supabase › eficiencia_treinamentos_mensal (área Operações Legais)',
  }
}

/** Ponto da linha de Iniciativas Estratégicas: entregas acumuladas no ano até o mês. */
function explicarIniciativasAcumuladoNoMesBruto(c: {
  tela: string
  ano: number
  mes: number
  /** Entregas de cada mês de janeiro até o mês do ponto. */
  meses: readonly { mes: number; qtd: number }[]
  meta: number
}): FenixExplicacao {
  const meses = c.meses.filter((m) => m.mes <= c.mes && m.qtd > 0).sort((a, b) => a.mes - b.mes)
  const ytd = meses.reduce((s, m) => s + m.qtd, 0)
  const conta: FenixLinha[] = meses.map((m, i) => ({
    rotulo: rotuloMesAno(c.ano, m.mes),
    valor: int(m.qtd),
    numero: m.qtd,
    operador: i === 0 ? undefined : '+',
  }))
  conta.push({ rotulo: `Entregas de jan até ${rotuloMesAno(c.ano, c.mes)}`, valor: int(ytd), numero: ytd, operador: meses.length > 0 ? '=' : undefined, tipo: 'total' })
  conta.push({ rotulo: 'Meta do ano', valor: int(c.meta), numero: c.meta, tipo: 'info', detalhe: `${pct((ytd / c.meta) * 100)} da meta` })
  return {
    tela: c.tela,
    titulo: 'Iniciativas Estratégicas',
    valor: String(ytd),
    resumo: `Projetos e melhorias do FORJAI entregues no ano até ${rotuloMesAno(c.ano, c.mes)}.`,
    formula: 'Ponto = entregas acumuladas no ano até o mês',
    conta,
    filtros: [{ rotulo: 'Ano', valor: String(c.ano) }],
    regras: [
      'A linha é acumulada desde janeiro, mesmo com filtro de meses.',
      'Entrega = projeto ou melhoria do FORJAI com data de conclusão (sem ela, a data de produção quando o estágio conta como entrega).',
      `Meta: ${c.meta} entregas no ano.`,
    ],
    fonte: 'FORJAI (projetos de melhoria do SIOE).',
    fonteTecnica: 'Edge function ops-legais-iniciativas · OperacoesLegaisOverviewTab (iniciativasPorMes)',
  }
}

// ---------------------------------------------------------------------------
// Rankings das abas do Jurídico: o que cada barra conta
// ---------------------------------------------------------------------------

export type RankingIndicador =
  | 'sla_protocolo'
  | 'eficiencia_protocolo'
  | 'sla_ciencia_agendamentos'
  | 'sla_vistagem_risco'
  | 'sla_vistagem_normal'

const ONBOARDING_RANKING = 'Clientes em onboarding ficam fora durante a vigência da exclusão, como no card.'

function contextoRanking(
  indicador: RankingIndicador,
  dimensao: RankingDimensao,
): Pick<RankingFenixCtx, 'oQue' | 'pessoa' | 'regras' | 'fonteTecnica'> {
  const semGrupo = 'Grupo cliente vazio aparece como "(sem grupo)".'
  if (indicador === 'sla_protocolo') {
    return {
      oQue: 'FATAL',
      pessoa: 'quem concluiu a tarefa',
      regras: [
        'Conta os prazos de protocolo FATAL (concluídos no dia do prazo depois de 18h05, ou depois do dia do prazo) sem justificativa excludente, pela data da conclusão.',
        'Mesmas exclusões do card: Operações Legais, Tributário, material de marketing e due diligence de prospect.',
        ONBOARDING_RANKING,
        ...(dimensao === 'justificativa' ? ['Justificativa de fatal informada na tarefa; vazia aparece como "Sem Justificativa".'] : []),
        ...(dimensao === 'grupo' ? [semGrupo] : []),
        ...(dimensao === 'responsavel' ? ['Tarefa sem usuário de conclusão fica fora do ranking por responsável.'] : []),
        'O ranking conta linhas de tarefa; o card FATAL conta prazos (CI) distintos.',
      ],
      fonteTecnica:
        dimensao === 'justificativa'
          ? 'Supabase › eficiencia_sla_protocolo_justificativa_fatal sobre sp_tarefas_historico'
          : dimensao === 'grupo'
            ? 'Supabase › eficiencia_sla_protocolo_ranking_fatal_grupo sobre sp_tarefas_historico'
            : 'Supabase › eficiencia_sla_protocolo_ranking_fatal sobre sp_tarefas_historico',
    }
  }
  if (indicador === 'eficiencia_protocolo') {
    return {
      oQue: 'Inconsistências',
      pessoa: 'quem criou o pedido de protocolo',
      regras: [
        'Conta os pedidos de protocolo com "Inconsistência - Jurídico" preenchida, pela data de criação do pedido.',
        'Mesmas exclusões do card: Operações Legais e Tributário.',
        ONBOARDING_RANKING,
        ...(dimensao === 'tipo' ? ['Tipo = texto do campo "Inconsistência - Jurídico"; vazio aparece como "(sem tipo)".'] : []),
        ...(dimensao === 'grupo' ? ['Grupo cliente pelo cliente do pedido, no cadastro de grupos da Receita. ' + semGrupo] : []),
        ...(dimensao === 'responsavel' ? ['Pedido sem "Criado por" fica fora do ranking por responsável.'] : []),
      ],
      fonteTecnica:
        dimensao === 'tipo'
          ? 'Supabase › eficiencia_protocolo_ranking_inconsistencia_tipo sobre sp_protocolos'
          : dimensao === 'grupo'
            ? 'Supabase › eficiencia_protocolo_ranking_inconsistencia_grupo sobre sp_protocolos'
            : 'Supabase › eficiencia_protocolo_ranking_inconsistencia sobre sp_protocolos',
    }
  }
  if (indicador === 'sla_ciencia_agendamentos') {
    return {
      oQue: 'Fora do prazo',
      pessoa: 'quem concluiu a tarefa',
      regras: [
        'Conta as tarefas "1. CIÊNCIA DOS AGENDAMENTOS" concluídas fora do prazo (depois do próximo dia útil após a data do prazo), pela data de conclusão.',
        'Mesmas exclusões do card: Tributário.',
        ONBOARDING_RANKING,
        ...(dimensao === 'responsavel'
          ? ['Na visão por responsável, o % do total é calculado na tela: fora do prazo da pessoa ÷ soma do fora do prazo das pessoas listadas. Tarefa sem usuário de conclusão fica fora.']
          : [semGrupo]),
      ],
      fonteTecnica:
        dimensao === 'grupo'
          ? 'Supabase › eficiencia_agendamento_por_grupo sobre sp_tarefas'
          : 'Supabase › eficiencia_agendamento_por_usuario sobre sp_tarefas (fora_prazo) · AgendamentoTab',
    }
  }
  const risco = indicador === 'sla_vistagem_risco'
  return {
    oQue: 'Desvios',
    pessoa: 'quem vistou a publicação',
    regras: [
      'Desvio = publicação vistada que não foi vistada até 12h do próximo dia útil depois da disponibilização, pela data de disponibilização.',
      risco
        ? 'Demanda de risco: "Demanda de Risco" diferente de "Não". Operações Legais fica fora.'
        : 'Demanda comum: "Demanda de Risco" = "Não". Trabalhista, Distressed Deals, Operações Legais e Tributário ficam fora.',
      ONBOARDING_RANKING,
      'Diferença para o card: aqui entram também publicações com "Vistado por" preenchido mas sem data de vistagem; no card elas não entram.',
      ...(dimensao === 'tipo' ? ['Tipo = tipo do agendamento da publicação; nomes iguais com grafias diferentes são somados.'] : []),
      ...(dimensao === 'grupo' ? [semGrupo] : []),
    ],
    fonteTecnica:
      dimensao === 'tipo'
        ? 'Supabase › eficiencia_sla_vistagem_desvio_por_tipo (eficiencia_sla_vistagem_desvio_base) · aggregateRankingPorTipoPublicacao'
        : dimensao === 'grupo'
          ? 'Supabase › eficiencia_sla_vistagem_desvio_por_grupo (eficiencia_sla_vistagem_desvio_base)'
          : 'Supabase › eficiencia_sla_vistagem_desvio_por_usuario (eficiencia_sla_vistagem_desvio_base)',
  }
}

/** Ranking de uma aba do Jurídico: regras do indicador + a barra sob o mouse. */
export function explicarRankingIndicador(
  c: {
    indicador: RankingIndicador
    dimensao: RankingDimensao
    titulo: string
    ano: number
    area: string | null
    mesFiltro: MesFiltroEficiencia
    responsavel?: string | null
    barras: readonly RankingBarraFenix[]
    hoje?: Date
  },
  ponto: FenixPontoGrafico | null,
): FenixExplicacao {
  const info = infoIndicador(c.indicador)
  return explicarRanking(
    {
      tela: info.tela,
      titulo: c.titulo,
      ano: c.ano,
      area: c.area,
      mesFiltro: c.mesFiltro,
      responsavel: c.responsavel,
      dimensao: c.dimensao,
      barras: c.barras,
      fonte: info.fonte,
      hoje: c.hoje,
      ...contextoRanking(c.indicador, c.dimensao),
    },
    ponto,
  )
}
