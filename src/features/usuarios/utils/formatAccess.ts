import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatRelativeAccess(iso: string | null | undefined): string {
  if (!iso) return 'Sem login'
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
  } catch {
    return 'Sem login'
  }
}

export function formatDateTimePt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return '—'
  }
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
