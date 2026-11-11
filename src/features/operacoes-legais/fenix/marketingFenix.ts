/**
 * Fênix em Operações legais › Marketing: indicadores do período (aba Desempenho).
 *
 * Funções puras. Recebem os mesmos valores que o card mostra, então a explicação
 * sempre fecha com o número da tela.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixFiltro, FenixLinha } from '../../../shared/fenix/fenix.types.ts'
import {
  MARKETING_ENGAGEMENT_GOAL,
  MARKETING_POSTS_MONTHLY_GOAL,
  MARKETING_REACH_MONTHLY_GOAL,
} from '../marketing/instagramAnalytics.ts'
import { MARKETING_PAUTA_TASK } from '../marketing/marketingPautas.ts'
import type { InstagramPeriodRange } from '../marketing/types.ts'

const TELA = 'Operações legais › Marketing'

/** Mesmos formatos dos cards (MarketingOverview). */
const numero = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v))
const compacto = (v: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
const taxa = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
const pautasFmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: Number.isInteger(v) ? 0 : 1 })
const pct1 = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function dataUtc(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

/** Ex.: "01/10/2026 a 31/10/2026"; sem datas = todo o histórico. */
export function rotuloPeriodoMarketing(range: InstagramPeriodRange): string {
  if (!range.from || !range.to) return 'todo o histórico'
  return `${dataUtc(range.from)} a ${dataUtc(range.to)}`
}

export type MarketingFenixContexto = {
  /** Período escolhido no seletor. */
  range: InstagramPeriodRange
  /** Período usado na meta (sem filtro de data = do primeiro ao último post). */
  rangeMeta: InstagramPeriodRange
  /** Rótulo do período anterior, como no cabeçalho ("Comparando com …"). */
  comparacao: string
}

export function filtrosMarketing(c: MarketingFenixContexto): FenixFiltro[] {
  return [
    { rotulo: 'Período', valor: rotuloPeriodoMarketing(c.range) },
    { rotulo: 'Comparação', valor: c.comparacao },
    { rotulo: 'Conta', valor: '@bismarchipires' },
  ]
}

function variacaoLinha(variacao: number | null, comparacao: string): FenixLinha {
  return {
    rotulo: 'Variação vs período anterior',
    valor:
      variacao == null
        ? 'sem base anterior'
        : Math.abs(variacao) < 0.01
          ? 'estável'
          : `${variacao > 0 ? '+' : '−'}${pct1(Math.abs(variacao))}`,
    numero: variacao ?? undefined,
    tipo: 'info',
    detalhe: variacao == null ? `não houve dado em ${comparacao}` : '(atual − anterior) ÷ anterior × 100',
  }
}

function progressoLinha(valor: number, meta: number, formatar: (v: number) => string): FenixLinha[] {
  const pct = meta > 0 ? (valor / meta) * 100 : 0
  return [
    { rotulo: 'Meta do período', valor: formatar(meta), numero: meta, operador: '÷' },
    {
      rotulo: 'Progresso da meta',
      valor: pct1(pct),
      numero: pct,
      operador: '=',
      tipo: 'total',
      detalhe: pct > 100 ? '× 100; a barra do card para em 100%' : '× 100 (é o tamanho da barra do card)',
    },
  ]
}

/** Quantos "meses" de meta o período vale (meses inteiros ou dias ÷ 30,44). */
function unidadesMeta(meta: number, porMes: number): string {
  const u = meta / porMes
  return Number.isInteger(u)
    ? `${u} ${u === 1 ? 'mês' : 'meses'}`
    : `${u.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mês (dias do período ÷ 30,44)`
}

export const REGRA_POSTS =
  'Entram as publicações do feed do Instagram (posts, carrosséis, vídeos e reels) com data de publicação dentro do período. Stories ficam fora.'

/** Sem filtro de data, a meta vale do primeiro ao último post publicado. */
function regraMetaSemData(c: MarketingFenixContexto): string[] {
  if (c.range.from && c.range.to) return []
  return [
    c.rangeMeta.from && c.rangeMeta.to
      ? `Sem filtro de data, a meta conta do primeiro ao último post publicado (${rotuloPeriodoMarketing(c.rangeMeta)}).`
      : 'Sem filtro de data e sem posts com data, a meta vale um mês.',
  ]
}

const REGRA_COMPARACAO =
  'A comparação usa o período imediatamente anterior, com o mesmo número de dias.'

export const REGRA_SINCRONIA = 'Os números de cada post são os da última sincronização com o Instagram.'

export const FONTE_INSTAGRAM = 'Instagram do escritório (@bismarchipires), sincronizado no SIOE.'

export function explicarMarketingAlcance(
  c: MarketingFenixContexto,
  i: { valor: number; posts: number; meta: number; anterior: number; variacao: number | null },
): FenixExplicacao {
  return {
    tela: TELA,
    titulo: 'Alcance',
    valor: compacto(i.valor),
    resumo: `Soma do alcance dos ${numero(i.posts)} posts publicados no período, comparada com a meta de ${compacto(MARKETING_REACH_MONTHLY_GOAL)} por mês.`,
    formula: 'Alcance = soma do alcance de cada post do período',
    conta: [
      {
        rotulo: `Alcance somado de ${numero(i.posts)} ${i.posts === 1 ? 'post' : 'posts'}`,
        valor: numero(i.valor),
        numero: i.valor,
        detalhe: `no card: ${compacto(i.valor)}`,
      },
      ...progressoLinha(i.valor, i.meta, numero),
      {
        rotulo: 'Meta usada',
        valor: numero(i.meta),
        numero: i.meta,
        tipo: 'info',
        detalhe: `${numero(MARKETING_REACH_MONTHLY_GOAL)} por mês × ${unidadesMeta(i.meta, MARKETING_REACH_MONTHLY_GOAL)}`,
      },
      { rotulo: 'Período anterior', valor: numero(i.anterior), numero: i.anterior, tipo: 'info' },
      variacaoLinha(i.variacao, c.comparacao),
    ],
    filtros: filtrosMarketing(c),
    regras: [
      'Alcance de um post é o número de contas que o viram, segundo o Instagram. Na soma, a mesma pessoa conta de novo se viu posts diferentes.',
      REGRA_POSTS,
      `Meta: ${numero(MARKETING_REACH_MONTHLY_GOAL)} por mês, proporcional ao tamanho do período.`,
      ...regraMetaSemData(c),
      REGRA_COMPARACAO,
      REGRA_SINCRONIA,
    ],
    fonte: FONTE_INSTAGRAM,
    fonteTecnica: 'instagram_posts.reach · compareInstagramPeriods / computeMarketingGoals (operacoes-legais/marketing/instagramAnalytics.ts)',
    detalhe: 'A aba Postagens lista cada post com o alcance.',
  }
}

export function explicarMarketingEngajamento(
  c: MarketingFenixContexto,
  i: {
    valor: number
    interacoes: number
    alcance: number
    posts: number
    anterior: number
    variacao: number | null
  },
): FenixExplicacao {
  const meta = MARKETING_ENGAGEMENT_GOAL
  const progresso = meta > 0 ? (i.valor / meta) * 100 : 0
  return {
    tela: TELA,
    titulo: 'Engajamento',
    valor: taxa(i.valor),
    resumo: `Quantas interações os posts do período tiveram para cada 100 contas alcançadas. Meta anual: ${taxa(meta)}.`,
    formula: 'Engajamento = soma das interações ÷ soma do alcance × 100',
    conta: [
      { rotulo: `Interações de ${numero(i.posts)} ${i.posts === 1 ? 'post' : 'posts'}`, valor: numero(i.interacoes), numero: i.interacoes },
      { rotulo: 'Alcance somado', valor: numero(i.alcance), numero: i.alcance, operador: '÷' },
      { rotulo: 'Engajamento', valor: taxa(i.valor), numero: i.valor, operador: '=', tipo: 'total', detalhe: '× 100' },
      {
        rotulo: 'Progresso da meta',
        valor: pct1(progresso),
        numero: progresso,
        tipo: 'info',
        detalhe: `${taxa(i.valor)} ÷ ${taxa(meta)}${progresso > 100 ? '; a barra do card para em 100%' : ''}`,
      },
      { rotulo: 'Período anterior', valor: taxa(i.anterior), numero: i.anterior, tipo: 'info' },
      variacaoLinha(i.variacao, c.comparacao),
    ],
    filtros: filtrosMarketing(c),
    regras: [
      'Interações de cada post: o total informado pelo Instagram; quando não vem, a soma de curtidas, comentários, salvamentos e compartilhamentos.',
      'A taxa do período junta todos os posts (soma ÷ soma). Não é a média das taxas de cada post.',
      `Meta fixa de ${taxa(meta)}: não muda com o tamanho do período.`,
      REGRA_POSTS,
      REGRA_COMPARACAO,
      REGRA_SINCRONIA,
    ],
    fonte: FONTE_INSTAGRAM,
    fonteTecnica: 'instagram_posts (total_interactions, likes, comments, saves, shares, reach) · summarizeInstagram (instagramAnalytics.ts)',
    detalhe: 'O quadro Melhores publicações mostra a taxa de cada post.',
  }
}

export function explicarMarketingPostagens(
  c: MarketingFenixContexto,
  i: {
    valor: number
    meta: number
    porFormato: readonly { formato: string; posts: number }[]
    anterior: number
    variacao: number | null
  },
): FenixExplicacao {
  const parcelas: FenixLinha[] = i.porFormato
    .filter((f) => f.posts > 0)
    .map((f, idx) => ({ rotulo: f.formato, valor: numero(f.posts), numero: f.posts, operador: idx === 0 ? undefined : '+' }))
  const soma = parcelas.reduce((s, l) => s + (l.numero ?? 0), 0)
  const faltam = Math.max(0, Math.ceil(i.meta - i.valor))
  return {
    tela: TELA,
    titulo: 'Postagens',
    valor: numero(i.valor),
    resumo: `Publicações do feed no período, comparadas com a meta de ${MARKETING_POSTS_MONTHLY_GOAL} por mês.`,
    formula: 'Postagens = número de publicações do feed no período',
    conta: [
      ...parcelas,
      { rotulo: 'Publicações no período', valor: numero(i.valor), numero: i.valor, operador: '=', tipo: 'total' },
      ...(parcelas.length > 0 && soma !== i.valor
        ? [{ rotulo: 'Diferença', valor: numero(Math.abs(i.valor - soma)), numero: i.valor - soma, tipo: 'info' as const, detalhe: `os formatos somam ${numero(soma)}` }]
        : []),
      ...progressoLinha(i.valor, i.meta, pautasFmt),
      {
        rotulo: faltam > 0 ? 'Faltam para a meta' : 'Meta de postagens atingida',
        valor: numero(faltam),
        numero: faltam,
        tipo: 'info',
        detalhe: `meta: ${MARKETING_POSTS_MONTHLY_GOAL} por mês × ${unidadesMeta(i.meta, MARKETING_POSTS_MONTHLY_GOAL)}`,
      },
      { rotulo: 'Período anterior', valor: numero(i.anterior), numero: i.anterior, tipo: 'info' },
      variacaoLinha(i.variacao, c.comparacao),
    ],
    filtros: filtrosMarketing(c),
    regras: [
      REGRA_POSTS,
      `Meta: ${MARKETING_POSTS_MONTHLY_GOAL} publicações por mês, proporcional ao tamanho do período.`,
      ...regraMetaSemData(c),
      'Post colaborativo conta uma vez aqui, mesmo aparecendo em mais de uma área no ranking.',
      REGRA_COMPARACAO,
    ],
    fonte: FONTE_INSTAGRAM,
    fonteTecnica: 'instagram_posts.published_at · compareInstagramPeriods / groupPostsByFormat (instagramAnalytics.ts)',
    detalhe: 'A aba Postagens lista as publicações do período.',
  }
}

export function explicarMarketingPautas(
  c: MarketingFenixContexto,
  i: { valor: number; meta: number; anterior: number; variacao: number | null },
): FenixExplicacao {
  return {
    tela: TELA,
    titulo: 'Pautas',
    valor: pautasFmt(i.valor),
    resumo: 'Pautas de marketing entregues no período (material enviado pelo autor), comparadas com a meta de 10 por mês.',
    formula: 'Pautas = pautas não canceladas cuja tarefa principal foi concluída no período',
    conta: [
      { rotulo: 'Pautas entregues no período', valor: pautasFmt(i.valor), numero: i.valor },
      ...progressoLinha(i.valor, i.meta, pautasFmt),
      { rotulo: 'Período anterior', valor: pautasFmt(i.anterior), numero: i.anterior, tipo: 'info' },
      variacaoLinha(i.variacao, c.comparacao),
    ],
    filtros: [{ rotulo: 'Período', valor: rotuloPeriodoMarketing(c.range) }, { rotulo: 'Comparação', valor: c.comparacao }],
    regras: [
      `Cada pauta é uma tarefa "${MARKETING_PAUTA_TASK}" no VIOS. Ela conta no dia em que essa tarefa principal foi concluída, mesmo que a revisão ou o protocolo ainda estejam em andamento.`,
      'Pautas canceladas não contam.',
      'Meta: 10 por mês. Em períodos que não são meses inteiros, proporcional aos dias (arredondada a uma casa decimal).',
      ...(c.range.from && c.range.to ? [] : ['Sem filtro de data, contam todas as pautas entregues e a meta fica em 10.']),
      REGRA_COMPARACAO,
    ],
    fonte: 'Tarefas de marketing do VIOS (histórico de tarefas sincronizado no SIOE).',
    fonteTecnica: 'sp_tarefas_historico · buildMarketingPautas / compareMarketingPautaPeriods / computeMarketingPautaGoal (marketing/marketingPautas.ts)',
    detalhe: 'A aba Pautas mostra cada pauta com a etapa e o prazo.',
  }
}
