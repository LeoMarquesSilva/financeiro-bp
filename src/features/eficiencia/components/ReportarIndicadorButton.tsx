import { useState } from 'react'
import { Bug, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { blobToDataUrl } from '@/shared/error-reporting/captureScreenshot'
import { useErrorReportingOptional } from '@/shared/error-reporting/ErrorReportingProvider'
import type { ReportarErroAnexo } from '@/shared/error-reporting/buildReportContent'
import { eficienciaService } from '../services/eficienciaService'
import { buildRacionalExcelBlob } from '../utils/racionalExport'
import { formatRacionalPeriodoLabel } from '../utils/racionalQuery'
import type { MesFiltroEficiencia } from '../constants'
import { isDiaFiltro, isSemanaFiltro } from '../constants'
import type { RacionalEscopo, RacionalIndicador } from '../types/eficiencia.types'

export type ReportarIndicadorItem = {
  indicador: RacionalIndicador
  titulo: string
}

type Props = {
  /** Contexto do chamado (nome da aba / indicador). */
  titulo: string
  /** Um ou mais racionais anexados como Excel. */
  items: ReportarIndicadorItem[]
  ano: number
  mesFiltro?: MesFiltroEficiencia
  area?: string | null
  modulo?: string
  escopo?: RacionalEscopo
  className?: string
}

/**
 * Reportar inconsistência do indicador: screenshot + Excel(s) do racional no ticket RESPONSUM.
 */
export function ReportarIndicadorButton({
  titulo,
  items,
  ano,
  mesFiltro = null,
  area = null,
  modulo = 'Eficiência',
  escopo = 'default',
  className,
}: Props) {
  const { openReport } = useErrorReportingOptional()
  const [reportando, setReportando] = useState(false)

  async function handleReportar() {
    if (reportando || items.length === 0) return
    setReportando(true)
    try {
      const mesParaFetch = mesFiltro === 'resultado' ? null : mesFiltro
      const periodoLabel = formatRacionalPeriodoLabel(ano, mesParaFetch)
      const areaLabel = area ?? 'todas as áreas'
      // openReport só aceita number | number[] | string — período curto vira rótulo.
      const mesParaReport: number | number[] | string | null =
        mesParaFetch == null
          ? null
          : isDiaFiltro(mesParaFetch) || isSemanaFiltro(mesParaFetch)
            ? periodoLabel
            : mesParaFetch

      const anexos: ReportarErroAnexo[] = []
      for (const item of items) {
        const exportData = await eficienciaService.fetchRacionalParaExport(
          item.indicador,
          ano,
          area,
          mesParaFetch,
          escopo,
        )
        const { blob, filename } = await buildRacionalExcelBlob(
          exportData.colunas,
          exportData.linhas,
          exportData.resumo,
          {
            titulo: item.titulo,
            periodoLabel,
            ano,
            areaLabel,
          },
        )
        anexos.push({
          filename,
          content_base64: await blobToDataUrl(blob),
          content_type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      }

      openReport({
        indicador: titulo,
        modulo,
        ano,
        mes: mesParaReport,
        area,
        anexos,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao preparar o racional')
    } finally {
      setReportando(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 gap-1.5 border-rose-200 bg-white text-xs font-semibold text-rose-700 shadow-sm hover:border-rose-300 hover:bg-rose-50',
        className,
      )}
      disabled={reportando}
      onClick={() => void handleReportar()}
    >
      {reportando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Bug className="h-3.5 w-3.5" aria-hidden />
      )}
      Reportar Inconsistência
    </Button>
  )
}
