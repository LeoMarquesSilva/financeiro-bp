export interface MarketingAccessSubject {
  role: string | null | undefined
  area: string | null | undefined
  isActive: boolean
}
export function canManageInstagramMarketing(subject: MarketingAccessSubject | null): boolean {
  if (!subject?.isActive) return false
  if (subject.role?.trim().toLowerCase() === 'admin') return true
  return subject.area?.trim().toLocaleLowerCase('pt-BR') === 'marketing'
}
