/** Planos de contas que entram na cota de receita (Recebido/Previsto). Demais planos são ignorados. */
export const PLANOS_CONTAS_INCLUIDOS_COTA = [
  'HONORÁRIOS MENSAIS',
  'HONORÁRIOS SPOT',
  'HONORÁRIOS DE SUCUMBÊNCIA',
  'HONORÁRIOS DE ÊXITO',
  'HONORÁRIOS DE MANUTENÇÃO',
  'HONORÁRIOS POR HORA TRABALHADA',
  'HONORÁRIOS ADVOCATÍCIOS',
] as const

export const MESES_ABREV = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

export const MESES_NOME = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export function mesAbrev(mes: number): string {
  return MESES_ABREV[mes - 1] ?? String(mes)
}

export function mesNome(mes: number): string {
  return MESES_NOME[mes - 1] ?? String(mes)
}

/** Último mês disponível para o ano (inclui o mês corrente; ex.: em jun/2026 → 6). */
export function mesMaxDisponivelInadimplencia(ano: number, ref = new Date()): number {
  const y = ref.getFullYear()
  const m = ref.getMonth() + 1
  if (ano > y) return 0
  if (ano < y) return 12
  return m
}

/** Paleta fixa do módulo Receita (gráfico, tabela, KPIs, formulário). */
export const RECEITA_COLORS = {
  meta: {
    hex: '#16a34a',
    text: 'text-emerald-700',
    textStrong: 'text-emerald-800',
    bg: 'bg-emerald-50',
    bgIcon: 'bg-emerald-50 text-emerald-700',
    border: 'border-emerald-200',
    ring: 'ring-emerald-200/80',
    header: 'text-emerald-800',
  },
  projetadoBaseAbril: {
    hex: '#1e3a8a',
    text: 'text-blue-900',
    textStrong: 'text-blue-950',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'text-blue-900',
  },
  projetadoReal: {
    hex: '#ca8a04',
    text: 'text-amber-700',
    textStrong: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    header: 'text-amber-800',
  },
  recebido: {
    hex: '#0284c7',
    text: 'text-sky-700',
    textStrong: 'text-sky-800',
  },
  previsto: {
    hex: '#7c3aed',
    text: 'text-violet-700',
    textStrong: 'text-violet-800',
  },
  encargos: {
    hex: '#ea580c',
    text: 'text-orange-700',
    textStrong: 'text-orange-800',
    bgIcon: 'bg-orange-50 text-orange-600',
  },
  inadimplencia: {
    hex: '#dc2626',
    text: 'text-red-700',
    textStrong: 'text-red-800',
  },
} as const

/**
 * Cor fixa por departamento (chave normalizada: sem acento, snake_case).
 * Garante cores distintas — sem hash (evita colisões, ex.: vários em cinza).
 */
export const RECEITA_DEPARTAMENTO_CORES: Record<string, string> = {
  insolvencia: '#6d28d9',
  civel: '#dc2626',
  civel_insolvencia: '#9333ea',
  contratos: '#7c2d12',
  tributario: '#d97706',
  trabalhista: '#db2777',
  recuperacao_de_credito: '#0891b2',
  distressed_deals: '#ea580c',
  bp: '#4f46e5',
  conta_corrente_clientes: '#0d9488',
  facilities: '#65a30d',
  societario: '#5b21b6',
  empresarial: '#a16207',
  imobiliario: '#0f766e',
  ambiental: '#be185d',
  compliance: '#9f1239',
  familia: '#e11d48',
  penal: '#1e40af',
  sem_departamento: '#64748b',
}

/** Rótulos na tela de configuração de cores por área. */
export const RECEITA_DEPARTAMENTO_LABELS: Record<string, string> = {
  insolvencia: 'Insolvência',
  civel: 'Cível',
  civel_insolvencia: 'Cível | Insolvência',
  contratos: 'Contratos',
  tributario: 'Tributário',
  trabalhista: 'Trabalhista',
  recuperacao_de_credito: 'Recuperação de Crédito',
  distressed_deals: 'Distressed Deals',
  bp: 'BP',
  conta_corrente_clientes: 'Conta Corrente Clientes',
  facilities: 'Facilities',
  societario: 'Societário',
  empresarial: 'Empresarial',
  imobiliario: 'Imobiliário',
  ambiental: 'Ambiental',
  compliance: 'Compliance',
  familia: 'Família',
  penal: 'Penal',
  sem_departamento: 'Sem departamento',
}

/**
 * Meta de contribuição por área para a meta mensal/anual de recebimento (fixa, definida pela
 * gestão — não calculada a partir do recebido real). Soma = 100%. Usada no comparativo mensal,
 * visão "por área", para ratear a meta do mês entre as áreas.
 */
export const RECEITA_META_CONTRIBUICAO_AREA: { key: string; pct: number }[] = [
  { key: 'insolvencia', pct: 46.85 },
  { key: 'trabalhista', pct: 15.33 },
  { key: 'civel', pct: 15.33 },
  { key: 'contratos', pct: 12.53 },
  { key: 'recuperacao_de_credito', pct: 9.96 },
]

/** Cores para segmentos por plano de contas no gráfico (%). */
export const RECEITA_PLANO_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#db2777',
  '#0d9488',
] as const

/** Cores extras para departamentos novos / não mapeados (nunca repetir na mesma tela). */
export const RECEITA_AREA_FALLBACK_PALETTE = [
  '#7c2d12',
  '#9333ea',
  '#a16207',
  '#0f766e',
  '#c026d3',
  '#b45309',
  '#1d4ed8',
  '#9f1239',
] as const

/** Tamanhos de rótulo nos gráficos (legível em TV / apresentação). */
export const RECEITA_CHART_LABEL = {
  barTop: 12,
  barInside: 11,
  linePoint: 12,
  minBarHeight: 14,
  minStackHeight: 20,
} as const

/** Cores de eixo e rótulos — preto para legibilidade em fundo branco (PPT). */
export const RECEITA_CHART_AXIS = {
  tick: '#111827',
  label: '#111827',
} as const

/** Séries em linha no gráfico de colunas (somente recebido é barra empilhada). */
export const RECEITA_COLUNAS_METRICAS = [
  {
    key: 'meta',
    legend: 'Meta',
    color: RECEITA_COLORS.meta.hex,
    strokeDasharray: '6 4',
    defaultOn: true,
  },
  {
    key: 'projetadoBaseAbril',
    legend: 'Proj. base abril',
    color: RECEITA_COLORS.projetadoBaseAbril.hex,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'projetadoReal',
    legend: 'Proj. real',
    color: RECEITA_COLORS.projetadoReal.hex,
    strokeDasharray: '4 4',
    defaultOn: false,
  },
  {
    key: 'previsto',
    legend: 'Previsto',
    color: RECEITA_COLORS.previsto.hex,
    strokeDasharray: undefined,
    defaultOn: true,
  },
] as const
