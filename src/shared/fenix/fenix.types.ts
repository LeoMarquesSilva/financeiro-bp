/**
 * Fênix — assistente que explica os números do SIOE.
 *
 * Cada número marcado na tela entrega uma `FenixExplicacao`: o que é, a fórmula,
 * a memória de cálculo com os valores reais e as regras aplicadas. O objeto é
 * serializável de propósito: é o mesmo contexto que a IA vai receber na etapa 2.
 */

export type FenixOperador = '+' | '−' | '×' | '÷' | '='

/** Uma linha da memória de cálculo. */
export type FenixLinha = {
  rotulo: string
  /** Valor já formatado como aparece na tela (ex.: "R$ 1.234,56"). */
  valor: string
  /** Valor numérico, para a IA e para conferência. */
  numero?: number
  operador?: FenixOperador
  /** `total` destaca o resultado; `info` é uma linha explicativa sem peso na conta. */
  tipo?: 'parcela' | 'total' | 'info'
  detalhe?: string
}

export type FenixFiltro = { rotulo: string; valor: string }

export type FenixExplicacao = {
  /** Onde o número está (ex.: "Receita › Resumo 2026"). */
  tela: string
  titulo: string
  /** Valor exibido no card. */
  valor: string
  /** O que o número significa, em uma ou duas frases. */
  resumo: string
  /** A conta em uma linha (ex.: "Atingimento = Recebido ÷ Meta × 100"). */
  formula?: string
  conta?: FenixLinha[]
  filtros?: FenixFiltro[]
  regras?: string[]
  /** De onde vem o dado, em linguagem de negócio. */
  fonte?: string
  /** Função, tabela ou arquivo — para quem for conferir no banco ou no código. */
  fonteTecnica?: string
  /** Onde ver item a item. */
  detalhe?: string
}

export type FenixExplicar = () => FenixExplicacao
