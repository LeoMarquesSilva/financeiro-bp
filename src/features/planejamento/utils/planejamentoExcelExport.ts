import { montarPlanilhaPlanejamento, type PlanilhaInput } from './planejamentoExcel'

function nomeArquivo(cenario: string, data: Date): string {
  const slug = cenario
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40)
  const d = data.toISOString().slice(0, 10)
  return `planejamento-2027-${slug || 'cenario'}-${d}.xlsx`
}

/** Gera e baixa o .xlsx do planejamento (valores + fórmulas vivas). */
export async function exportarPlanejamentoExcel(input: PlanilhaInput): Promise<void> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  montarPlanilhaPlanejamento(wb, input)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo(input.cenarioNome, input.geradoEm)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
