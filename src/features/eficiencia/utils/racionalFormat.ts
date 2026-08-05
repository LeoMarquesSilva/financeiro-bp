export function formatRacionalCell(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR')
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`)
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR')
  }
  return String(value)
}

export function formatRacionalResumoLabel(resumo: {
  qtd_d1?: number
  qtd_fatal?: number
  qtd_eficiencia?: number
  qtd_inconsistencia?: number
  qtd_total?: number
}): string | null {
  if (resumo.qtd_d1 != null && resumo.qtd_fatal != null) {
    return `Total: ${resumo.qtd_d1} protocolo${resumo.qtd_d1 === 1 ? '' : 's'} em D-1 · ${resumo.qtd_fatal} protocolo${resumo.qtd_fatal === 1 ? '' : 's'} em FATAL`
  }

  if (resumo.qtd_inconsistencia != null && resumo.qtd_eficiencia != null) {
    const total = resumo.qtd_total ?? resumo.qtd_inconsistencia + resumo.qtd_eficiencia
    return `Total: ${resumo.qtd_inconsistencia} inconsistência${resumo.qtd_inconsistencia === 1 ? '' : 's'} · ${resumo.qtd_eficiencia} eficiência · ${total} protocolo${total === 1 ? '' : 's'}`
  }

  return null
}
