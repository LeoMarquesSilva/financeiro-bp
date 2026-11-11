/**
 * Fênix nos gráficos de Operações legais › Marketing (Desempenho e Conta & audiência).
 *
 * Funções puras. Recebem o mesmo array `data` que o gráfico desenha, então os valores
 * da explicação são os do tooltip.
 * Imports com extensão `.ts` para rodar nos testes com `node --test`.
 */
import type { FenixExplicacao, FenixLinha, FenixPontoGrafico } from '../../../shared/fenix/fenix.types.ts'
import { MARKETING_REACH_MONTHLY_GOAL } from '../marketing/instagramAnalytics.ts'
import {
  FONTE_INSTAGRAM,
  REGRA_POSTS,
  REGRA_SINCRONIA,
  filtrosMarketing,
  rotuloPeriodoMarketing,
  type MarketingFenixContexto,
} from './marketingFenix.ts'

const TELA = 'Operações legais › Marketing'

/** Formatos do tooltip padrão desses gráficos. */
const numeroTooltip = (v: number) => v.toLocaleString('pt-BR')
const taxaTooltip = (v: number) => `${v.toFixed(2)}%`
const numero = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v))
const compacto = (v: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
const pct1 = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

const REGRA_TAXA =
  'Taxa de engajamento = soma das interações ÷ soma do alcance dos posts × 100 (não é a média das taxas de cada post). Interações: o total informado pelo Instagram ou, quando não vem, curtidas + comentários + salvamentos + compartilhamentos.'

// ---------------------------------------------------------------------------
// Tendência de performance (alcance em barras, engajamento em linha)
// ---------------------------------------------------------------------------

export type TendenciaPonto = {
  label: string
  reach: number
  engagementRate: number
  posts: number
  interactions?: number
}

export type TendenciaFenixContexto = {
  contexto: MarketingFenixContexto
  /** O array `data` do gráfico (um ponto por dia ou por mês com post). */
  data: readonly TendenciaPonto[]
  /** Períodos de até 100 dias agrupam por dia; maiores, por mês. */
  agrupamento: 'dia' | 'mes'
  /** Valor da linha tracejada "Meta". */
  metaPorPonto: number
}

function regrasTendencia(c: TendenciaFenixContexto): string[] {
  return [
    c.agrupamento === 'dia'
      ? 'Um ponto por dia com publicação (períodos de até 100 dias). Dias sem post não aparecem.'
      : 'Um ponto por mês com publicação (períodos maiores que 100 dias).',
    'O alcance de cada post entra no dia (ou mês) em que ele foi publicado, mesmo que tenha sido visto depois.',
    c.agrupamento === 'dia'
      ? `Linha "Meta": ${numero(MARKETING_REACH_MONTHLY_GOAL)} por mês ÷ 30,44 dias = meta diária de alcance.`
      : `Linha "Meta": ${numero(MARKETING_REACH_MONTHLY_GOAL)} de alcance por mês.`,
    REGRA_TAXA,
    REGRA_POSTS,
    REGRA_SINCRONIA,
  ]
}

export function explicarGraficoTendencia(c: TendenciaFenixContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const p = ponto ? c.data[ponto.indice] : undefined
  const unidade = c.agrupamento === 'dia' ? 'no dia' : 'no mês'
  if (ponto && p) {
    const vsMeta = c.metaPorPonto > 0 ? (p.reach / c.metaPorPonto) * 100 : 0
    const conta: FenixLinha[] = [
      {
        rotulo: 'Alcance',
        valor: numeroTooltip(p.reach),
        numero: p.reach,
        detalhe: `soma do alcance de ${numero(p.posts)} ${p.posts === 1 ? 'post publicado' : 'posts publicados'} ${unidade}`,
      },
      {
        rotulo: 'Engajamento',
        valor: taxaTooltip(p.engagementRate),
        numero: p.engagementRate,
        detalhe:
          p.interactions != null
            ? `${numero(p.interactions)} interações ÷ ${numero(p.reach)} de alcance × 100`
            : 'interações ÷ alcance × 100',
      },
      {
        rotulo: 'Meta (linha tracejada)',
        valor: numero(c.metaPorPonto),
        numero: c.metaPorPonto,
        tipo: 'info',
        detalhe: `o alcance ${unidade} é ${pct1(vsMeta)} dela`,
      },
    ]
    return {
      tela: TELA,
      titulo: `Tendência de performance · ${p.label}`,
      valor: numeroTooltip(p.reach),
      resumo: `Alcance e taxa de engajamento dos posts publicados em ${p.label}, como no tooltip.`,
      formula: 'Engajamento = interações ÷ alcance × 100',
      conta,
      filtros: [...filtrosMarketing(c.contexto), { rotulo: 'Ponto', valor: p.label }],
      regras: regrasTendencia(c),
      fonte: FONTE_INSTAGRAM,
      fonteTecnica: `instagram_posts · ${c.agrupamento === 'dia' ? 'groupPostsByDay' : 'groupPostsByMonth'} / summarizeInstagram (marketing/instagramAnalytics.ts)`,
      detalhe: 'A aba Postagens lista cada post com alcance e interações.',
    }
  }

  const alcance = c.data.reduce((s, d) => s + d.reach, 0)
  const interacoes = c.data.reduce((s, d) => s + (d.interactions ?? 0), 0)
  const posts = c.data.reduce((s, d) => s + d.posts, 0)
  const taxa = alcance > 0 ? (interacoes / alcance) * 100 : 0
  const parcelas: FenixLinha[] =
    c.data.length <= 12
      ? c.data.map((d, i) => ({ rotulo: d.label, valor: numero(d.reach), numero: d.reach, operador: i === 0 ? undefined : '+' }))
      : []
  return {
    tela: TELA,
    titulo: 'Tendência de performance',
    valor: numero(alcance),
    resumo: `Alcance e engajamento dos posts de ${rotuloPeriodoMarketing(c.contexto.range)}, ${c.agrupamento === 'dia' ? 'dia a dia' : 'mês a mês'}. Somado, o alcance dá o card Alcance.`,
    formula: 'Alcance do período = soma do alcance de cada ponto',
    conta: [
      ...parcelas,
      {
        rotulo: `Alcance somado (${c.data.length} ${c.agrupamento === 'dia' ? (c.data.length === 1 ? 'dia' : 'dias') : c.data.length === 1 ? 'mês' : 'meses'})`,
        valor: numero(alcance),
        numero: alcance,
        operador: parcelas.length > 0 ? '=' : undefined,
        tipo: 'total',
        detalhe: `no card Alcance: ${compacto(alcance)}`,
      },
      { rotulo: 'Publicações', valor: numero(posts), numero: posts, tipo: 'info' },
      {
        rotulo: 'Engajamento do período',
        valor: taxaTooltip(taxa),
        numero: taxa,
        tipo: 'info',
        detalhe: `${numero(interacoes)} interações ÷ ${numero(alcance)} de alcance × 100`,
      },
    ],
    filtros: filtrosMarketing(c.contexto),
    regras: [...regrasTendencia(c), 'Aponte um ponto para ver aquele dia ou mês.'],
    fonte: FONTE_INSTAGRAM,
    fonteTecnica: 'instagram_posts · groupPostsByDay / groupPostsByMonth (marketing/instagramAnalytics.ts)',
  }
}

// ---------------------------------------------------------------------------
// Volume e engajamento por formato
// ---------------------------------------------------------------------------

export type FormatoPonto = { format: string; posts: number; engagementRate: number; reach?: number; interactions?: number }

export type FormatoFenixContexto = {
  contexto: MarketingFenixContexto
  /** O array `data` do gráfico (um ponto por formato). */
  data: readonly FormatoPonto[]
}

const REGRAS_FORMATO = [
  'Formato do post segundo o Instagram: Reels, Carrossel, Imagem única, Vídeo ou Publicação do feed.',
  REGRA_TAXA,
  REGRA_POSTS,
]

export function explicarGraficoFormato(c: FormatoFenixContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const totalPosts = c.data.reduce((s, d) => s + d.posts, 0)
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) {
    const share = totalPosts > 0 ? (p.posts / totalPosts) * 100 : 0
    return {
      tela: TELA,
      titulo: `Volume e engajamento por formato · ${p.format}`,
      valor: String(p.posts),
      resumo: `Quantas publicações de ${p.format} saíram no período e qual foi a taxa de engajamento delas.`,
      formula: 'Taxa de engajamento = interações ÷ alcance × 100',
      conta: [
        { rotulo: 'Publicações', valor: String(p.posts), numero: p.posts, detalhe: `${pct1(share)} das ${numero(totalPosts)} publicações do período` },
        {
          rotulo: 'Taxa de engajamento',
          valor: taxaTooltip(p.engagementRate),
          numero: p.engagementRate,
          detalhe:
            p.interactions != null && p.reach != null
              ? `${numero(p.interactions)} interações ÷ ${numero(p.reach)} de alcance × 100`
              : 'interações ÷ alcance × 100',
        },
      ],
      filtros: [...filtrosMarketing(c.contexto), { rotulo: 'Formato', valor: p.format }],
      regras: REGRAS_FORMATO,
      fonte: FONTE_INSTAGRAM,
      fonteTecnica: 'instagram_posts (media_type, media_product_type) · groupPostsByFormat / getInstagramFormat (instagramAnalytics.ts)',
    }
  }
  const parcelas: FenixLinha[] = c.data.map((d, i) => ({
    rotulo: d.format,
    valor: String(d.posts),
    numero: d.posts,
    operador: i === 0 ? undefined : '+',
  }))
  return {
    tela: TELA,
    titulo: 'Volume e engajamento por formato',
    valor: numero(totalPosts),
    resumo: 'Publicações do período separadas por formato; somadas, dão o card Postagens.',
    formula: 'Publicações = soma das publicações de cada formato',
    conta: [
      ...parcelas,
      { rotulo: 'Publicações no período', valor: numero(totalPosts), numero: totalPosts, operador: parcelas.length > 0 ? '=' : undefined, tipo: 'total' },
    ],
    filtros: filtrosMarketing(c.contexto),
    regras: [...REGRAS_FORMATO, 'Aponte a barra de um formato para ver a conta dele.'],
    fonte: FONTE_INSTAGRAM,
    fonteTecnica: 'groupPostsByFormat (marketing/instagramAnalytics.ts)',
  }
}

