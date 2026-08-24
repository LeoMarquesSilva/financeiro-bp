import { Building2, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

const AREA_ICON_URLS: Array<[match: string, url: string]> = [
  ['reestruturacao', '/team/reestruturacao.svg'],
  ['recuperacao de credito', '/team/Recuperacao%20de%20Credito.svg'],
  ['trabalhista', '/team/Trabalhista.svg'],
  ['societario', '/team/Societario.svg'],
  ['contratos', '/team/Societario.svg'],
  ['operacoes legais', '/team/Operacoes.svg'],
  ['civel', '/team/civel.svg'],
]

function normalizeArea(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function getMarketingAreaIconUrl(area: string): string | null {
  const normalized = normalizeArea(area)
  return AREA_ICON_URLS.find(([match]) => normalized.includes(match))?.[1] ?? null
}

export function MarketingAreaIcon({
  area,
  className,
}: {
  area: string
  className?: string
}) {
  const iconUrl = getMarketingAreaIconUrl(area)
  const isMarketing = normalizeArea(area).includes('marketing')

  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200',
        className,
      )}
      title={area}
      aria-label={`Área ${area}`}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" className="h-6 w-6 object-contain" />
      ) : isMarketing ? (
        <Megaphone className="h-4 w-4 text-teal-700" aria-hidden />
      ) : (
        <Building2 className="h-4 w-4 text-slate-600" aria-hidden />
      )}
    </span>
  )
}
