import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSearch, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { escritorioLevantamentoService, BLOCO_LABELS, type LevantamentoBloco, type LevantamentoFiltros } from '../services/escritorioLevantamentoService'
import { exportLevantamentoRacionalExcel, formatRacionalCell } from '../utils/levantamentoExport'

type Props = {
  bloco: LevantamentoBloco | null
  filtros: LevantamentoFiltros
  tipoAgendamento?: string | null
  onClose: () => void
}

export function LevantamentoRacionalSheet({
  bloco,
  filtros,
  tipoAgendamento = null,
  onClose,
}: Props) {
  const [exportando, setExportando] = useState(false)
  const open = bloco != null

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'escritorio',
      'levantamento',
      'racional-sheet',
      bloco,
      filtros.dataInicio,
      filtros.dataFim,
      [...filtros.grupos].sort().join('\0'),
      filtros.area,
      tipoAgendamento,
    ],
    queryFn: () =>
      escritorioLevantamentoService.fetchRacional(bloco as LevantamentoBloco, filtros, {
        tipoAgendamento,
      }),
    enabled: open,
  })

  const titulo = bloco
    ? tipoAgendamento
      ? `${BLOCO_LABELS[bloco]} — ${tipoAgendamento}`
      : BLOCO_LABELS[bloco]
    : ''

  async function handleExport() {
    if (!data || exportando) return
    setExportando(true)
    try {
      await exportLevantamentoRacionalExcel(data, { titulo, filtros })
      toast.success('Excel baixado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao exportar')
    } finally {
      setExportando(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-5xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <SheetTitle className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 shrink-0" />
                Racional — {titulo}
              </SheetTitle>
              <SheetDescription>
                {filtros.dataInicio} → {filtros.dataFim}
                {filtros.grupos.length > 0
                  ? ` · ${filtros.grupos.length === 1 ? filtros.grupos[0] : `${filtros.grupos.length} grupos`}`
                  : ' · todos os grupos'}
                {filtros.area ? ` · ${filtros.area}` : ' · todas as áreas'}
                {data ? ` · ${data.total.toLocaleString('pt-BR')} registro(s)` : null}
                {data?.truncado ? ` (exibindo até ${data.limit})` : null}
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5 text-xs"
              disabled={isLoading || exportando || !data?.linhas.length}
              onClick={() => void handleExport()}
            >
              {exportando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Excel
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-rose-600">
              {error instanceof Error ? error.message : 'Erro ao carregar racional'}
            </p>
          ) : !data?.linhas.length ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma linha no filtro atual.</p>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  {data.colunas.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.linhas.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
                    {data.colunas.map((c) => (
                      <td key={c.key} className="max-w-[16rem] truncate px-3 py-1.5 text-slate-800">
                        {formatRacionalCell(row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