// ---------------------------------------------------------------------------
// Conta & audiência › Tendência da conta (métricas diárias da conta)
// ---------------------------------------------------------------------------

export type ContaPonto = {
  date: string
  reach: number
  views: number
  total_interactions: number
  accounts_engaged?: number
  likes?: number
  comments?: number
  saves?: number
  shares?: number
  replies?: number
}

export type ContaFenixContexto = {
  contexto: MarketingFenixContexto
  /** O array `data` do gráfico (um ponto por dia salvo). */
  data: readonly ContaPonto[]
}

const dataBr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR')

const REGRAS_CONTA = [
  'Números diários da conta informados pela Meta (Instagram Insights) e salvos no SIOE a cada sincronização. A API só guarda uma janela curta; os dias antigos ficam porque foram salvos.',
  'Alcance diário: contas diferentes que viram algum conteúdo da conta naquele dia, segundo a Meta. Somar dias conta a mesma pessoa de novo.',
  'Visualizações: quantas vezes o conteúdo foi exibido no dia. Interações: total do dia informado pela Meta.',
  'Só entram os dias do período escolhido; dia sem coleta não aparece.',
]

export function explicarGraficoConta(c: ContaFenixContexto, ponto: FenixPontoGrafico | null): FenixExplicacao {
  const p = ponto ? c.data[ponto.indice] : undefined
  if (ponto && p) {
    const conta: FenixLinha[] = [
      { rotulo: 'Alcance diário', valor: String(p.reach), numero: p.reach },
      { rotulo: 'Visualizações', valor: String(p.views), numero: p.views },
      { rotulo: 'Interações', valor: String(p.total_interactions), numero: p.total_interactions },
    ]
    const detalhes: [string, number | undefined][] = [
      ['Contas engajadas', p.accounts_engaged],
      ['Curtidas', p.likes],
      ['Comentários', p.comments],
      ['Salvamentos', p.saves],
      ['Compartilhamentos', p.shares],
      ['Respostas', p.replies],
    ]
    for (const [rotulo, v] of detalhes) {
      if (v == null) continue
      conta.push({ rotulo, valor: numero(v), numero: v, tipo: 'info', detalhe: 'informado pela Meta; não aparece no gráfico' })
    }
    return {
      tela: TELA,
      titulo: `Tendência da conta · ${dataBr(p.date)}`,
      valor: String(p.reach),
      resumo: `Alcance, visualizações e interações da conta em ${dataBr(p.date)}, como no tooltip.`,
      conta,
      filtros: [...filtrosMarketing(c.contexto), { rotulo: 'Dia', valor: dataBr(p.date) }],
      regras: REGRAS_CONTA,
      fonte: 'Instagram Insights da conta @bismarchipires (Meta), sincronizado no SIOE.',
      fonteTecnica: 'instagram_account_insights (date, reach, views, total_interactions) · MarketingAudience',
    }
  }
  const dias = c.data.length
  const soma = (k: 'reach' | 'views' | 'total_interactions') => c.data.reduce((s, d) => s + d[k], 0)
  const alcance = soma('reach')
  const divisor = Math.max(dias, 1)
  return {
    tela: TELA,
    titulo: 'Tendência da conta',
    valor: `${dias} ${dias === 1 ? 'dia' : 'dias'}`,
    resumo: 'Alcance, visualizações e interações da conta, dia a dia. As médias diárias dos cards de cima saem destes mesmos dias.',
    formula: 'Média por dia = soma dos dias ÷ dias armazenados',
    conta: [
      { rotulo: `Alcance somado (${dias} ${dias === 1 ? 'dia' : 'dias'})`, valor: numero(alcance), numero: alcance },
      { rotulo: 'Dias armazenados', valor: String(dias), numero: dias, operador: '÷' },
      {
        rotulo: 'Alcance médio/dia',
        valor: compacto(alcance / divisor),
        numero: alcance / divisor,
        operador: '=',
        tipo: 'total',
        detalhe: 'o card "Alcance médio/dia"',
      },
      { rotulo: 'Visualizações médias/dia', valor: compacto(soma('views') / divisor), numero: soma('views') / divisor, tipo: 'info' },
      { rotulo: 'Interações/dia', valor: compacto(soma('total_interactions') / divisor), numero: soma('total_interactions') / divisor, tipo: 'info' },
    ],
    filtros: filtrosMarketing(c.contexto),
    regras: [...REGRAS_CONTA, 'Aponte um dia para ver os números dele.'],
    fonte: 'Instagram Insights da conta @bismarchipires (Meta), sincronizado no SIOE.',
    fonteTecnica: 'instagram_account_insights · MarketingAudience',
  }
}
