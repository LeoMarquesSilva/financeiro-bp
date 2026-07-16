import { RECEITA_DEPARTAMENTO_LABELS } from '@/features/receita/constants'

export function departamentoNormKey(departamento: string): string {
  return (
    departamento
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase() || 'sem_departamento'
  )
}

export function departamentoLabel(departamento: string): string {
  const key = departamentoNormKey(departamento)
  return RECEITA_DEPARTAMENTO_LABELS[key] ?? departamento
}
