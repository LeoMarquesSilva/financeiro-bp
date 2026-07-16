import { MESES_CURTOS } from '../constants'
import { departamentoLabel } from './departamentoLabel'
import type { OpexDepartamentoMesRow } from '../types/opex.types'
import {
  departamentoAreaColor,
  departamentoDataKey,
} from '@/features/receita/utils/receitaColunasChart'
import { RECEITA_DEPARTAMENTO_CORES } from '@/features/receita/constants'
import type { ReceitaDepartamentoCoresConfig } from '@/features/receita/types/receita.types'

export type OpexAreaSlice = {
  departamento: string
  label: string
  dataKey: string
  color: string
}

export type OpexDepartamentosChartPoint = {
  mes: number
  mesLabel: string
  ativo: boolean
  total: number
  [key: string]: number | string | boolean
}

export function buildOpexAreaSlices(
  rows: OpexDepartamentoMesRow[],
  mesesVisiveis: number[],
  metric: 'realizado' | 'previsto',
  cores: ReceitaDepartamentoCoresConfig = RECEITA_DEPARTAMENTO_CORES,
): OpexAreaSlice[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    if (!mesesVisiveis.includes(row.mes)) continue
    totals.set(row.departamento, (totals.get(row.departamento) ?? 0) + row[metric])
  }

  const usedColors = new Set<string>()

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([departamento]) => ({
      departamento,
      label: departamentoLabel(departamento),
      dataKey: departamentoDataKey(departamento),
      color: departamentoAreaColor(departamento, usedColors, cores),
    }))
}

export function buildOpexDepartamentosChartData(
  ano: number,
  rows: OpexDepartamentoMesRow[],
  areaSlices: OpexAreaSlice[],
  metric: 'realizado' | 'previsto',
  mesesVisiveis: number[],
  mesAtual: number,
): OpexDepartamentosChartPoint[] {
  const byMesDept = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.mes}::${row.departamento}`
    byMesDept.set(key, row[metric])
  }

  return mesesVisiveis.map((mes) => {
    const futuro = ano > new Date().getFullYear() ? true : ano === new Date().getFullYear() && mes > mesAtual
    const point: OpexDepartamentosChartPoint = {
      mes,
      mesLabel: MESES_CURTOS[mes - 1] ?? String(mes),
      ativo: true,
      total: 0,
    }

    let total = 0
    for (const slice of areaSlices) {
      const value = futuro && metric === 'realizado' ? 0 : byMesDept.get(`${mes}::${slice.departamento}`) ?? 0
      point[slice.dataKey] = value
      total += value
    }
    point.total = total
    return point
  })
}
