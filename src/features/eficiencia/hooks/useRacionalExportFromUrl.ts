import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { eficienciaService } from '../services/eficienciaService'
import { exportRacionalExcel } from '../utils/racionalExport'
import { formatRacionalPeriodoLabel } from '../utils/racionalQuery'
import { MESES_EFICIENCIA } from '../constants'
import type { MesFiltroEficiencia } from '../constants'
import type { RacionalIndicador } from '../types/eficiencia.types'
import {
  RACIONAL_EXPORT_TITULO,
  receitaAreaKeyToEficienciaArea,
} from '../utils/racionalExportUrl'
import {
  clearPersistedRacionalExport,
  persistRacionalExportSearch,
  readRacionalExportParams,
} from '../utils/racionalExportParams'

function mesFiltroForIndicador(
  indicador: RacionalIndicador,
  mes: number,
): MesFiltroEficiencia {
  if (indicador === 'retencao_talentos') return null
  return [mes]
}

function periodoLabelFromMes(ano: number, mes: number): string {
  return `${String(mes).padStart(2, '0')}/${ano}`
}

function stripRacionalExportFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('racionalExport')
  url.searchParams.delete('ano')
  url.searchParams.delete('mes')
  url.searchParams.delete('areaKey')
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState({}, '', next || url.pathname)
}

/**
 * Dispara download do racional quando a URL (ou sessionStorage) contém ?racionalExport=…
 * Links do e-mail de gestão à vista.
 */
export function useRacionalExportFromUrl(authReady: boolean): void {
  const started = useRef(false)

  useEffect(() => {
    if (!authReady || started.current) return

    persistRacionalExportSearch(window.location.search)
    const parsed = readRacionalExportParams()
    if (!parsed) return

    started.current = true
    stripRacionalExportFromUrl()
    clearPersistedRacionalExport()

    const { indicador, ano, mes, areaKey } = parsed
    const mesFiltro = mesFiltroForIndicador(indicador, mes)
    const area = receitaAreaKeyToEficienciaArea(areaKey)

    const titulo = RACIONAL_EXPORT_TITULO[indicador] ?? indicador
    const periodoLabel =
      indicador === 'retencao_talentos'
        ? formatRacionalPeriodoLabel(ano, null)
        : periodoLabelFromMes(ano, mes)
    const areaLabel = area ?? (areaKey ? areaKey : 'todas as áreas')
    const mesNome = MESES_EFICIENCIA[mes - 1] ?? periodoLabel

    void (async () => {
      const toastId = toast.loading(`Gerando racional — ${titulo} (${mesNome}/${ano})…`)
      try {
        const exportData = await eficienciaService.fetchRacionalParaExport(
          indicador,
          ano,
          area,
          mesFiltro,
        )
        await exportRacionalExcel(exportData.colunas, exportData.linhas, exportData.resumo, {
          titulo,
          periodoLabel,
          ano,
          areaLabel,
        })
        toast.success('Racional baixado.', { id: toastId })
      } catch (err) {
        console.error(err)
        toast.error('Não foi possível baixar o racional. Tente pelo SIOE.', { id: toastId })
      }
    })()
  }, [authReady])
}

/** Compat — captura antecipada está em main.tsx; mantido para chamadas legadas. */
export function useCaptureRacionalExportFromUrl(): void {
  useEffect(() => {
    persistRacionalExportSearch(window.location.search)
  }, [])
}
