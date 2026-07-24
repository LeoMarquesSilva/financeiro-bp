import { formatPercent } from '@/shared/utils/format'
import type {
  CobrancaSeguimentoAcaoTipo,
  CobrancaSeguimentoDepartamento,
} from '../types/cobrancaSeguimento.types'

export const COBRANCA_SEGUIMENTO_TIPOS_ACAO: {
  value: CobrancaSeguimentoAcaoTipo
  label: string
}[] = [
  { value: 'ligacao', label: 'Ligação' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'acordo', label: 'Acordo' },
  { value: 'promessa_pagamento', label: 'Promessa de pagamento' },
  { value: 'outro', label: 'Outro' },
]

export function labelTipoAcaoSeguimento(tipo: CobrancaSeguimentoAcaoTipo | string | null | undefined): string {
  if (!tipo) return '—'
  return COBRANCA_SEGUIMENTO_TIPOS_ACAO.find((t) => t.value === tipo)?.label ?? tipo
}

export function labelCanalD1(canal: string | null | undefined): string {
  if (canal === 'whatsapp') return 'WhatsApp'
  if (canal === 'email') return 'E-mail'
  return canal ?? '—'
}

/** Linha compacta de departamentos abaixo da barra de valor (com % se > 1). */
export function formatDepartamentosLinha(departamentos: CobrancaSeguimentoDepartamento[]): string | null {
  const items = departamentos.filter((d) => d.valor > 0)
  if (items.length === 0) return null
  if (items.length === 1) return items[0].departamento
  return items
    .map((d) => `${d.departamento} ${formatPercent(d.pct)}`)
    .join(' · ')
}
