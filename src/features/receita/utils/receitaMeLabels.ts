import { formatCurrency } from '@/shared/utils/format'
import { mesAbrev, RECEITA_DEPARTAMENTO_LABELS, RECEITA_META_CONTRIBUICAO_AREA } from '../constants'
import type { ReceitaMeTituloDetalhe } from './receitaMeCalc'
import { RECEITA_RATEIO_OUTRAS_KEY } from './receitaRateioConsulta'
import type { ReceitaMeChance, ReceitaMeOrigem } from '../types/receitaMe.types'

/** Áreas com gerente e meta própria (mesma ordem da contribuição na meta). */
export const RECEITA_ME_AREAS = RECEITA_META_CONTRIBUICAO_AREA

export const RECEITA_ME_OUTRAS_KEY = RECEITA_RATEIO_OUTRAS_KEY

export function receitaMeAreaLabel(areaKey: string): string {
  if (areaKey === RECEITA_ME_OUTRAS_KEY) return 'Demais departamentos'
  return RECEITA_DEPARTAMENTO_LABELS[areaKey] ?? areaKey
}

/** Ex.: "Out/26". */
export function receitaMeMesRotulo(ano: number, mes: number): string {
  const abrev = mesAbrev(mes)
  return `${abrev.charAt(0).toUpperCase()}${abrev.slice(1)}/${String(ano).slice(-2)}`
}

/** '2026-10-25' → '25/10'. */
export function receitaMeDiaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Linha do tooltip: "Venceu 10/10 · R$ 6.200,00 · em atraso", "Vence 25/10 · …", "Venc. … · pago em …". */
export function receitaMeDescreverTitulo(d: ReceitaMeTituloDetalhe): string {
  const venc = d.vencimento ? receitaMeDiaMes(d.vencimento) : 'sem data'
  const valor = formatCurrency(d.valor)
  if (d.pago) return `Venc. ${venc} · ${valor} · pago${d.pagamento ? ` em ${receitaMeDiaMes(d.pagamento)}` : ''}`
  if (d.vencido) return `Venceu ${venc} · ${valor} · em atraso`
  return `Vence ${venc} · ${valor}`
}

export function receitaMeMesesRotulo(ano: number, meses: readonly number[]): string {
  if (meses.length === 0) return ''
  if (meses.length === 1) return receitaMeMesRotulo(ano, meses[0])
  return `${receitaMeMesRotulo(ano, meses[0])}–${receitaMeMesRotulo(ano, meses[meses.length - 1])}`
}

export const RECEITA_ME_ORIGEM_LABELS: Record<ReceitaMeOrigem, string> = {
  cliente_existente: 'Cliente existente',
  lead: 'Lead',
  exito_acordo: 'Êxito / acordo',
  outro: 'Outro',
}

export const RECEITA_ME_CHANCE_LABELS: Record<ReceitaMeChance, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const RECEITA_ME_CHANCE_CLASS: Record<ReceitaMeChance, string> = {
  alta: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  media: 'border-amber-200 bg-amber-50 text-amber-700',
  baixa: 'border-slate-200 bg-slate-100 text-slate-600',
}

export const RECEITA_ME_TIPOS_RECEITA = [
  'Honorários mensais',
  'Honorários spot',
  'Honorários de êxito',
  'Honorários de sucumbência',
  'Outros',
]
