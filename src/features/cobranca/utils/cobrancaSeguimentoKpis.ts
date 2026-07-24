import type { CobrancaSeguimentoGrupo, CobrancaSeguimentoKpis } from '../types/cobrancaSeguimento.types'
import { departamentoNormKey } from '@/features/opex/utils/departamentoLabel'
import {
  RECEITA_AREA_FALLBACK_PALETTE,
  RECEITA_DEPARTAMENTO_CORES,
  RECEITA_DEPARTAMENTO_LABELS,
  RECEITA_META_CONTRIBUICAO_AREA,
} from '@/features/receita/constants'
import { resolveDepartamentoAreaColor } from '@/features/receita/utils/departamentoAreaCores'
import type { ReceitaDepartamentoCoresConfig } from '@/features/receita/types/receita.types'

const META_AREA_KEYS = new Set(RECEITA_META_CONTRIBUICAO_AREA.map((a) => a.key))

function resolveSeguimentoDepartamentoColor(
  key: string,
  usedColors: Set<string>,
  userCores: ReceitaDepartamentoCoresConfig,
): string {
  const used = new Set([...usedColors].map((c) => c.toLowerCase()))

  const preferred = META_AREA_KEYS.has(key)
    ? resolveDepartamentoAreaColor(key, userCores)
    : RECEITA_DEPARTAMENTO_CORES[key]

  if (preferred && !used.has(preferred.toLowerCase())) {
    usedColors.add(preferred)
    return preferred
  }

  for (const color of RECEITA_AREA_FALLBACK_PALETTE) {
    if (!used.has(color.toLowerCase())) {
      usedColors.add(color)
      return color
    }
  }

  const overflow =
    RECEITA_AREA_FALLBACK_PALETTE[usedColors.size % RECEITA_AREA_FALLBACK_PALETTE.length]
  usedColors.add(overflow)
  return overflow
}

export type CobrancaSeguimentoDepartamentoSlice = {
  key: string
  departamento: string
  valor: number
  pct: number
  color: string
}

export function calcularKpisFromGrupos(grupos: CobrancaSeguimentoGrupo[]): CobrancaSeguimentoKpis {
  if (grupos.length === 0) {
    return {
      valor_total: 0,
      qtd_titulos: 0,
      qtd_grupos: 0,
      valor_faixa_1_30: 0,
      valor_faixa_31_60: 0,
      media_dias_atraso: 0,
    }
  }

  let valor_total = 0
  let qtd_titulos = 0
  let valor_faixa_1_30 = 0
  let valor_faixa_31_60 = 0
  let somaMediaDias = 0

  for (const g of grupos) {
    valor_total += g.valor_total
    qtd_titulos += g.qtd_titulos
    somaMediaDias += g.media_dias_atraso
    if (g.max_dias_atraso <= 30) valor_faixa_1_30 += g.valor_total
    else valor_faixa_31_60 += g.valor_total
  }

  return {
    valor_total,
    qtd_titulos,
    qtd_grupos: grupos.length,
    valor_faixa_1_30,
    valor_faixa_31_60,
    media_dias_atraso: Math.round(somaMediaDias / grupos.length),
  }
}

export function calcularSlicesPorDepartamento(
  grupos: CobrancaSeguimentoGrupo[],
  departamentoCores: ReceitaDepartamentoCoresConfig = RECEITA_DEPARTAMENTO_CORES,
): CobrancaSeguimentoDepartamentoSlice[] {
  const byKey = new Map<string, { departamento: string; valor: number }>()
  let total = 0

  for (const g of grupos) {
    for (const d of g.departamentos ?? []) {
      if (d.valor <= 0) continue
      const key = departamentoNormKey(d.departamento)
      const prev = byKey.get(key)
      if (prev) prev.valor += d.valor
      else byKey.set(key, { departamento: d.departamento, valor: d.valor })
      total += d.valor
    }
  }

  const rows = Array.from(byKey.entries())
    .map(([key, { departamento, valor }]) => ({
      key,
      departamento: RECEITA_DEPARTAMENTO_LABELS[key] ?? departamento,
      valor,
      pct: total > 0 ? (valor / total) * 100 : 0,
      color: '',
    }))
    .sort((a, b) => b.valor - a.valor)

  const usedColors = new Set<string>()
  for (const row of rows) {
    row.color = resolveSeguimentoDepartamentoColor(row.key, usedColors, departamentoCores)
  }

  return rows
}
