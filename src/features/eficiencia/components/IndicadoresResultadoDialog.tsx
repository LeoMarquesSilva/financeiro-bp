import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { MESES_EFICIENCIA } from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import {
  exportIndicadoresResultadoExcel,
  indicadoresResultadoFilename,
} from '../utils/indicadoresResultadoExport'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  onMesChange: (mes: number) => void
}

export function IndicadoresResultadoDialog({
  open,
  onOpenChange,
  ano,
  mes,
  onMesChange,
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const data = await eficienciaService.fetchIndicadoresResultadoMes(ano, mes)
      await exportIndicadoresResultadoExcel(data)
      toast.success(`Arquivo gerado: ${indicadoresResultadoFilename(ano, mes)}`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar Indicadores Resultado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Indicadores Resultado</DialogTitle>
          <DialogDescription>
            Gera o Excel gerencial do mês (KPIs, racionais, metodologia e amostra de chamados)
            para envio aos coordenadores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="mes-indicadores-resultado">Mês de referência</Label>
          <select
            id="mes-indicadores-resultado"
            value={mes}
            onChange={(e) => onMesChange(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            disabled={loading}
          >
            {MESES_EFICIENCIA.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}/{ano}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleDownload()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Download />}
            Baixar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
