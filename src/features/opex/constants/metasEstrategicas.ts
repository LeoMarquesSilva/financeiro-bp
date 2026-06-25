import type { OpexIniciativaTipo } from '../types/opexMetas.types'

export const OPEX_META_MIN_INICIATIVAS = 1
export const OPEX_META_MIN_VALOR_ANUAL = 5000

export const OPEX_INICIATIVA_TIPOS: {
  tipo: OpexIniciativaTipo
  titulo: string
  descricao: string
  contextoLabel: string
  valorLabel: string
  icon: 'replace' | 'code'
}[] = [
  {
    tipo: 'substituicao_ferramenta',
    titulo: 'Substituição de ferramenta',
    descricao:
      'Pelo menos 1 iniciativa anual de substituição de ferramenta já contratada, com economia mínima de R$ 5.000/ano.',
    contextoLabel: 'Ferramenta substituída',
    valorLabel: 'Economia anual (R$)',
    icon: 'replace',
  },
  {
    tipo: 'desenvolvimento_interno',
    titulo: 'Desenvolvimento interno',
    descricao:
      'Pelo menos 1 iniciativa anual de desenvolvimento interno que evite contratação externa, com custo evitado mínimo de R$ 5.000/ano, mensurado e validado.',
    contextoLabel: 'Necessidade suprida',
    valorLabel: 'Custo evitado anual (R$)',
    icon: 'code',
  },
]

export const OPEX_INICIATIVA_STATUS_LABELS: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  validada: 'Validada',
}

export const OPEX_INICIATIVA_STATUS_STYLES: Record<string, string> = {
  planejada: 'bg-slate-100 text-slate-700 border-slate-200',
  em_andamento: 'bg-sky-50 text-sky-800 border-sky-200',
  concluida: 'bg-amber-50 text-amber-800 border-amber-200',
  validada: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}
