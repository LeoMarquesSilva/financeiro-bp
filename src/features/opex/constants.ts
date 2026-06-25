export const OPEX_COLORS = {
  previsto: { hex: '#9333ea', text: 'text-purple-700', bg: 'bg-purple-50' },
  realizado: { hex: '#059669', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  projetado: { hex: '#f59e0b', text: 'text-amber-700', bg: 'bg-amber-50' },
  fixo: { hex: '#7c3aed', text: 'text-violet-700', bg: 'bg-violet-50' },
} as const

export const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const

export const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const
