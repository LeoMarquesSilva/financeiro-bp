import { elementToPngBlob } from '@/shared/utils/copyChartImage'

/** Converte Blob PNG em data URL base64. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler screenshot'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Captura a área principal do app (main) ou o documento como fallback.
 * Usa o mesmo pipeline SVG/foreignObject do export de gráficos.
 */
export async function captureViewportScreenshot(): Promise<string | null> {
  try {
    const target =
      document.querySelector<HTMLElement>('main') ??
      document.querySelector<HTMLElement>('[data-error-report-root]') ??
      document.body
    if (!target) return null
    const blob = await elementToPngBlob(target, 1.25)
    if (blob.size > 2_400_000) {
      // Rebaixa escala se ficou grande demais para o payload da edge.
      const smaller = await elementToPngBlob(target, 0.85)
      return blobToDataUrl(smaller)
    }
    return blobToDataUrl(blob)
  } catch {
    return null
  }
}
