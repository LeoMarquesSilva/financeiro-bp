import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSearch, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { eficienciaService } from '../services/eficienciaService'
import { exportRacionalExcel } from '../utils/racionalExport'
import { formatRacionalCell, formatRacionalResumoLabel, isRacionalLinhaForaMeta, racionalLinhaForaMetaTitle } from '../utils/racionalFormat'
import { formatRacionalPeriodoLabel } from '../utils/racionalQuery'
import {
  atingiuMetaKpi,
  resolveMetaTexto,
  resultadoKpiBadgeClass,
} from '../utils/overviewKpiMeta'
import type { MesFiltroEficiencia } from '../constants'
import type { RacionalColuna, RacionalEscopo, RacionalIndicador } from '../types/eficiencia.types'
import { toPriMaiuscula } from '../utils/textFormat'
import type { HeatCell } from './OverviewKpiHeatRow'

type Props = {
  indicador: RacionalIndicador | null
  titulo: string
  ano: number
  mes?: MesFiltroEficiencia
  area: string | null
  /** Recorte da base (ex.: só FATAL não-excludente dos gráficos de ranking). */
  escopo?: RacionalEscopo
  /** Gestão individual — filtra pela coluna de responsável do indicador. */
  responsavel?: string | null
  /** Valor exibido na coluna Acum. da Overview (mesmos filtros). */
  resultado?: HeatCell | null
  /** Meta usada na coluna Acum. da Overview (mesmos filtros). */
  metaAcumulado?: number | null
  metaLabel?: string
  onClose: () => void
}

export function RacionalSheet({
  indicador,
  titulo,
  ano,
  mes = null,
  area,
  escopo = 'default',
  responsavel = null,
  resultado = null,
  metaAcumulado = null,
  metaLabel,
  onClose,
}: Props) {
  const [exportando, setExportando] = useState(false)
  const fatalEscopo = escopo === 'sla_protocolo_fatal'

  const { data, isLoading, error } = useQuery({
    queryKey: ['eficiencia', 'racional', indicador, ano, mes, area, escopo, responsavel],
    queryFn: () =>
      eficienciaService.fetchRacional(indicador as RacionalIndicador, ano, area, mes, escopo, {
        responsavel,
      }),
    enabled: indicador != null,
  })
  const colunas: RacionalColuna[] = data?.colunas ?? []
  const linhas: Array<Record<string, unknown>> = data?.linhas ?? []
  const truncado = data?.truncado ?? false
  const resumo = data?.resumo
  const resumoLabel = resumo != null ? formatRacionalResumoLabel(resumo) : null
  const periodoLabel = formatRacionalPeriodoLabel(ano, mes)
  const areaLabel = area ?? 'todas as áreas'
  const responsavelLabel = responsavel?.trim() || null
  const metaTexto =
    !fatalEscopo && metaAcumulado != null
      ? resolveMetaTexto(metaAcumulado, metaLabel)
      : null
  const atingiuMeta =
    !fatalEscopo && metaAcumulado != null && resultado != null
      ? atingiuMetaKpi(resultado.value, metaAcumulado)
      : null

  const exportMeta = {
    titulo,
    periodoLabel,
    ano,
    areaLabel,
    metaTexto: metaTexto ?? undefined,
    resultadoLabel: !fatalEscopo ? resultado?.label : undefined,
  }

  async function handleExportar() {
    if (indicador == null || exportando) return

    setExportando(true)
    try {
      const exportData = await eficienciaService.fetchRacionalParaExport(
        indicador,
        ano,
        area,
        mes,
        escopo,
        responsavel,
      )
      await exportRacionalExcel(exportData.colunas, exportData.linhas, exportData.resumo, exportMeta)
    } finally {
      setExportando(false)
    }
  }

  return (
    <Sheet open={indicador != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-4xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <SheetTitle className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 shrink-0" />
                {toPriMaiuscula(`Racional — ${titulo}`)}
              </SheetTitle>
              <SheetDescription className="space-y-1">
                <span>
                  {fatalEscopo
                    ? `FATAL não-excludente (mesma base do gráfico) · ${periodoLabel} · ${areaLabel}`
                    : indicador === 'sla_protocolo'
                      ? `Base do KPI + Excludentes (fora da %) · ${periodoLabel} · ${areaLabel}`
                      : `Mesma base do KPI · ${periodoLabel} · ${areaLabel}`}
                  {responsavelLabel ? ` · ${responsavelLabel}` : ''}
                </span>
                {!fatalEscopo && (metaTexto != null || resultado != null) && (
                  <span className="flex flex-wrap items-center gap-2 pt-0.5">
                    {metaTexto != null && (
                      <span className="inline-flex rounded px-2 py-0.5 text-sm font-semibold text-emerald-600">
                        {metaTexto}
                      </span>
                    )}
                    {resultado != null && (
                      <span
                        className={cn(
                          'inline-flex rounded px-2 py-0.5 text-sm font-semibold',
                          resultadoKpiBadgeClass(atingiuMeta),
                        )}
                      >
                        Resultado: {resultado.label}
                      </span>
                    )}
                  </span>
                )}
                {resumoLabel != null && !isLoading && (
                  <span className="block pt-0.5 text-xs font-medium text-slate-600">
                    {resumoLabel}
                  </span>
                )}
              </SheetDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={isLoading || exportando || linhas.length === 0}
                onClick={() => void handleExportar()}
              >
                {exportando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Excel
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-rose-600">
              Erro ao carregar o detalhamento.
            </p>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhuma linha encontrada para este período/área.
            </p>
          ) : (
            <>
              {truncado && (
                <p className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Mostrando as {linhas.length} linhas mais recentes (a base tem mais registros). O
                  Excel exporta a base completa.
                </p>
              )}
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    {colunas.map((c) => (
                      <th key={c.key} className="whitespace-nowrap py-2 pr-4 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {linhas.map((row, i) => {
                    const foraMeta =
                      indicador != null && isRacionalLinhaForaMeta(indicador, row)
                    const foraMetaTitle =
                      indicador != null ? racionalLinhaForaMetaTitle(indicador) : undefined
                    return (
                      <tr
                        key={i}
                        className={cn(
                          'text-slate-700',
                          foraMeta && 'bg-amber-50/80 text-slate-500',
                        )}
                        title={foraMeta ? foraMetaTitle : undefined}
                      >
                        {colunas.map((c) => (
                          <td key={c.key} className="whitespace-nowrap py-1.5 pr-4">
                            {formatRacionalCell(row[c.key])}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
