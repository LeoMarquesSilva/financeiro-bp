import { formatPercent } from '@/shared/utils/format'
import { MESES_EFICIENCIA } from '../constants'
import type { GestaoPdiDetalheRow } from '../types/eficiencia.types'

function safeFilenamePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function exportGestaoPdiDesviosExcel(
  desvios: GestaoPdiDetalheRow[],
  meta: { ano: number; areaLabel?: string | null },
): Promise<void> {
  const XLSX = await import('xlsx')

  const rows = desvios.map((d) => ({
    Mês: MESES_EFICIENCIA[d.mes - 1] ?? String(d.mes),
    Colaborador: d.colaborador,
    Área: d.area ?? '',
    'Progresso anterior':
      d.progresso_anterior != null ? formatPercent(d.progresso_anterior) : '',
    Progresso: d.progresso != null ? formatPercent(d.progresso) : '',
    'Evidências de Execução': d.evidencias_execucao ?? '',
    '1:1': d.one_a_one != null ? String(d.one_a_one) : '',
    'Desvio Critério de Puração': d.desvio_criterio_apuracao?.trim() || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Desvios')

  const filename = [
    'gestao-pdi-desvios',
    meta.ano,
    meta.areaLabel ? safeFilenamePart(meta.areaLabel) : null,
  ]
    .filter(Boolean)
    .join('-')

  XLSX.writeFile(wb, `${filename}.xlsx`)
}
