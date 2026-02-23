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

/** Converte string em formato BRL (ex: "1.234,56" ou "R$ 1.234,56") para número. */
export function parseCurrencyBr(value: string): number {
  if (!value || typeof value !== 'string') return 0
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

/** Formata valor digitado para exibição em BRL (ex: "123456" → "1.234,56"). Aceita string parcial. */
export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  const cents = digits.slice(-2).padStart(2, '0')
  const intPart = digits.slice(0, -2) || '0'
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${withThousands},${cents}`
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

/**
 * Converte horas decimais (total_horas do banco) para HH:MM:SS.
 * Regra única: valor é sempre em horas decimais (ex.: 194,55 → "194:33:00", 50,5 → "50:30:00").
 * Assim todos os grupos são tratados igual; valores absurdos (dados antigos errados) continuarão
 * grandes até o TimeSheets ser re-sincronizado com a coluna em decimal correta.
 */
export function formatHorasHHMMSS(horasDecimais: number): string {
  if (!Number.isFinite(horasDecimais) || horasDecimais < 0) return '0:00:00'
  const totalSegundos = Math.round(horasDecimais * 3600)
  const h = Math.floor(totalSegundos / 3600)
  const resto = totalSegundos % 3600
  const min = Math.floor(resto / 60)
  const seg = resto % 60
  return `${h}:${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
}
