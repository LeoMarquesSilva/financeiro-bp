import {
  RECEITA_DEPARTAMENTO_CORES,
  RECEITA_DEPARTAMENTO_LABELS,
  RECEITA_META_CONTRIBUICAO_AREA,
} from '../constants'
import type { ReceitaDepartamentoCoresConfig } from '../types/receita.types'

export type ReceitaMetaAreaSlice = {
  key: string
  pct: number
  label: string
  color: string
}

/** Cor oficial de uma área meta (Insolvência, Trabalhista, etc.). */
export function resolveDepartamentoAreaColor(
  areaKey: string,
  cores: ReceitaDepartamentoCoresConfig = RECEITA_DEPARTAMENTO_CORES,
): string {
  return cores[areaKey] ?? RECEITA_DEPARTAMENTO_CORES[areaKey] ?? '#64748b'
}

/** Slices das 5 áreas meta com label e cor resolvidos a partir da config. */
export function buildReceitaMetaAreaSlices(
  cores: ReceitaDepartamentoCoresConfig = RECEITA_DEPARTAMENTO_CORES,
): ReceitaMetaAreaSlice[] {
  return RECEITA_META_CONTRIBUICAO_AREA.map((a) => ({
    ...a,
    label: RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key,
    color: resolveDepartamentoAreaColor(a.key, cores),
  }))
}

export function findMetaAreaSlice(
  slices: ReceitaMetaAreaSlice[],
  areaKey: string,
): ReceitaMetaAreaSlice | null {
  return slices.find((s) => s.key === areaKey) ?? null
}
