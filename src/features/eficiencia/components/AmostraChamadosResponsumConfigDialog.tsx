import { useEffect, useMemo, useState } from 'react'
import { Settings2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Colaborador } from '@/features/colaboradores/types'
import {
  areasParaConfiguracaoResponsum,
  colaboradoresComResponsum,
  loadAmostraChamadosResponsumConfig,
  saveAmostraChamadosResponsumConfig,
  titularPadraoPorArea,
  type AmostraChamadosResponsumConfig,
  type ResponsumTitularRef,
} from '../utils/amostraChamadosResponsumConfig'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  colaboradores: Colaborador[]
  areasAmostra: string[]
  onSaved: (config: AmostraChamadosResponsumConfig) => void
}

function colaboradorToTitular(c: Colaborador): ResponsumTitularRef {
  return {
    responsum_user_id: c.responsum_user_id!,
    full_name: c.full_name,
    area: c.area,
  }
}

export function AmostraChamadosResponsumConfigDialog({
  open,
  onOpenChange,
  colaboradores,
  areasAmostra,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState<AmostraChamadosResponsumConfig>({})

  useEffect(() => {
    if (open) setDraft(loadAmostraChamadosResponsumConfig())
  }, [open])

  const areas = useMemo(
    () => areasParaConfiguracaoResponsum(colaboradores, areasAmostra),
    [colaboradores, areasAmostra],
  )

  const padraoPorArea = useMemo(
    () => titularPadraoPorArea(colaboradores, areas),
    [colaboradores, areas],
  )

  const comResponsum = useMemo(() => colaboradoresComResponsum(colaboradores), [colaboradores])

  const handleSave = () => {
    saveAmostraChamadosResponsumConfig(draft)
    onSaved(draft)
    onOpenChange(false)
  }

  const handleReset = () => {
    setDraft({})
    saveAmostraChamadosResponsumConfig({})
    onSaved({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-500" />
            Abertura no RESPONSUM por área
          </DialogTitle>
          <DialogDescription>
            Escolha quem será o titular (<strong>created_by</strong>) de cada chamado, por área.
            Sem override, usa coordenador → gerente → sócio (Colaboradores).
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(52vh,420px)] flex-1 px-6 py-4">
          {areas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhuma área disponível para configurar.
            </p>
          ) : (
            <ul className="space-y-4">
              {areas.map((area) => {
                const padrao = padraoPorArea.get(area)
                const override = draft[area]
                const selectValue = override?.responsum_user_id ?? ''
                const candidatosArea = comResponsum.filter((c) => c.area === area)
                const candidatosOutros = comResponsum.filter((c) => c.area !== area)

                return (
                  <li key={area} className="space-y-1.5">
                    <Label htmlFor={`responsum-area-${area}`} className="text-sm font-semibold">
                      {area}
                    </Label>
                    <select
                      id={`responsum-area-${area}`}
                      value={selectValue}
                      onChange={(e) => {
                        const id = e.target.value
                        setDraft((prev) => {
                          const next = { ...prev }
                          if (!id) {
                            delete next[area]
                            return next
                          }
                          const colab =
                            comResponsum.find((c) => c.responsum_user_id === id) ??
                            comResponsum.find((c) => c.id === id)
                          if (colab) next[area] = colaboradorToTitular(colab)
                          else delete next[area]
                          return next
                        })
                      }}
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                    >
                      <option value="">
                        {padrao
                          ? `Automático — ${padrao.full_name} (${padrao.nivel_hierarquico})`
                          : 'Automático — sem titular mapeado'}
                      </option>
                      {candidatosArea.length > 0 && (
                        <optgroup label="Mesma área">
                          {candidatosArea.map((c) => (
                            <option key={c.id} value={c.responsum_user_id!}>
                              {c.full_name} · {c.nivel_hierarquico}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {candidatosOutros.length > 0 && (
                        <optgroup label="Outras áreas">
                          {candidatosOutros.map((c) => (
                            <option key={c.id} value={c.responsum_user_id!}>
                              {c.full_name} · {c.area}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {override && padrao && override.responsum_user_id !== padrao.responsum_user_id && (
                      <p className="text-[11px] text-sky-700">
                        Override ativo (padrão seria {padrao.full_name})
                      </p>
                    )}
                    {!padrao && !override && (
                      <p className="text-[11px] text-amber-700">
                        Sem titular automático — configure ou use fallback do usuário logado.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={handleReset}>
            Restaurar padrão
          </Button>
          <Button type="button" onClick={handleSave}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
