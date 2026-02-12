export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '–'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '–'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function parseCnpjMasked(masked: string): string {
  return masked.replace(/\D/g, '')
}

/**
 * Formata horas decimais como "X horas e Y min" (ex.: 1932,5 → "1.932 horas e 30 min").
 */
export function formatHorasDuracao(horasDecimais: number): string {
  const h = Math.floor(horasDecimais)
  let min = Math.round((horasDecimais - h) * 60)
  if (min >= 60) {
    min = 0
  }
  const hStr = h.toLocaleString('pt-BR')
  if (h > 0 && min > 0) {
    return `${hStr} ${h === 1 ? 'hora' : 'horas'} e ${min} min`
  }
  if (h > 0) {
    return `${hStr} ${h === 1 ? 'hora' : 'horas'}`
  }
  if (min > 0) return `${min} min`
  return '0 h'
}
