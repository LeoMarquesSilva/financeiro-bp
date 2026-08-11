import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw, Shield } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/lib/database.types'
import {
  CONFIGURABLE_ROLES,
  ROLE_ACCESS_LABELS,
  buildDefaultRoleRouteAccess,
  type RoleRouteAccessConfig,
} from '@/lib/roleAccessConfig'
import { NAV_ACCESS_ITEMS } from '@/lib/navAccess'
import { useRoleAccessDefaults } from '@/lib/RoleAccessDefaultsContext'
import { moduleKeyLabel } from '@/lib/moduleAccess'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function togglePath(
  config: RoleRouteAccessConfig,
  role: AppRole,
  path: string,
  checked: boolean,
): RoleRouteAccessConfig {
  const next = { ...config, [role]: [...config[role]] }
  const set = new Set(next[role])
  if (checked) set.add(path)
  else set.delete(path)
  next[role] = [...set].sort()
  return next
}

export function PerfisPadraoDialog({ open, onOpenChange }: Props) {
  const { config, isLoading, save, isSaving, resetToDefaults } = useRoleAccessDefaults()
  const [draft, setDraft] = useState<RoleRouteAccessConfig>(() => buildDefaultRoleRouteAccess())

  useEffect(() => {
    if (open) setDraft(config)
  }, [open, config])

  const defaults = useMemo(() => buildDefaultRoleRouteAccess(), [])

  const handleSave = async () => {
    try {
      await save(draft)
      toast.success('Perfis padrão atualizados — vale para todos os usuários com esse perfil.')
      onOpenChange(false)
    } catch {
      toast.error('Não foi possível salvar os perfis padrão.')
    }
  }

  const handleReset = async () => {
    const built = buildDefaultRoleRouteAccess()
    setDraft(built)
    try {
      await resetToDefaults()
      toast.success('Restaurado ao padrão do sistema.')
    } catch {
      toast.error('Não foi possível restaurar o padrão.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-teal-600" aria-hidden />
            Perfis padrão — menu e rotas
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-slate-500">
            Define o que cada perfil vê no menu lateral e pode acessar por padrão. Módulos
            liberados individualmente em &quot;Gerenciar acesso&quot; continuam valendo além desta
            matriz.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90">
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">
                      Tela / módulo
                    </th>
                    {CONFIGURABLE_ROLES.map((role) => (
                      <th
                        key={role}
                        className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {ROLE_ACCESS_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {NAV_ACCESS_ITEMS.map((item) => (
                    <tr key={item.to} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">{item.label}</p>
                        {item.moduleKey ? (
                          <p className="text-[11px] text-slate-400">
                            Módulo: {moduleKeyLabel(item.moduleKey)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">Rota do perfil</p>
                        )}
                      </td>
                      {CONFIGURABLE_ROLES.map((role) => {
                        const checked = draft[role].includes(item.to)
                        const isDefault = defaults[role].includes(item.to)
                        return (
                          <td key={role} className="px-2 py-2.5 text-center">
                            <label
                              className={cn(
                                'inline-flex cursor-pointer items-center justify-center rounded-md p-2',
                                'hover:bg-slate-100',
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  setDraft((prev) =>
                                    togglePath(prev, role, item.to, v === true),
                                  )
                                }
                                aria-label={`${ROLE_ACCESS_LABELS[role]} — ${item.label}`}
                              />
                              {!isDefault && checked && (
                                <span className="sr-only"> (customizado)</span>
                              )}
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600"
            onClick={() => void handleReset()}
            disabled={isSaving || isLoading}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving || isLoading}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
