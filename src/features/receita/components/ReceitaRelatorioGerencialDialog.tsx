import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  MESES_ABREV,
  RECEITA_DEPARTAMENTO_CORES,
  mesMaxDisponivelInadimplencia,
  mesNome,
} from '../constants'
import type { ReceitaDepartamentoCoresConfig } from '../types/receita.types'
import { buildReceitaMetaAreaSlices } from '../utils/departamentoAreaCores'
import { isMesFuturo } from '../utils/receitaMes'
import { carregarRelatorioGerencialGrupos } from '../utils/receitaRelatorioGerencial'
import { exportRelatorioGerencialExcel } from '../utils/receitaRelatorioGerencialExport'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  areaKeyInicial?: string | null
  departamentoCores?: ReceitaDepartamentoCoresConfig
}

export function ReceitaRelatorioGerencialDialog({
  open,
  onOpenChange,
  ano,
  areaKeyInicial = null,
  departamentoCores,
}: Props) {
  const mesPadrao = mesMaxDisponivelInadimplencia(ano) || 1
  const [mes, setMes] = useState(mesPadrao)
  const [areaKey, setAreaKey] = useState<string | null>(areaKeyInicial)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const areaSlices = useMemo(
    () => buildReceitaMetaAreaSlices(departamentoCores ?? RECEITA_DEPARTAMENTO_CORES),
    [departamentoCores],
  )

  useEffect(() => {
    if (!open) return
    setMes(mesMaxDisponivelInadimplencia(ano) || 1)
    setAreaKey(areaKeyInicial)
    setErro(null)
    setGerando(false)
  }, [open, ano, areaKeyInicial])

  const areaLabel =
    areaKey == null
      ? 'Todas as áreas'
      : (areaSlices.find((a) => a.key === areaKey)?.label ?? areaKey)

  const handleGerar = async (): Promise<void> => {
    setGerando(true)
    setErro(null)
    try {
      const grupos = await carregarRelatorioGerencialGrupos(ano, mes, areaKey)
      await exportRelatorioGerencialExcel(grupos, {
        ano,
        periodoLabel: mesNome(mes),
        areaLabel,
      })
      toast.success('Planilha gerada')
      onOpenChange(false)
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : 'Não foi possível gerar o relatório'
      setErro(message)
      toast.error(message)
    } finally {
      setGerando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-slate-500" aria-hidden />
            Relatório gerencial
          </DialogTitle>
          <DialogDescription>
            Escolha o mês e a área para gerar a planilha de previsto faturado, pago e
            inadimplente por grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          <div className="space-y-2">
            <Label>Mês</Label>
            <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Mês">
              {MESES_ABREV.map((label, idx) => {
                const valor = idx + 1
                const ativo = valor === mes
                const futuro = isMesFuturo(ano, valor)
                return (
                  <button
                    key={label}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    disabled={futuro || gerando}
                    onClick={() => setMes(valor)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
                      ativo
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                      futuro && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Área</Label>
            <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Área">
              <button
                type="button"
                role="option"
                aria-selected={areaKey == null}
                disabled={gerando}
                onClick={() => setAreaKey(null)}
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                  areaKey == null
                    ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                Todas as áreas
              </button>
              {areaSlices.map((area) => {
                const ativo = areaKey === area.key
                return (
                  <button
                    key={area.key}
                    type="button"
                    role="option"
                    aria-selected={ativo}
                    disabled={gerando}
                    onClick={() => setAreaKey(area.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all',
                      ativo
                        ? 'border-transparent text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                    style={
                      ativo
                        ? { backgroundColor: area.color, borderColor: area.color }
                        : undefined
                    }
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: area.color }}
                      aria-hidden
                    />
                    {area.label}
                  </button>
                )
              })}
            </div>
          </div>

          {erro && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={gerando}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleGerar()} disabled={gerando}>
            {gerando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
            )}
            {gerando ? 'Gerando…' : 'Gerar Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
