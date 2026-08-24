const DEFAULT_SCALE = 2
const LEGEND_GAP = 12
const EXPORT_TABLE_GAP = 16
const EXPORT_TEXT_COLOR = '#000000'
const LEGEND_FONT = '600 11px system-ui, -apple-system, sans-serif'
const LEGEND_PAD_X = 10
const LEGEND_PAD_Y = 4
const LEGEND_ITEM_GAP = 8
const LEGEND_SWATCH_GAP = 6
const LEGEND_ROW_GAP = 6
const KEEP_WHITE_FILLS = new Set(['#fff', '#ffffff', 'white', 'rgb(255, 255, 255)', 'rgb(255,255,255)'])

/** Cache de URL → data URL para não re-baixar a cada cópia. */
const exportImageDataUrlCache = new Map<string, string | null>()

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler imagem'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Converte URL de imagem em data URL (necessário para SVG/foreignObject no clipboard —
 * hrefs externos viram ícone quebrado no PowerPoint).
 */
async function urlToExportDataUrl(url: string): Promise<string | null> {
  if (!url || url.startsWith('data:')) return url || null
  if (exportImageDataUrlCache.has(url)) return exportImageDataUrlCache.get(url) ?? null

  let absolute = url
  try {
    absolute = new URL(url, window.location.href).href
  } catch {
    /* mantém url */
  }

  let dataUrl: string | null = null

  try {
    const res = await fetch(absolute, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    if (res.ok) {
      dataUrl = await blobToDataUrl(await res.blob())
    }
  } catch {
    /* tenta via Image */
  }

  if (!dataUrl) {
    dataUrl = await new Promise<string | null>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const timer = window.setTimeout(() => resolve(null), 5000)
      img.onload = () => {
        window.clearTimeout(timer)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, img.naturalWidth || 64)
          canvas.height = Math.max(1, img.naturalHeight || 64)
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => {
        window.clearTimeout(timer)
        resolve(null)
      }
      img.src = absolute
    })
  }

  exportImageDataUrlCache.set(url, dataUrl)
  if (absolute !== url) exportImageDataUrlCache.set(absolute, dataUrl)
  return dataUrl
}

/**
 * Embute &lt;img&gt; e SVG &lt;image&gt; como data URL no clone de exportação.
 * Se a URL não puder ser lida (CORS), remove o nó para não colar ícone quebrado no PPT.
 */
async function inlineRasterImagesForExport(root: ParentNode): Promise<void> {
  const htmlImgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    htmlImgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src || src.startsWith('data:')) return
      const dataUrl = await urlToExportDataUrl(src)
      if (dataUrl) {
        img.setAttribute('src', dataUrl)
        img.removeAttribute('srcset')
      } else {
        img.remove()
      }
    }),
  )

  const svgImgs = Array.from(root.querySelectorAll('image'))
  const xlinkNs = 'http://www.w3.org/1999/xlink'
  await Promise.all(
    svgImgs.map(async (img) => {
      const href =
        img.getAttribute('href') ||
        img.getAttributeNS(xlinkNs, 'href') ||
        img.getAttribute('xlink:href')
      if (!href || href.startsWith('data:')) return
      const dataUrl = await urlToExportDataUrl(href)
      if (dataUrl) {
        img.setAttribute('href', dataUrl)
        img.setAttributeNS(xlinkNs, 'href', dataUrl)
      } else {
        img.remove()
      }
    }),
  )
}

function shouldKeepTextFill(fill: string | null): boolean {
  const normalized = (fill ?? '').trim().toLowerCase()
  return KEEP_WHITE_FILLS.has(normalized)
}

function applyExportTextColors(svg: SVGSVGElement): void {
  svg.querySelectorAll('text, tspan').forEach((node) => {
    const el = node as SVGElement
    if (shouldKeepTextFill(el.getAttribute('fill'))) return
    el.setAttribute('fill', EXPORT_TEXT_COLOR)
  })
}

function findChartSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg.recharts-surface') ?? container.querySelector('svg')
}

async function loadImageFromSvgString(svgString: string): Promise<HTMLImageElement> {
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Falha ao processar imagem'))
    img.src = dataUrl
  })
  return img
}

async function svgElementToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const rect = svg.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)

  if (width === 0 || height === 0) {
    throw new Error('Gráfico ainda não renderizado')
  }

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.background = 'transparent'
  applyExportTextColors(clone)
  await inlineRasterImagesForExport(clone)

  const serialized = new XMLSerializer().serializeToString(clone)
  return loadImageFromSvgString(serialized)
}

type LegendShape = 'bar' | 'line'

type LegendItem = {
  label: string
  color: string
  shape: LegendShape
}

function isLegendEntry(el: HTMLElement): boolean {
  if (el.hasAttribute('data-chart-export-ignore')) return false
  if (el.tagName === 'BUTTON') {
    return el.getAttribute('aria-pressed') !== 'false'
  }
  return el.tagName === 'SPAN' && el.classList.contains('inline-flex')
}

function getLegendLabel(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('span, svg').forEach((node) => node.remove())
  return clone.textContent?.trim() ?? ''
}

function getLegendSwatch(el: HTMLElement): HTMLElement | null {
  return (
    el.querySelector<HTMLElement>('[data-chart-legend-swatch]') ??
    el.querySelector<HTMLElement>('span[style*="background"]') ??
    el.querySelector<HTMLElement>('span.rounded-sm, span.rounded-full')
  )
}

function parseLegendColor(el: HTMLElement): string {
  const swatch = getLegendSwatch(el)
  if (!swatch) return '#64748b'

  const inline = swatch.style.backgroundColor
  if (inline && inline !== 'transparent') return inline

  const computed = window.getComputedStyle(swatch).backgroundColor
  if (computed && computed !== 'transparent' && computed !== 'rgba(0, 0, 0, 0)') {
    return computed
  }

  return '#64748b'
}

function parseLegendShape(el: HTMLElement): LegendShape {
  const swatch = getLegendSwatch(el)
  if (!swatch) return 'bar'

  const className = swatch.className
  if (className.includes('h-0.5') || (className.includes('w-3') && className.includes('rounded-full'))) {
    return 'line'
  }
  return 'bar'
}

function collectLegendItems(legendEl: HTMLElement): LegendItem[] {
  const items: LegendItem[] = []
  const seen = new Set<string>()

  legendEl.querySelectorAll<HTMLElement>('button, span.inline-flex').forEach((node) => {
    if (!legendEl.contains(node)) return
    if (node.closest('[data-chart-export-ignore]')) return
    if (node.tagName === 'SPAN' && node.closest('button')) return
    if (!isLegendEntry(node)) return

    const label = getLegendLabel(node)
    if (!label || seen.has(label)) return
    seen.add(label)

    items.push({
      label,
      color: parseLegendColor(node),
      shape: parseLegendShape(node),
    })
  })

  return items
}

type LegendLayout = {
  width: number
  height: number
  rows: { items: LegendItem[]; width: number }[]
}

function measureLegend(ctx: CanvasRenderingContext2D, items: LegendItem[], maxWidth: number): LegendLayout {
  ctx.font = LEGEND_FONT

  const measureItem = (item: LegendItem) => {
    const swatchW = item.shape === 'line' ? 12 : 10
    const textW = ctx.measureText(item.label).width
    return LEGEND_PAD_X * 2 + swatchW + LEGEND_SWATCH_GAP + textW
  }

  const rows: { items: LegendItem[]; width: number }[] = []
  let currentRow: LegendItem[] = []
  let currentWidth = 0

  for (const item of items) {
    const itemWidth = measureItem(item)
    const gap = currentRow.length > 0 ? LEGEND_ITEM_GAP : 0

    if (currentRow.length > 0 && currentWidth + gap + itemWidth > maxWidth) {
      rows.push({ items: currentRow, width: currentWidth })
      currentRow = [item]
      currentWidth = itemWidth
    } else {
      currentRow.push(item)
      currentWidth += gap + itemWidth
    }
  }

  if (currentRow.length > 0) {
    rows.push({ items: currentRow, width: currentWidth })
  }

  const rowHeight = LEGEND_PAD_Y * 2 + 12
  const height =
    rows.length > 0
      ? rows.length * rowHeight + Math.max(0, rows.length - 1) * LEGEND_ROW_GAP
      : 0
  const width = Math.max(maxWidth, ...rows.map((row) => row.width), 0)

  return { width, height, rows }
}

function drawLegendSwatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  shape: LegendShape,
): void {
  const centerY = y + LEGEND_PAD_Y + 6

  if (shape === 'line') {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, centerY)
    ctx.lineTo(x + 12, centerY)
    ctx.stroke()
    return
  }

  ctx.fillStyle = color
  const size = 10
  const radius = 2
  const top = centerY - size / 2
  ctx.beginPath()
  ctx.moveTo(x + radius, top)
  ctx.lineTo(x + size - radius, top)
  ctx.quadraticCurveTo(x + size, top, x + size, top + radius)
  ctx.lineTo(x + size, top + size - radius)
  ctx.quadraticCurveTo(x + size, top + size, x + size - radius, top + size)
  ctx.lineTo(x + radius, top + size)
  ctx.quadraticCurveTo(x, top + size, x, top + size - radius)
  ctx.lineTo(x, top + radius)
  ctx.quadraticCurveTo(x, top, x + radius, top)
  ctx.closePath()
  ctx.fill()
}

function drawLegendItems(
  ctx: CanvasRenderingContext2D,
  items: LegendItem[],
  offsetX: number,
  offsetY: number,
  maxWidth: number,
): number {
  if (items.length === 0) return 0

  const layout = measureLegend(ctx, items, maxWidth)
  const rowHeight = LEGEND_PAD_Y * 2 + 12
  let y = offsetY

  ctx.font = LEGEND_FONT
  ctx.textBaseline = 'middle'
  ctx.fillStyle = EXPORT_TEXT_COLOR

  for (const row of layout.rows) {
    let x = offsetX + (maxWidth - row.width) / 2

    for (const item of row.items) {
      const swatchW = item.shape === 'line' ? 12 : 10
      const textW = ctx.measureText(item.label).width
      const itemWidth = LEGEND_PAD_X * 2 + swatchW + LEGEND_SWATCH_GAP + textW

      drawLegendSwatch(ctx, x + LEGEND_PAD_X, y, item.color, item.shape)
      ctx.fillStyle = EXPORT_TEXT_COLOR
      ctx.fillText(
        item.label,
        x + LEGEND_PAD_X + swatchW + LEGEND_SWATCH_GAP,
        y + rowHeight / 2,
      )

      x += itemWidth + LEGEND_ITEM_GAP
    }

    y += rowHeight + LEGEND_ROW_GAP
  }

  return layout.height
}

async function compositeToPngBlob(
  legendEl: HTMLElement | null,
  plotEl: HTMLElement,
  scale = DEFAULT_SCALE,
): Promise<Blob> {
  const svg = findChartSvg(plotEl)
  if (!svg) throw new Error('Gráfico não encontrado')

  const plotRect = plotEl.getBoundingClientRect()
  const plotHeight = Math.ceil(plotRect.height)
  const plotWidth = Math.ceil(plotRect.width)
  const legendItems = legendEl ? collectLegendItems(legendEl) : []

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Canvas não suportado neste navegador')

  const legendHeight =
    legendItems.length > 0 ? measureLegend(measureCtx, legendItems, plotWidth).height : 0
  const gap = legendHeight > 0 ? LEGEND_GAP : 0
  const totalWidth = plotWidth
  const totalHeight = plotHeight + gap + legendHeight

  const plotImg = await svgElementToImage(svg)

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth * scale
  canvas.height = totalHeight * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)

  ctx.drawImage(plotImg, 0, 0, plotWidth, plotHeight)

  if (legendItems.length > 0) {
    drawLegendItems(ctx, legendItems, 0, plotHeight + gap, totalWidth)
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem PNG'))),
      'image/png',
    )
  })
}

function isStyleableElement(el: Element): el is HTMLElement | SVGElement {
  return el instanceof HTMLElement || el instanceof SVGElement
}

function inlineNodeStyles(source: Element, target: Element): void {
  if (!isStyleableElement(source) || !isStyleableElement(target)) return

  const computed = window.getComputedStyle(source)
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i]
    target.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop))
  }

  if (source instanceof SVGSVGElement && target instanceof SVGSVGElement) {
    const rect = source.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(rect.width || parseFloat(computed.width) || 0))
    const height = Math.max(1, Math.ceil(rect.height || parseFloat(computed.height) || 0))
    target.setAttribute('width', String(width))
    target.setAttribute('height', String(height))
    target.style.setProperty('width', `${width}px`, 'important')
    target.style.setProperty('height', `${height}px`, 'important')
  }

  for (let i = 0; i < source.children.length; i++) {
    const targetChild = target.children[i]
    if (targetChild) inlineNodeStyles(source.children[i], targetChild)
  }
}

function isTransparentCssColor(value: string): boolean {
  const v = value.trim().toLowerCase()
  return (
    !v ||
    v === 'transparent' ||
    v === 'rgba(0, 0, 0, 0)' ||
    v === 'rgba(0,0,0,0)' ||
    v === 'none'
  )
}

function isColorSwatch(el: HTMLElement): boolean {
  const inline = el.style.backgroundColor || el.style.backgroundImage || el.style.background
  if (inline && !isTransparentCssColor(inline) && !inline.includes('gradient')) {
    // background shorthand com cor sólida
    if (el.style.backgroundColor || /^#|^rgb|^hsl/i.test(inline.trim())) return true
  }
  if (el.style.backgroundColor && !isTransparentCssColor(el.style.backgroundColor)) return true
  const bg = window.getComputedStyle(el).backgroundColor
  return !isTransparentCssColor(bg)
}

type HtmlExportOptions = {
  preserveBackground?: boolean
}

function resolveHtmlExportOptions(
  source: HTMLElement,
  options?: HtmlExportOptions,
): Required<HtmlExportOptions> {
  return {
    preserveBackground:
      options?.preserveBackground ?? source.hasAttribute('data-chart-export-preserve-bg'),
  }
}

function applyExportHtmlColors(root: HTMLElement, preserveRootBackground = false): void {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (preserveRootBackground && el === root) return
    if (isColorSwatch(el)) return
    const bg = window.getComputedStyle(el).backgroundColor
    if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      el.style.setProperty('background', 'transparent', 'important')
    }
  })

  root.querySelectorAll<HTMLElement>('p, span, li, div, td, th, button, h1, h2, h3, h4, h5, h6').forEach((el) => {
    if (isColorSwatch(el)) return
    el.style.setProperty('color', EXPORT_TEXT_COLOR, 'important')
  })

  root.querySelectorAll<HTMLElement>('button').forEach((btn) => {
    btn.style.setProperty('background', 'transparent', 'important')
    btn.style.setProperty('border', 'none', 'important')
    btn.style.setProperty('box-shadow', 'none', 'important')
    btn.style.setProperty('padding', '0', 'important')
    btn.style.setProperty('cursor', 'default', 'important')
  })
}

function applyExportLayoutFixes(root: HTMLElement): void {
  root.style.setProperty('width', 'max-content', 'important')
  root.style.setProperty('min-width', 'max-content', 'important')
  root.style.setProperty('max-width', 'none', 'important')
  root.style.setProperty('overflow', 'visible', 'important')

  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.setProperty('overflow', 'visible', 'important')
    el.style.setProperty('text-overflow', 'clip', 'important')
    el.style.setProperty('white-space', 'normal', 'important')
    el.style.setProperty('word-break', 'normal', 'important')
    el.style.setProperty('max-width', 'none', 'important')
    el.style.setProperty('min-width', 'auto', 'important')
    el.style.setProperty('-webkit-line-clamp', 'unset', 'important')
    el.style.setProperty('line-clamp', 'unset', 'important')
  })

  root.querySelectorAll<HTMLElement>('table').forEach((table) => {
    table.style.setProperty('border-collapse', 'collapse', 'important')
    table.style.setProperty('width', '100%', 'important')
  })

  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    if (cell.closest('[data-overview-copy-card]')) return
    cell.style.setProperty('vertical-align', 'top', 'important')
    cell.style.setProperty('padding-bottom', '10px', 'important')
  })

  root.querySelectorAll<HTMLElement>('[data-legend-item-value] p').forEach((p) => {
    p.style.setProperty('display', 'block', 'important')
    p.style.setProperty('margin', '0', 'important')
    p.style.setProperty('line-height', '1.35', 'important')
  })

  root.querySelectorAll<HTMLElement>('[data-legend-item-value] p + p').forEach((p) => {
    p.style.setProperty('margin-top', '2px', 'important')
  })

  root.querySelectorAll<HTMLElement>('li').forEach((li) => {
    li.style.setProperty('display', 'flex', 'important')
    li.style.setProperty('flex-wrap', 'nowrap', 'important')
    li.style.setProperty('align-items', 'flex-start', 'important')
    li.style.setProperty('gap', '16px', 'important')
    li.style.setProperty('margin-bottom', '6px', 'important')
  })

  root.querySelectorAll<HTMLElement>('ul').forEach((ul) => {
    ul.style.setProperty('display', 'block', 'important')
    ul.style.setProperty('line-height', '1.45', 'important')
  })

  root.querySelectorAll<HTMLElement>('.truncate, .line-clamp-2, .line-clamp-1').forEach((el) => {
    el.classList.remove('truncate', 'line-clamp-1', 'line-clamp-2')
  })

  root.querySelectorAll<HTMLElement>('span, p').forEach((el) => {
    if (el.closest('[data-legend-item-value]')) return
    if (el.closest('[data-legend-export] table')) return
    el.style.setProperty('flex-shrink', '0', 'important')
  })

  root.querySelectorAll<HTMLElement>('[data-legend-export] table td').forEach((cell) => {
    cell.style.setProperty('background', 'transparent', 'important')
    cell.style.setProperty('border-radius', '0', 'important')
    cell.style.setProperty('padding-left', '0', 'important')
    cell.style.setProperty('padding-right', '8px', 'important')
  })

  root.querySelectorAll<HTMLElement>('[data-legend-export] .inline-flex').forEach((el) => {
    el.style.setProperty('display', 'inline-flex', 'important')
    el.style.setProperty('align-items', 'flex-start', 'important')
    el.style.setProperty('gap', '8px', 'important')
  })
}

function stripInlineHeights(root: HTMLElement): void {
  root.style.removeProperty('height')
  root.style.removeProperty('min-height')
  root.style.removeProperty('max-height')
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.removeProperty('height')
    el.style.removeProperty('min-height')
    el.style.removeProperty('max-height')
  })
}

function shouldExpandExportWidth(source: HTMLElement): boolean {
  if (source.hasAttribute('data-chart-export-expand-width')) return true
  const table = source.querySelector('table')
  if (!table) return false
  const scrollHost = source.querySelector<HTMLElement>('.overflow-x-auto') ?? source
  return table.scrollWidth > scrollHost.clientWidth + 4
}

function shouldFitContentExport(source: HTMLElement): boolean {
  return source.hasAttribute('data-chart-export-fit-content')
}

function shouldFullScrollExport(source: HTMLElement): boolean {
  return source.hasAttribute('data-chart-export-full-scroll')
}

function shouldStackCardsExport(source: HTMLElement): boolean {
  return source.hasAttribute('data-chart-export-stack-cards')
}

/** foreignObject + `<button display:table>` esmaga o card (nome em cima da meta). */
function replaceButtonsWithDivs(root: HTMLElement): void {
  root.querySelectorAll('button').forEach((btn) => {
    const div = document.createElement('div')
    div.className = btn.className
    const style = btn.getAttribute('style')
    if (style) div.setAttribute('style', style)
    while (btn.firstChild) div.appendChild(btn.firstChild)
    btn.replaceWith(div)
  })
}

/**
 * Lista vertical de cards (treinamentos): trava a altura medida na tela e
 * não converte flex em table — o recorte para PPT fica igual ao painel.
 */
function prepareStackCardsExportElement(
  source: HTMLElement,
  options?: HtmlExportOptions,
): HTMLElement {
  const { preserveBackground } = resolveHtmlExportOptions(source, options)
  const clone = source.cloneNode(true) as HTMLElement
  inlineNodeStyles(source, clone)
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())
  replaceButtonsWithDivs(clone)

  const sourceCards = source.querySelectorAll<HTMLElement>('article')
  const cloneCards = clone.querySelectorAll<HTMLElement>('article')
  sourceCards.forEach((src, i) => {
    const dst = cloneCards[i]
    if (!dst) return
    const r = src.getBoundingClientRect()
    const h = Math.max(1, Math.ceil(r.height))
    dst.style.setProperty('height', `${h}px`, 'important')
    dst.style.setProperty('min-height', `${h}px`, 'important')
    dst.style.setProperty('max-height', `${h}px`, 'important')
    dst.style.setProperty('width', '100%', 'important')
    dst.style.setProperty('box-sizing', 'border-box', 'important')
    dst.style.setProperty('overflow', 'hidden', 'important')
    dst.style.setProperty('display', 'block', 'important')
  })

  const sourceStyle = window.getComputedStyle(source)
  const fixedWidth = Math.max(1, Math.ceil(source.getBoundingClientRect().width))

  if (preserveBackground) {
    const explicitBg = source.getAttribute('data-chart-export-bg')
    const bg =
      explicitBg ||
      source.style.backgroundColor ||
      sourceStyle.backgroundColor ||
      sourceStyle.background
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      clone.style.setProperty('background', bg, 'important')
    } else {
      clone.style.setProperty('background', '#ffffff', 'important')
    }
    clone.style.setProperty('border-radius', sourceStyle.borderRadius, 'important')
  }

  clone.style.setProperty('margin', '0', 'important')
  clone.style.setProperty('padding', sourceStyle.padding, 'important')
  clone.style.setProperty('box-sizing', 'border-box', 'important')
  clone.style.setProperty('position', 'static', 'important')
  clone.style.setProperty('display', 'block', 'important')
  clone.style.setProperty('outline', 'none', 'important')
  clone.style.setProperty('width', `${fixedWidth}px`, 'important')
  clone.style.setProperty('min-width', `${fixedWidth}px`, 'important')
  clone.style.setProperty('max-width', `${fixedWidth}px`, 'important')
  clone.style.setProperty('height', 'auto', 'important')
  clone.style.setProperty('min-height', '0', 'important')
  clone.style.setProperty('max-height', 'none', 'important')
  clone.style.setProperty('overflow', 'visible', 'important')
  clone.style.setProperty('flex', 'none', 'important')
  return clone
}

function shouldInlineRowCardExport(source: HTMLElement): boolean {
  return source.hasAttribute('data-chart-export-inline-row')
}

function shouldPrintSnapshotExport(source: HTMLElement): boolean {
  if (!source.hasAttribute('data-chart-export-preserve-bg')) return false
  if (shouldExpandExportWidth(source)) return false
  if (shouldFitContentExport(source)) return false
  if (shouldFullScrollExport(source)) return false
  return true
}

/** foreignObject não respeita flex — inline-block com dimensões medidas na tela. */
function applyPrintFlexRowFix(root: HTMLElement, source: HTMLElement): void {
  const sourceStyle = window.getComputedStyle(source)
  const gap = parseFloat(sourceStyle.gap || sourceStyle.columnGap) || 0
  const sourceChildren = Array.from(source.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.hasAttribute('data-chart-export-ignore'),
  )
  const rootChildren = Array.from(root.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.hasAttribute('data-chart-export-ignore'),
  )

  root.style.setProperty('display', 'block', 'important')
  root.style.setProperty('white-space', 'nowrap', 'important')
  root.style.setProperty('font-size', '0', 'important')
  root.style.setProperty('line-height', '0', 'important')

  rootChildren.forEach((child, index) => {
    const sourceChild = sourceChildren[index]
    if (!sourceChild) return

    const childStyle = window.getComputedStyle(sourceChild)
    const childRect = sourceChild.getBoundingClientRect()
    child.style.setProperty('display', 'inline-block', 'important')
    child.style.setProperty('vertical-align', 'middle', 'important')
    child.style.setProperty('white-space', 'normal', 'important')
    child.style.setProperty('font-size', childStyle.fontSize, 'important')
    child.style.setProperty('line-height', childStyle.lineHeight, 'important')
    child.style.setProperty('width', `${Math.ceil(childRect.width)}px`, 'important')
    child.style.setProperty('height', `${Math.ceil(childRect.height)}px`, 'important')
    child.style.setProperty('box-sizing', 'border-box', 'important')

    if (index > 0 && gap > 0) {
      child.style.setProperty('margin-left', `${gap}px`, 'important')
    }

    if (isFixedSizeIcon(sourceChild)) {
      child.style.setProperty('display', 'inline-flex', 'important')
      child.style.setProperty('align-items', 'center', 'important')
      child.style.setProperty('justify-content', 'center', 'important')
      child.style.setProperty('border-radius', childStyle.borderRadius, 'important')
      child.style.setProperty('overflow', 'hidden', 'important')
    }
  })
}

/** Clone fiel ao que está na tela — sem redimensionar, só remove nós ignorados. */
function preparePrintSnapshotElement(source: HTMLElement, options?: HtmlExportOptions): HTMLElement {
  const { preserveBackground } = resolveHtmlExportOptions(source, options)
  const clone = source.cloneNode(true) as HTMLElement
  inlineNodeStyles(source, clone)
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())

  const sourceStyle = window.getComputedStyle(source)
  const rect = source.getBoundingClientRect()
  const compactList = source.hasAttribute('data-chart-export-compact-list')
  const width = Math.max(1, Math.ceil(compactList ? Math.min(rect.width, 900) : rect.width))
  const height = Math.max(1, Math.ceil(rect.height))

  if (preserveBackground) {
    const explicitBg = source.getAttribute('data-chart-export-bg')
    const bg =
      explicitBg ||
      source.style.backgroundColor ||
      sourceStyle.backgroundColor ||
      sourceStyle.background
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      clone.style.setProperty('background', bg, 'important')
    }
    clone.style.setProperty('border', sourceStyle.border, 'important')
    clone.style.setProperty('border-radius', sourceStyle.borderRadius, 'important')
    clone.style.setProperty('box-shadow', sourceStyle.boxShadow, 'important')
  }

  clone.style.setProperty('margin', '0', 'important')
  clone.style.setProperty('padding', sourceStyle.padding, 'important')
  clone.style.setProperty('box-sizing', 'border-box', 'important')
  clone.style.setProperty('width', `${width}px`, 'important')
  clone.style.setProperty('min-width', `${width}px`, 'important')
  clone.style.setProperty('max-width', `${width}px`, 'important')
  clone.style.setProperty('height', `${height}px`, 'important')
  clone.style.setProperty('min-height', `${height}px`, 'important')
  clone.style.setProperty('max-height', `${height}px`, 'important')
  clone.style.setProperty('overflow', 'hidden', 'important')
  clone.style.setProperty('position', 'static', 'important')
  clone.style.setProperty('outline', 'none', 'important')

  if (compactList) {
    clone.querySelectorAll<HTMLElement>('ul').forEach((list) => {
      list.style.setProperty('width', '100%', 'important')
      list.style.setProperty('max-width', 'none', 'important')
    })
    clone.querySelectorAll<HTMLElement>('ul > li').forEach((row) => {
      const cells = Array.from(row.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      )
      row.style.setProperty('display', 'flex', 'important')
      row.style.setProperty('align-items', 'center', 'important')
      row.style.setProperty('justify-content', 'flex-start', 'important')
      row.style.setProperty('gap', '24px', 'important')
      row.style.setProperty('width', '100%', 'important')
      row.style.setProperty('box-sizing', 'border-box', 'important')

      const person = cells[0]
      if (person) {
        person.style.setProperty('flex', '0 1 620px', 'important')
        person.style.setProperty('width', '620px', 'important')
        person.style.setProperty('max-width', '620px', 'important')
        person.style.setProperty('min-width', '0', 'important')
      }

      const tenure = cells[1]
      if (tenure) {
        tenure.style.setProperty('flex', '0 0 160px', 'important')
        tenure.style.setProperty('width', '160px', 'important')
        tenure.style.setProperty('min-width', '160px', 'important')
        tenure.style.setProperty('max-width', '160px', 'important')
        tenure.style.setProperty('text-align', 'left', 'important')
      }
    })
  } else {
    const display = sourceStyle.display
    if (display === 'flex' || display === 'inline-flex') {
      applyPrintFlexRowFix(clone, source)
    }
    applyNestedFlexExportFix(clone, source, {
      skipRoot: display === 'flex' || display === 'inline-flex',
    })
  }

  return clone
}

function exportChildElements(el: HTMLElement, skipIgnore: boolean): HTMLElement[] {
  return Array.from(el.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false
    if (skipIgnore && child.hasAttribute('data-chart-export-ignore')) return false
    return true
  })
}

function isFlexRow(style: CSSStyleDeclaration): boolean {
  if (style.display !== 'flex' && style.display !== 'inline-flex') return false
  return style.flexDirection === 'row' || style.flexDirection === 'row-reverse'
}

function isFlexColumn(style: CSSStyleDeclaration): boolean {
  if (style.display !== 'flex' && style.display !== 'inline-flex') return false
  return style.flexDirection === 'column' || style.flexDirection === 'column-reverse'
}

function shouldSkipFlexExportFix(sourceEl: HTMLElement): boolean {
  if (isFixedSizeIcon(sourceEl)) return true
  const rect = sourceEl.getBoundingClientRect()
  if (rect.width <= 48 && rect.height <= 48 && sourceEl.querySelector('svg') != null) {
    return true
  }
  return false
}

/** Texto solto + badge no mesmo flex vira célula anônima no table — isola o texto. */
function wrapLooseTextNodes(el: HTMLElement): void {
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return
    const text = node.textContent ?? ''
    if (!text.trim()) return
    const span = document.createElement('span')
    span.textContent = text
    el.replaceChild(span, node)
  })
}

/** SVG (lucide) não é HTMLElement — sem wrap vira célula anônima e o título foge para a direita. */
function wrapSvgChildren(el: HTMLElement): void {
  Array.from(el.children).forEach((child) => {
    if (!(child instanceof SVGElement) || child instanceof HTMLElement) return
    const wrap = document.createElement('span')
    wrap.setAttribute('data-chart-export-icon-wrap', '')
    wrap.className = 'shrink-0'
    child.replaceWith(wrap)
    wrap.appendChild(child)
  })
}

function isPackedFlexJustify(justify: string): boolean {
  return (
    justify === 'flex-start' ||
    justify === 'start' ||
    justify === 'normal' ||
    justify === 'left' ||
    justify === ''
  )
}

function applyFlexColumnToBlock(cloneEl: HTMLElement): void {
  cloneEl.style.setProperty('display', 'block', 'important')
  cloneEl.style.setProperty('height', 'auto', 'important')
  cloneEl.style.setProperty('min-height', '0', 'important')
  cloneEl.style.setProperty('max-height', 'none', 'important')

  exportChildElements(cloneEl, false).forEach((child) => {
    child.style.setProperty('flex', 'none', 'important')
    child.style.setProperty('height', 'auto', 'important')
    child.style.setProperty('max-height', 'none', 'important')
    child.style.setProperty('width', '100%', 'important')
    child.style.setProperty('max-width', '100%', 'important')
  })
}

function applyFlexRowToTable(cloneEl: HTMLElement, sourceStyle: CSSStyleDeclaration): void {
  wrapLooseTextNodes(cloneEl)
  wrapSvgChildren(cloneEl)

  const gap = parseFloat(sourceStyle.columnGap || sourceStyle.gap) || 0
  const justify = sourceStyle.justifyContent
  const align = sourceStyle.alignItems
  const packed = isPackedFlexJustify(justify)

  cloneEl.style.setProperty('display', packed ? 'inline-table' : 'table', 'important')
  cloneEl.style.setProperty('width', packed ? 'auto' : '100%', 'important')
  cloneEl.style.setProperty('max-width', '100%', 'important')
  cloneEl.style.setProperty('height', 'auto', 'important')
  cloneEl.style.setProperty('table-layout', 'auto', 'important')
  cloneEl.style.setProperty('border-collapse', 'separate', 'important')
  cloneEl.style.setProperty('border-spacing', `${gap}px 0`, 'important')
  cloneEl.style.setProperty('white-space', 'normal', 'important')

  const verticalAlign =
    align === 'flex-start' || align === 'start'
      ? 'top'
      : align === 'flex-end' || align === 'end'
        ? 'bottom'
        : 'middle'

  const cloneChildren = exportChildElements(cloneEl, false)
  cloneChildren.forEach((child, index) => {
    const isLast = index === cloneChildren.length - 1
    const isFirst = index === 0

    child.style.setProperty('display', 'table-cell', 'important')
    child.style.setProperty('vertical-align', verticalAlign, 'important')

    if (justify === 'space-between' || justify === 'space-around' || justify === 'space-evenly') {
      if (isLast && !isFirst) {
        child.style.setProperty('text-align', 'right', 'important')
        child.style.setProperty('width', '1%', 'important')
        child.style.setProperty('white-space', 'nowrap', 'important')
      } else {
        child.style.setProperty('text-align', 'left', 'important')
      }
    } else if (justify === 'center') {
      child.style.setProperty('text-align', 'center', 'important')
    } else if (justify === 'flex-end' || justify === 'end') {
      child.style.setProperty('text-align', 'right', 'important')
    } else {
      child.style.setProperty('text-align', 'left', 'important')
      child.style.setProperty('width', 'auto', 'important')
    }

    if (child.classList.contains('shrink-0') || child.classList.contains('tabular-nums')) {
      child.style.setProperty('white-space', 'nowrap', 'important')
    }
  })
}

/**
 * foreignObject/SVG não calcula flex — linhas (rótulo + valor, badge) se sobrepõem.
 * Converte coluna → block e linha → table, medindo a árvore original.
 */
function applyNestedFlexExportFix(
  clone: HTMLElement,
  source: HTMLElement,
  options?: { skipRoot?: boolean },
): void {
  const skipRoot = options?.skipRoot ?? false

  const walk = (cloneEl: HTMLElement, sourceEl: HTMLElement, isRoot: boolean) => {
    if (!(isRoot && skipRoot) && !shouldSkipFlexExportFix(sourceEl)) {
      const style = window.getComputedStyle(sourceEl)
      if (isFlexColumn(style)) {
        applyFlexColumnToBlock(cloneEl)
      } else if (isFlexRow(style)) {
        applyFlexRowToTable(cloneEl, style)
        const sourceRowChildren = exportChildElements(sourceEl, true)
        const cloneRowChildren = exportChildElements(cloneEl, false).filter(
          (el) => !el.hasAttribute('data-chart-export-icon-wrap'),
        )
        const rowOffset = Math.max(
          0,
          cloneRowChildren.length - sourceRowChildren.length,
        )
        sourceRowChildren.forEach((sourceChild, index) => {
          const cloneChild = cloneRowChildren[index + rowOffset]
          if (cloneChild && isFixedSizeIcon(sourceChild)) {
            lockIconDimensions(cloneChild, sourceChild)
          }
        })
      }
    }

    const sourceChildren = exportChildElements(sourceEl, true)
    const cloneChildren = exportChildElements(cloneEl, false).filter(
      (el) => !el.hasAttribute('data-chart-export-icon-wrap'),
    )
    const offset = Math.max(0, cloneChildren.length - sourceChildren.length)
    const count = Math.min(sourceChildren.length, cloneChildren.length)
    for (let i = 0; i < count; i++) {
      walk(cloneChildren[i + offset], sourceChildren[i], false)
    }
  }

  walk(clone, source, true)
}

/** Painéis com scroll interno — largura fixa da tela, altura = conteúdo completo (sem fit-content reset). */
function applyFullScrollExportLayout(root: HTMLElement, fixedWidth: number): void {
  root.style.setProperty('width', `${fixedWidth}px`, 'important')
  root.style.setProperty('min-width', `${fixedWidth}px`, 'important')
  root.style.setProperty('max-width', `${fixedWidth}px`, 'important')
  root.style.setProperty('height', 'auto', 'important')
  root.style.setProperty('min-height', '0', 'important')
  root.style.setProperty('max-height', 'none', 'important')
  root.style.setProperty('overflow', 'visible', 'important')
  root.style.setProperty('flex', 'none', 'important')
  root.style.setProperty('align-items', 'stretch', 'important')

  root.querySelectorAll<HTMLElement>('.overflow-y-auto, .overflow-x-auto, .overflow-hidden').forEach(
    (el) => {
      el.style.setProperty('overflow', 'visible', 'important')
      el.style.setProperty('max-height', 'none', 'important')
      el.style.setProperty('min-height', '0', 'important')
      el.style.setProperty('height', 'auto', 'important')
      el.style.setProperty('flex', 'none', 'important')
    },
  )

  root.querySelectorAll<HTMLElement>('[class*="grid"]').forEach((el) => {
    const display = window.getComputedStyle(el).display
    if (display === 'grid') {
      el.style.setProperty('display', 'grid', 'important')
    }
  })
}

function measureFullScrollHeight(prepared: HTMLElement): number {
  prepared.style.position = 'absolute'
  prepared.style.left = '-9999px'
  prepared.style.top = '0'
  prepared.style.visibility = 'hidden'
  prepared.style.height = 'auto'
  prepared.style.maxHeight = 'none'
  prepared.style.overflow = 'visible'

  document.body.appendChild(prepared)
  const height = Math.ceil(prepared.scrollHeight)
  document.body.removeChild(prepared)

  prepared.style.position = 'static'
  prepared.style.left = 'auto'
  prepared.style.visibility = 'visible'

  return Math.max(1, height)
}

function prepareFullScrollExportElement(source: HTMLElement, options?: HtmlExportOptions): HTMLElement {
  const { preserveBackground } = resolveHtmlExportOptions(source, options)
  const clone = source.cloneNode(true) as HTMLElement
  inlineNodeStyles(source, clone)
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())

  const sourceStyle = window.getComputedStyle(source)
  const fixedWidth = Math.max(1, Math.ceil(source.getBoundingClientRect().width))

  if (preserveBackground) {
    const explicitBg = source.getAttribute('data-chart-export-bg')
    const bg =
      explicitBg ||
      source.style.backgroundColor ||
      sourceStyle.backgroundColor ||
      sourceStyle.background
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      clone.style.setProperty('background', bg, 'important')
    }
    clone.style.setProperty('border', sourceStyle.border, 'important')
    clone.style.setProperty('border-radius', sourceStyle.borderRadius, 'important')
    clone.style.setProperty('box-shadow', sourceStyle.boxShadow, 'important')
  }

  clone.style.setProperty('margin', '0', 'important')
  clone.style.setProperty('padding', sourceStyle.padding, 'important')
  clone.style.setProperty('box-sizing', 'border-box', 'important')
  clone.style.setProperty('position', 'static', 'important')
  clone.style.setProperty('outline', 'none', 'important')

  applyFullScrollExportLayout(clone, fixedWidth)
  applyNestedFlexExportFix(clone, source)

  clone.querySelectorAll<HTMLElement>('[data-chart-export-trim="copy-padding"]').forEach((el) => {
    el.style.setProperty('padding-right', '1.25rem', 'important')
  })
  if (clone.hasAttribute('data-chart-export-trim')) {
    clone.style.setProperty('padding-right', '1.25rem', 'important')
  }

  return clone
}

function isFixedSizeIcon(el: HTMLElement): boolean {
  const cls = el.className
  if (typeof cls !== 'string') return false
  if (!el.classList.contains('shrink-0')) return false
  return (
    (/\bh-8\b/.test(cls) && /\bw-8\b/.test(cls)) ||
    (/\bh-10\b/.test(cls) && /\bw-10\b/.test(cls)) ||
    (/\bh-11\b/.test(cls) && /\bw-11\b/.test(cls))
  )
}

async function renderPreparedElementToPngBlob(
  prepared: HTMLElement,
  width: number,
  height: number,
  scale = DEFAULT_SCALE,
  options?: { overflowVisible?: boolean },
): Promise<Blob> {
  // Clona para não mover o nó original (ex.: wrapper montado em document.body).
  const snapshot = prepared.cloneNode(true) as HTMLElement
  await inlineRasterImagesForExport(snapshot)
  snapshot.style.setProperty('position', 'static', 'important')
  snapshot.style.setProperty('left', 'auto', 'important')
  snapshot.style.setProperty('top', 'auto', 'important')
  snapshot.style.setProperty('transform', 'none', 'important')
  snapshot.style.setProperty('visibility', 'visible', 'important')
  snapshot.style.setProperty('opacity', '1', 'important')
  snapshot.style.width = `${width}px`
  snapshot.style.height = `${height}px`
  snapshot.style.minHeight = `${height}px`
  snapshot.style.maxHeight = 'none'
  snapshot.style.overflow = options?.overflowVisible ? 'visible' : 'hidden'
  snapshot.style.boxSizing = 'border-box'

  const xhtmlNs = 'http://www.w3.org/1999/xhtml'
  const wrapper = document.createElement('div')
  wrapper.setAttribute('xmlns', xhtmlNs)
  wrapper.appendChild(snapshot)

  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  svg.setAttribute('xmlns', svgNs)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))

  const foreignObject = document.createElementNS(svgNs, 'foreignObject')
  foreignObject.setAttribute('width', '100%')
  foreignObject.setAttribute('height', '100%')
  foreignObject.appendChild(wrapper)
  svg.appendChild(foreignObject)

  const serialized = new XMLSerializer().serializeToString(svg)
  const img = await loadImageFromSvgString(serialized)

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem PNG'))),
      'image/png',
    )
  })
}

function lockIconDimensions(cell: HTMLElement, sourceCell: HTMLElement): void {
  if (!isFixedSizeIcon(sourceCell)) return
  const w = Math.ceil(sourceCell.getBoundingClientRect().width)
  const h = Math.ceil(sourceCell.getBoundingClientRect().height)
  const size = Math.max(w, h, 1)
  const sourceStyle = window.getComputedStyle(sourceCell)
  cell.style.setProperty('width', `${size}px`, 'important')
  cell.style.setProperty('min-width', `${size}px`, 'important')
  cell.style.setProperty('max-width', `${size}px`, 'important')
  cell.style.setProperty('height', `${size}px`, 'important')
  cell.style.setProperty('min-height', `${size}px`, 'important')
  cell.style.setProperty('max-height', `${size}px`, 'important')
  cell.style.setProperty('border-radius', sourceStyle.borderRadius, 'important')
  if (
    sourceStyle.backgroundColor &&
    sourceStyle.backgroundColor !== 'transparent' &&
    sourceStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
  ) {
    cell.style.setProperty('background-color', sourceStyle.backgroundColor, 'important')
  }
  if (sourceStyle.color) {
    cell.style.setProperty('color', sourceStyle.color, 'important')
  }
  cell.style.setProperty('overflow', 'hidden', 'important')
  cell.style.setProperty('box-sizing', 'border-box', 'important')
  cell.style.setProperty('display', 'inline-flex', 'important')
  cell.style.setProperty('vertical-align', 'middle', 'important')
  cell.style.setProperty('align-items', 'center', 'important')
  cell.style.setProperty('justify-content', 'center', 'important')
  cell.style.setProperty('flex-shrink', '0', 'important')
  cell.style.setProperty('text-align', 'center', 'important')
  cell.style.setProperty('line-height', `${size}px`, 'important')

  cell.querySelectorAll<SVGSVGElement>('svg').forEach((svg) => {
    svg.style.setProperty('display', 'inline-block', 'important')
    svg.style.setProperty('vertical-align', 'middle', 'important')
  })
}

function isTextBlockCell(el: HTMLElement): boolean {
  return el.classList.contains('min-w-0') || el.querySelector('p') != null
}

/** Mantém o card na largura da tela; table/table-cell para foreignObject (SVG). */
function applyInlineRowCardExport(root: HTMLElement, source: HTMLElement): void {
  const sourceRect = source.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(sourceRect.width))
  const sourceStyle = window.getComputedStyle(source)
  const gap = parseFloat(sourceStyle.gap || sourceStyle.columnGap) || 12

  root.style.setProperty('display', 'table', 'important')
  root.style.setProperty('table-layout', 'fixed', 'important')
  root.style.setProperty('border-collapse', 'separate', 'important')
  root.style.setProperty('border-spacing', '0', 'important')
  root.style.setProperty('width', `${width}px`, 'important')
  root.style.setProperty('min-width', `${width}px`, 'important')
  root.style.setProperty('max-width', `${width}px`, 'important')
  root.style.setProperty('height', 'auto', 'important')
  root.style.setProperty('min-height', '0', 'important')
  root.style.setProperty('max-height', 'none', 'important')
  root.style.setProperty('box-sizing', 'border-box', 'important')
  root.style.setProperty('border-radius', sourceStyle.borderRadius, 'important')
  root.style.setProperty('overflow', 'hidden', 'important')

  const sourceCells = Array.from(source.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.hasAttribute('data-chart-export-ignore'),
  )
  const rootCells = Array.from(root.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.hasAttribute('data-chart-export-ignore'),
  )

  rootCells.forEach((cell, index) => {
    const sourceCell = sourceCells[index]
    if (!sourceCell) return

    cell.style.setProperty('display', 'table-cell', 'important')
    cell.style.setProperty('vertical-align', 'middle', 'important')
    if (index > 0) {
      cell.style.setProperty('padding-left', `${gap}px`, 'important')
    }

    if (isFixedSizeIcon(sourceCell)) {
      lockIconDimensions(cell, sourceCell)
      return
    }

    if (isTextBlockCell(sourceCell)) {
      cell.style.setProperty('width', '100%', 'important')
      cell.querySelectorAll<HTMLElement>('p').forEach((p) => {
        if (p.hasAttribute('data-chart-export-ignore')) return
        p.style.setProperty('display', 'block', 'important')
      })
      return
    }

    const trailingW = Math.max(1, Math.ceil(sourceCell.getBoundingClientRect().width))
    cell.style.setProperty('width', `${trailingW}px`, 'important')
    cell.style.setProperty('min-width', `${trailingW}px`, 'important')
    cell.style.setProperty('max-width', `${trailingW}px`, 'important')
    cell.style.setProperty('white-space', 'nowrap', 'important')
  })
}

/** Remove larguras congeladas pelo inlineNodeStyles (grid w-full) — só na cópia. */
function applyFitContentExportReset(root: HTMLElement): void {
  const rootDisplay = window.getComputedStyle(root).display

  root.style.setProperty('width', 'max-content', 'important')
  root.style.setProperty('min-width', '0', 'important')
  root.style.setProperty('max-width', 'none', 'important')
  root.style.setProperty('height', 'auto', 'important')
  root.style.setProperty('overflow', 'visible', 'important')

  if (rootDisplay === 'flex' || rootDisplay === 'inline-flex') {
    root.style.setProperty('display', 'inline-flex', 'important')
    root.style.setProperty('align-items', 'center', 'important')
  } else {
    root.style.setProperty('display', 'inline-block', 'important')
  }

  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (isFixedSizeIcon(el)) return
    const hasTextContent = el.querySelector('p, h1, h2, h3, h4, h5, h6') != null
    el.style.setProperty('width', 'auto', 'important')
    el.style.setProperty(
      'min-width',
      hasTextContent ? 'max-content' : '0',
      'important',
    )
    el.style.setProperty('max-width', 'none', 'important')
    el.style.setProperty('flex', hasTextContent ? '1 1 auto' : '0 0 auto', 'important')
    el.style.setProperty('flex-grow', hasTextContent ? '1' : '0', 'important')
    el.style.setProperty('flex-shrink', hasTextContent ? '1' : '0', 'important')
  })

  root.querySelectorAll<HTMLElement>('button').forEach((btn) => {
    btn.style.setProperty('display', 'inline-flex', 'important')
    btn.style.setProperty('width', 'auto', 'important')
    btn.style.setProperty('align-items', 'center', 'important')
  })
}

function elementLayoutWidth(el: HTMLElement): number {
  return Math.max(
    1,
    Math.ceil(el.getBoundingClientRect().width),
    el.offsetWidth,
    el.scrollWidth,
  )
}

function applyPreserveBackgroundExportLayout(
  root: HTMLElement,
  source: HTMLElement,
  expandWidth = false,
  fitContent = false,
): void {
  const inlineRow = shouldInlineRowCardExport(source)
  const sourceStyle = window.getComputedStyle(source)
  const sourceWidth = elementLayoutWidth(source)

  stripInlineHeights(root)

  // Clone off-screen (fixed / -10000px) herda left/transform no inline —
  // sem reset o PNG sai em branco ou o clipboard "funciona" sem imagem.
  root.style.setProperty('position', 'static', 'important')
  root.style.setProperty('left', 'auto', 'important')
  root.style.setProperty('top', 'auto', 'important')
  root.style.setProperty('right', 'auto', 'important')
  root.style.setProperty('bottom', 'auto', 'important')
  root.style.setProperty('transform', 'none', 'important')
  root.style.setProperty('z-index', 'auto', 'important')
  root.style.setProperty('visibility', 'visible', 'important')
  root.style.setProperty('opacity', '1', 'important')
  root.style.setProperty('box-sizing', 'border-box', 'important')
  root.style.setProperty('align-self', 'auto', 'important')
  root.style.setProperty('flex', 'none', 'important')
  root.style.setProperty('display', sourceStyle.display, 'important')
  root.style.setProperty('flex-direction', sourceStyle.flexDirection, 'important')
  root.style.setProperty('gap', sourceStyle.gap, 'important')
  root.style.setProperty('box-shadow', sourceStyle.boxShadow, 'important')

  if (!inlineRow) {
    root.style.setProperty('height', 'auto', 'important')
    root.style.setProperty('min-height', '0', 'important')
    root.style.setProperty('max-height', 'none', 'important')
    if (fitContent) {
      // Largura final é definida em applyFitContentExportReset (após demais ajustes).
    } else if (expandWidth) {
      root.style.setProperty('width', 'max-content', 'important')
      root.style.setProperty('min-width', `${sourceWidth}px`, 'important')
      root.style.setProperty('max-width', 'none', 'important')
    } else {
      root.style.setProperty('width', `${sourceWidth}px`, 'important')
      root.style.setProperty('min-width', '0', 'important')
      root.style.setProperty('max-width', `${sourceWidth}px`, 'important')
    }
    root.style.setProperty('overflow', 'visible', 'important')
    root.style.setProperty('align-items', 'flex-start', 'important')
    root.style.setProperty('height', 'fit-content', 'important')
  }

  root.querySelectorAll<HTMLElement>('[data-chart-export-trim="copy-padding"]').forEach((el) => {
    el.style.setProperty('padding-right', '1.25rem', 'important')
  })

  if (root.hasAttribute('data-chart-export-trim')) {
    root.style.setProperty('padding-right', '1.25rem', 'important')
  }

  root.querySelectorAll<HTMLElement>('table').forEach((table) => {
    table.style.setProperty('border-collapse', 'collapse', 'important')
    if (expandWidth) {
      table.style.setProperty('width', 'auto', 'important')
      table.style.setProperty('min-width', 'max-content', 'important')
    } else {
      table.style.setProperty('width', '100%', 'important')
    }
  })

  if (expandWidth) {
    root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
      cell.style.setProperty('white-space', 'nowrap', 'important')
    })
    root.querySelectorAll<HTMLElement>('button').forEach((btn) => {
      btn.style.setProperty('white-space', 'nowrap', 'important')
    })
  }

  if (!inlineRow && root.classList.contains('overflow-hidden')) {
    root.style.setProperty('overflow', 'visible', 'important')
  }

  root.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-hidden').forEach((el) => {
    if (inlineRow && el === root) return
    el.style.setProperty('overflow', 'visible', 'important')
  })

  if (inlineRow) {
    applyInlineRowCardExport(root, source)
  } else if (fitContent) {
    applyFitContentExportReset(root)
  }
}

function measureCardSnapshotElement(
  prepared: HTMLElement,
  fixedWidth: number,
  expandWidth = false,
  fitContent = false,
): { width: number; height: number } {
  prepared.style.position = 'absolute'
  prepared.style.left = '-9999px'
  prepared.style.top = '0'
  prepared.style.visibility = 'hidden'
  prepared.style.boxSizing = 'border-box'
  if (fitContent) {
    prepared.style.width = 'max-content'
    prepared.style.minWidth = '0'
    prepared.style.maxWidth = 'none'
    prepared.style.overflow = 'visible'
  } else if (expandWidth) {
    prepared.style.width = 'max-content'
    prepared.style.minWidth = `${fixedWidth}px`
    prepared.style.maxWidth = 'none'
    prepared.style.overflow = 'visible'
  } else {
    prepared.style.width = `${fixedWidth}px`
    prepared.style.maxWidth = `${fixedWidth}px`
    prepared.style.overflow = 'hidden'
  }
  prepared.style.height = 'fit-content'
  prepared.style.minHeight = '0'
  prepared.style.maxHeight = 'none'
  prepared.style.alignItems = 'flex-start'

  document.body.appendChild(prepared)

  const style = window.getComputedStyle(prepared)
  const verticalExtra =
    (parseFloat(style.paddingTop) || 0) +
    (parseFloat(style.paddingBottom) || 0) +
    (parseFloat(style.borderTopWidth) || 0) +
    (parseFloat(style.borderBottomWidth) || 0)

  let contentMax = 0
  Array.from(prepared.children).forEach((child) => {
    if (child instanceof HTMLElement) {
      contentMax = Math.max(contentMax, child.offsetHeight)
    }
  })

  const scrollHeight = Math.ceil(prepared.scrollHeight)
  const offsetHeight = Math.ceil(prepared.offsetHeight)
  const contentHeight = contentMax > 0 ? Math.ceil(contentMax + verticalExtra) : scrollHeight
  const height = prepared.querySelector('table')
    ? scrollHeight
    : Math.max(offsetHeight, scrollHeight, contentHeight)

  const width = fitContent || expandWidth ? Math.ceil(prepared.scrollWidth) : fixedWidth

  document.body.removeChild(prepared)

  return { width: Math.max(1, width), height: Math.max(1, height) }
}

function measurePreparedElement(
  prepared: HTMLElement,
  options?: {
    fixedWidth?: number
    cardSnapshot?: boolean
    expandWidth?: boolean
    fitContent?: boolean
  },
): { width: number; height: number } {
  if (options?.cardSnapshot && (options.fixedWidth != null || options.fitContent)) {
    return measureCardSnapshotElement(
      prepared,
      options.fixedWidth ?? 0,
      options.expandWidth,
      options.fitContent,
    )
  }

  prepared.style.position = 'absolute'
  prepared.style.left = '-9999px'
  prepared.style.top = '0'
  prepared.style.visibility = 'hidden'
  prepared.style.height = 'auto'
  prepared.style.minHeight = '0'
  prepared.style.maxHeight = 'none'
  prepared.style.width = options?.fixedWidth ? `${options.fixedWidth}px` : 'max-content'
  prepared.style.maxWidth = options?.fixedWidth ? `${options.fixedWidth}px` : 'none'
  prepared.style.boxSizing = 'border-box'

  document.body.appendChild(prepared)
  const width = options?.fixedWidth ?? Math.ceil(prepared.scrollWidth)
  const height = Math.ceil(
    Math.max(
      prepared.scrollHeight,
      prepared.offsetHeight,
      prepared.getBoundingClientRect().height,
    ),
  )
  document.body.removeChild(prepared)

  return { width: Math.max(1, width), height: Math.max(1, height) }
}

function prepareHtmlExportElement(source: HTMLElement, options?: HtmlExportOptions): HTMLElement {
  const { preserveBackground } = resolveHtmlExportOptions(source, options)
  const clone = source.cloneNode(true) as HTMLElement
  inlineNodeStyles(source, clone)
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())

  if (preserveBackground) {
    const sourceStyle = window.getComputedStyle(source)
    const explicitBg = source.getAttribute('data-chart-export-bg')
    const bg =
      explicitBg ||
      source.style.backgroundColor ||
      sourceStyle.backgroundColor ||
      sourceStyle.background
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      clone.style.setProperty('background', bg, 'important')
    }
    clone.style.setProperty('border', sourceStyle.border, 'important')
    clone.style.setProperty('border-radius', sourceStyle.borderRadius, 'important')
    clone.style.setProperty('box-shadow', 'none', 'important')
  } else {
    clone.style.setProperty('background', 'transparent', 'important')
    clone.style.setProperty('box-shadow', 'none', 'important')
    clone.style.setProperty('border', 'none', 'important')
  }
  clone.style.setProperty('outline', 'none', 'important')

  if (preserveBackground) {
    applyPreserveBackgroundExportLayout(
      clone,
      source,
      shouldExpandExportWidth(source),
      shouldFitContentExport(source),
    )
    if (!shouldFitContentExport(source) && !shouldInlineRowCardExport(source)) {
      applyNestedFlexExportFix(clone, source)
    }
  } else {
    applyExportHtmlColors(clone, preserveBackground)
    applyExportLayoutFixes(clone)

    clone.querySelectorAll<HTMLElement>('p').forEach((el) => {
      el.style.setProperty('display', 'block', 'important')
      el.style.setProperty('line-height', '1.45', 'important')
      el.style.setProperty('margin', '0', 'important')
    })

    clone.querySelectorAll<HTMLElement>('[data-legend-export] > div > p + p, [data-legend-export] div.space-y-1 > p + p').forEach(
      (el) => {
        el.style.setProperty('margin-top', '4px', 'important')
      },
    )
  }

  clone.style.margin = '0'
  clone.style.padding = window.getComputedStyle(source).padding

  return clone
}

async function htmlElementToPngBlob(
  element: HTMLElement,
  scale = DEFAULT_SCALE,
  options?: HtmlExportOptions,
): Promise<Blob> {
  const { preserveBackground } = resolveHtmlExportOptions(element, options)
  const printSnapshot = shouldPrintSnapshotExport(element)
  const fullScroll = shouldFullScrollExport(element)
  const stackCards = shouldStackCardsExport(element)

  if (stackCards) {
    const prepared = prepareStackCardsExportElement(element, options)
    const width = Math.max(1, Math.ceil(element.getBoundingClientRect().width))
    const height = measureFullScrollHeight(prepared.cloneNode(true) as HTMLElement)
    if (width === 0 || height === 0) {
      throw new Error('Conteúdo ainda não renderizado')
    }
    prepared.style.setProperty('height', `${height}px`, 'important')
    prepared.style.setProperty('min-height', `${height}px`, 'important')
    prepared.style.setProperty('max-height', `${height}px`, 'important')
    prepared.style.setProperty('overflow', 'hidden', 'important')
    return renderPreparedElementToPngBlob(prepared, width, height, scale)
  }

  if (fullScroll) {
    const prepared = prepareFullScrollExportElement(element, options)
    const width = Math.max(1, Math.ceil(element.getBoundingClientRect().width))
    const height = measureFullScrollHeight(prepared.cloneNode(true) as HTMLElement)
    if (width === 0 || height === 0) {
      throw new Error('Conteúdo ainda não renderizado')
    }
    prepared.style.setProperty('height', `${height}px`, 'important')
    prepared.style.setProperty('min-height', `${height}px`, 'important')
    prepared.style.setProperty('max-height', `${height}px`, 'important')
    prepared.style.setProperty('overflow', 'hidden', 'important')
    return renderPreparedElementToPngBlob(prepared, width, height, scale)
  }

  if (printSnapshot) {
    const prepared = preparePrintSnapshotElement(element, options)
    const rect = element.getBoundingClientRect()
    const width = Math.max(
      1,
      Math.ceil(
        element.hasAttribute('data-chart-export-compact-list')
          ? Math.min(rect.width, 900)
          : rect.width,
      ),
    )
    const height = Math.max(1, Math.ceil(rect.height))
    if (width === 0 || height === 0) {
      throw new Error('Legenda ainda não renderizada')
    }
    return renderPreparedElementToPngBlob(prepared, width, height, scale)
  }

  const inlineRow = preserveBackground && shouldInlineRowCardExport(element)
  const fitContent = preserveBackground && !inlineRow && shouldFitContentExport(element)
  const expandWidth = preserveBackground && !fitContent && !inlineRow && shouldExpandExportWidth(element)
  const prepared = prepareHtmlExportElement(element, options)
  const fixedWidth = preserveBackground ? elementLayoutWidth(element) : undefined
  const { width, height } = measurePreparedElement(prepared, {
    fixedWidth,
    cardSnapshot: preserveBackground,
    expandWidth: expandWidth || undefined,
    fitContent: fitContent || undefined,
  })

  if (width === 0 || height === 0) {
    throw new Error('Legenda ainda não renderizada')
  }

  const exportHeight = preserveBackground ? height : height + 4
  if (preserveBackground) {
    if (inlineRow) {
      prepared.style.overflow = 'hidden'
    } else {
      prepared.style.overflow = expandWidth || fitContent ? 'visible' : 'hidden'
      prepared.style.alignItems = 'flex-start'
    }
    if (expandWidth || fitContent || inlineRow) {
      prepared.style.maxWidth = 'none'
    }
  }

  return renderPreparedElementToPngBlob(prepared, width, exportHeight, scale)
}

const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = PNG_CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Monta um chunk PNG "pHYs" (resolução física) para o DPI informado. */
function buildPngPhysChunk(dpi: number): Uint8Array {
  const pixelsPerMeter = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, 9) // length dos dados
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // 'pHYs'
  view.setUint32(8, pixelsPerMeter)
  view.setUint32(12, pixelsPerMeter)
  chunk[16] = 1 // unidade: metro

  const crc = crc32(chunk.subarray(4, 17)) // tipo + dados
  view.setUint32(17, crc)

  return chunk
}

/** Insere o DPI no PNG (chunk pHYs, logo após o IHDR) para que apps como o
 *  PowerPoint/Word colem a imagem no tamanho físico correto, independente
 *  da escala usada para gerar os pixels. */
async function embedPngDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const IHDR_END = 8 + (4 + 4 + 13 + 4) // assinatura PNG + chunk IHDR completo

  if (
    bytes.length < IHDR_END ||
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    return blob
  }

  const physChunk = buildPngPhysChunk(dpi)
  const result = new Uint8Array(bytes.length + physChunk.length)
  result.set(bytes.subarray(0, IHDR_END), 0)
  result.set(physChunk, IHDR_END)
  result.set(bytes.subarray(IHDR_END), IHDR_END + physChunk.length)

  return new Blob([result], { type: 'image/png' })
}

async function copyPngBlobToClipboard(
  blobOrPromise: Blob | Promise<Blob>,
  dpi?: number,
): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Cópia de imagem não suportada neste navegador')
  }

  const blobPromise = Promise.resolve(blobOrPromise).then((blob) =>
    dpi ? embedPngDpi(blob, dpi) : blob,
  )

  // Promise no ClipboardItem preserva o gesto do clique enquanto o PNG gera.
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
  } catch {
    const finalBlob = await blobPromise
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': finalBlob })])
  }
}

const DETALHE_COL_WIDTH = 420
/** Largura da coluna única — ~960px no PNG (scale 2), cabe no slide 16:9. */
const DETALHE_COL_WIDTH_SLIDE = 540
const DETALHE_COL_GAP = 20
const DETALHE_SLIDE_BODY_MAX_HEIGHT = 380
const DETALHE_MAX_COLUMNS = 4
const DETALHE_VALUE_COL_MIN = 148
const DETALHE_PAD_H = 16
const DETALHE_PAD_V = 10
const DETALHE_PAD_BOTTOM = 6
/** Área transparente no topo — reserva título + subtítulo do slide no PPT (~148px lógicos). */
const DETALHE_SLIDE_TITLE_OFFSET = 148
const DETALHE_SWATCH = 8
const DETALHE_ROW_GAP = 8
const DETALHE_HEADER_GAP = 5
const DETALHE_SECTION_GAP = 12
const DETALHE_FONT = 'system-ui, -apple-system, Segoe UI, sans-serif'
const DETALHE_VALUE_LINE_HEIGHT = 14
const DETALHE_NAME_LINE_HEIGHT = 15
const DETALHE_SUBTITLE_LINE_HEIGHT = 12

/** Cores alinhadas ao painel Detalhe do mês (slate/sky). */
export const LEGEND_DETALHE_EXPORT_COLORS = {
  title: '#0f172a',
  area: '#075985',
  label: '#475569',
  muted: '#64748b',
  value: '#0f172a',
  accent: '#0369a1',
  rowName: '#334155',
} as const

export type LegendDetalheExportSegment = {
  text: string
  color?: string
  font?: string
}

export type LegendDetalheExportLine = {
  text?: string
  font?: string
  color?: string
  segments?: LegendDetalheExportSegment[]
}

export type LegendDetalheExportValueLine = {
  text: string
  color?: string
  font?: string
}

export type LegendDetalheExportRow = {
  name: string
  nameColor?: string
  color: string
  valueLines: Array<string | LegendDetalheExportValueLine>
  /** Texto auxiliar abaixo do nome (ex.: grupos unificados). */
  subtitle?: string
  subtitleColor?: string
  /** Subtitle ocupa toda a largura da linha (abaixo do nome e dos valores). */
  subtitleFullWidth?: boolean
}

export type LegendDetalheExportData = {
  headerLines: LegendDetalheExportLine[]
  rows: LegendDetalheExportRow[]
  emptyMessage?: string
  /** Uma coluna larga — ideal para poucos planos no detalhe da área. */
  preferSingleColumn?: boolean
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const test = `${current} ${word}`
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }

  lines.push(current)
  return lines
}

function drawCanvasTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left',
): number {
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight)
  })
  return lines.length * lineHeight
}

function createMeasureCanvasContext(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador')
  return ctx
}

function detalheNameMaxWidth(colWidth: number): number {
  return Math.max(120, colWidth - DETALHE_SWATCH - 10 - 8 - DETALHE_VALUE_COL_MIN)
}

function detalheSubtitleMaxWidth(colWidth: number, fullWidth: boolean): number {
  if (fullWidth) {
    return Math.max(120, colWidth - DETALHE_SWATCH - 10 - 4)
  }
  return detalheNameMaxWidth(colWidth)
}

function detalheValueBlockHeight(valueLineCount: number): number {
  if (valueLineCount === 0) return 0
  return DETALHE_VALUE_LINE_HEIGHT + Math.max(0, valueLineCount - 1) * DETALHE_VALUE_LINE_HEIGHT
}

function normalizeValueLines(
  lines: Array<string | LegendDetalheExportValueLine>,
): LegendDetalheExportValueLine[] {
  return lines.map((line, index) => {
    if (typeof line !== 'string') return line
    return {
      text: line,
      color: index === 0 ? LEGEND_DETALHE_EXPORT_COLORS.value : LEGEND_DETALHE_EXPORT_COLORS.accent,
      font:
        index === 0
          ? `600 12px ${DETALHE_FONT}`
          : `400 11px ${DETALHE_FONT}`,
    }
  })
}

function drawExportHeaderLine(
  ctx: CanvasRenderingContext2D,
  line: LegendDetalheExportLine,
  x: number,
  y: number,
  lineHeight: number,
): number {
  if (line.segments?.length) {
    let cursorX = x
    for (const segment of line.segments) {
      ctx.font = segment.font ?? line.font ?? `400 12px ${DETALHE_FONT}`
      ctx.fillStyle = segment.color ?? line.color ?? LEGEND_DETALHE_EXPORT_COLORS.title
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(segment.text, cursorX, y)
      cursorX += ctx.measureText(segment.text).width
    }
    return lineHeight
  }

  const text = line.text ?? ''
  ctx.font = line.font ?? `400 12px ${DETALHE_FONT}`
  ctx.fillStyle = line.color ?? LEGEND_DETALHE_EXPORT_COLORS.title
  return drawCanvasTextLines(ctx, [text], x, y, lineHeight)
}

function measureDetalheRowHeight(
  ctx: CanvasRenderingContext2D,
  row: LegendDetalheExportRow,
  colWidth: number,
): number {
  const nameMaxWidth = detalheNameMaxWidth(colWidth)

  ctx.font = `400 12px ${DETALHE_FONT}`
  const nameLines = wrapCanvasText(ctx, row.name, nameMaxWidth)
  const nameHeight = nameLines.length * DETALHE_NAME_LINE_HEIGHT
  const valueHeight = detalheValueBlockHeight(row.valueLines.length)

  let totalHeight = Math.max(valueHeight, nameHeight, DETALHE_SWATCH)

  if (row.subtitle) {
    ctx.font = `400 10px ${DETALHE_FONT}`
    const subtitleMaxWidth = detalheSubtitleMaxWidth(colWidth, !!row.subtitleFullWidth)
    const subtitleLines = wrapCanvasText(ctx, row.subtitle, subtitleMaxWidth)
    const subtitleHeight = 2 + subtitleLines.length * DETALHE_SUBTITLE_LINE_HEIGHT

    if (row.subtitleFullWidth) {
      totalHeight += subtitleHeight
    } else {
      totalHeight = Math.max(valueHeight, nameHeight + subtitleHeight, DETALHE_SWATCH)
    }
  }

  return totalHeight + DETALHE_ROW_GAP
}

function detalheContentStartY(): number {
  return DETALHE_SLIDE_TITLE_OFFSET + DETALHE_PAD_V
}

function measureDetalheHeaderHeight(
  ctx: CanvasRenderingContext2D,
  data: LegendDetalheExportData,
): number {
  let y = detalheContentStartY()

  for (const line of data.headerLines) {
    ctx.font = line.font ?? `400 12px ${DETALHE_FONT}`
    y += DETALHE_HEADER_GAP + 16
  }

  if ((data.rows.length > 0 || data.emptyMessage) && data.headerLines.length > 0) {
    y += DETALHE_SECTION_GAP - DETALHE_HEADER_GAP
  } else if (data.rows.length > 0 || data.emptyMessage) {
    y += DETALHE_SECTION_GAP
  }

  return y
}

type DetalheColumnChunk = {
  rowIndices: number[]
  height: number
}

type DetalheExportLayout = {
  colCount: number
  colWidth: number
  totalWidth: number
  totalHeight: number
  headerHeight: number
  bodyHeight: number
  rowHeights: number[]
  columns: DetalheColumnChunk[]
}

function resolveDetalheColWidth(data: LegendDetalheExportData, colCount: number): number {
  if (data.preferSingleColumn && colCount === 1) return DETALHE_COL_WIDTH_SLIDE
  return DETALHE_COL_WIDTH
}

function buildDetalheColumnChunks(
  rowHeights: number[],
  colCount: number,
): DetalheColumnChunk[] {
  const columns: DetalheColumnChunk[] = Array.from({ length: colCount }, () => ({
    rowIndices: [],
    height: 0,
  }))

  if (rowHeights.length === 0) return columns

  const perCol = Math.ceil(rowHeights.length / colCount)
  for (let col = 0; col < colCount; col++) {
    const start = col * perCol
    const end = Math.min(start + perCol, rowHeights.length)
    for (let i = start; i < end; i++) {
      columns[col].rowIndices.push(i)
      columns[col].height += rowHeights[i]
    }
  }

  return columns
}

function buildDetalheExportLayout(
  ctx: CanvasRenderingContext2D,
  data: LegendDetalheExportData,
  colCount: number,
): DetalheExportLayout {
  const colWidth = resolveDetalheColWidth(data, colCount)
  const headerHeight = measureDetalheHeaderHeight(ctx, data)
  const rowHeights = data.rows.map((row) => measureDetalheRowHeight(ctx, row, colWidth))
  const columns = buildDetalheColumnChunks(rowHeights, colCount)
  const rawBodyHeight = data.emptyMessage
    ? 18
    : Math.max(...columns.map((column) => column.height), 0)
  const bodyHeight =
    rawBodyHeight > 0 && !data.emptyMessage ? Math.max(0, rawBodyHeight - DETALHE_ROW_GAP) : rawBodyHeight
  const totalWidth =
    colCount * colWidth + Math.max(0, colCount - 1) * DETALHE_COL_GAP + DETALHE_PAD_H * 2
  const totalHeight = headerHeight + bodyHeight + DETALHE_PAD_BOTTOM

  return {
    colCount,
    colWidth,
    totalWidth,
    totalHeight,
    headerHeight,
    bodyHeight,
    rowHeights,
    columns,
  }
}

function resolveMaxColumns(data: LegendDetalheExportData): number {
  if (data.preferSingleColumn) return 1
  const rowCount = data.rows.length
  if (rowCount <= 6) return 1
  if (rowCount <= 14) return 2
  return DETALHE_MAX_COLUMNS
}

function resolveDetalheExportLayout(
  ctx: CanvasRenderingContext2D,
  data: LegendDetalheExportData,
): DetalheExportLayout {
  if (data.emptyMessage || data.rows.length === 0) {
    return buildDetalheExportLayout(ctx, data, 1)
  }

  const maxColumns = resolveMaxColumns(data)
  const single = buildDetalheExportLayout(ctx, data, 1)
  if (maxColumns === 1 || single.bodyHeight <= DETALHE_SLIDE_BODY_MAX_HEIGHT) {
    return single
  }

  for (let colCount = 2; colCount <= maxColumns; colCount++) {
    const layout = buildDetalheExportLayout(ctx, data, colCount)
    if (layout.bodyHeight <= DETALHE_SLIDE_BODY_MAX_HEIGHT) {
      return layout
    }
  }

  return buildDetalheExportLayout(ctx, data, maxColumns)
}

function drawDetalheExportRow(
  ctx: CanvasRenderingContext2D,
  row: LegendDetalheExportRow,
  colX: number,
  rowTop: number,
  colWidth: number,
): void {
  const nameMaxWidth = detalheNameMaxWidth(colWidth)
  const nameX = colX + DETALHE_SWATCH + 10
  const valueX = colX + colWidth - 4

  ctx.beginPath()
  ctx.fillStyle = row.color
  ctx.arc(
    colX + DETALHE_SWATCH / 2,
    rowTop + DETALHE_SWATCH / 2 + 1,
    DETALHE_SWATCH / 2,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.font = `400 12px ${DETALHE_FONT}`
  ctx.fillStyle = row.nameColor ?? LEGEND_DETALHE_EXPORT_COLORS.rowName
  ctx.textAlign = 'left'
  const nameLines = wrapCanvasText(ctx, row.name, nameMaxWidth)
  drawCanvasTextLines(ctx, nameLines, nameX, rowTop, DETALHE_NAME_LINE_HEIGHT)

  const nameBlockHeight = nameLines.length * DETALHE_NAME_LINE_HEIGHT

  const valueLines = normalizeValueLines(row.valueLines)
  valueLines.forEach((line, index) => {
    ctx.font = line.font ?? (index === 0 ? `600 12px ${DETALHE_FONT}` : `400 11px ${DETALHE_FONT}`)
    ctx.fillStyle =
      line.color ??
      (index === 0 ? LEGEND_DETALHE_EXPORT_COLORS.value : LEGEND_DETALHE_EXPORT_COLORS.accent)
    drawCanvasTextLines(
      ctx,
      [line.text],
      valueX,
      rowTop + index * DETALHE_VALUE_LINE_HEIGHT,
      DETALHE_VALUE_LINE_HEIGHT,
      'right',
    )
  })

  const valueBlockHeight = detalheValueBlockHeight(valueLines.length)
  const firstBandHeight = Math.max(nameBlockHeight, valueBlockHeight, DETALHE_SWATCH)

  if (row.subtitle) {
    ctx.font = `400 10px ${DETALHE_FONT}`
    ctx.fillStyle = row.subtitleColor ?? LEGEND_DETALHE_EXPORT_COLORS.muted
    const subtitleMaxWidth = detalheSubtitleMaxWidth(colWidth, !!row.subtitleFullWidth)
    const subtitleLines = wrapCanvasText(ctx, row.subtitle, subtitleMaxWidth)
    const subtitleY = row.subtitleFullWidth
      ? rowTop + firstBandHeight + 2
      : rowTop + nameBlockHeight + 2
    drawCanvasTextLines(
      ctx,
      subtitleLines,
      nameX,
      subtitleY,
      DETALHE_SUBTITLE_LINE_HEIGHT,
    )
  }

  ctx.textAlign = 'left'
}

function measureLegendDetalheLayout(
  ctx: CanvasRenderingContext2D,
  data: LegendDetalheExportData,
): DetalheExportLayout {
  return resolveDetalheExportLayout(ctx, data)
}

function legendDetalheToPngBlob(data: LegendDetalheExportData, scale = DEFAULT_SCALE): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas não suportado neste navegador'))

  const measureCtx = createMeasureCanvasContext()
  const layout = measureLegendDetalheLayout(measureCtx, data)
  const { totalWidth: width, totalHeight: height } = layout

  canvas.width = width * scale
  canvas.height = height * scale
  ctx.scale(scale, scale)
  ctx.clearRect(0, 0, width, height)
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  let y = detalheContentStartY()

  for (const line of data.headerLines) {
    y += DETALHE_HEADER_GAP
    y += drawExportHeaderLine(ctx, line, DETALHE_PAD_H, y, 16)
  }

  if (data.rows.length > 0 || data.emptyMessage) {
    y += DETALHE_SECTION_GAP - DETALHE_HEADER_GAP
  }

  const bodyTop = y

  if (data.emptyMessage) {
    ctx.font = `400 12px ${DETALHE_FONT}`
    ctx.fillStyle = '#64748b'
    drawCanvasTextLines(ctx, [data.emptyMessage], DETALHE_PAD_H, bodyTop, 16)
  } else {
    layout.columns.forEach((column, colIndex) => {
      const colX = DETALHE_PAD_H + colIndex * (layout.colWidth + DETALHE_COL_GAP)
      let rowY = bodyTop

      for (const rowIndex of column.rowIndices) {
        drawDetalheExportRow(ctx, data.rows[rowIndex], colX, rowY, layout.colWidth)
        rowY += layout.rowHeights[rowIndex]
      }
    })
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem PNG'))),
      'image/png',
    )
  })
}

export async function copyLegendDetalheToClipboard(
  data: LegendDetalheExportData,
  scale = DEFAULT_SCALE,
): Promise<void> {
  const blob = await legendDetalheToPngBlob(data, scale)
  await copyPngBlobToClipboard(blob, 96 * scale)
}

export type ElementImageExportOptions = HtmlExportOptions

export async function elementToPngBlob(
  element: HTMLElement,
  scale = DEFAULT_SCALE,
  options?: ElementImageExportOptions,
): Promise<Blob> {
  return htmlElementToPngBlob(element, scale, options)
}

export async function copyElementImageToClipboard(
  element: HTMLElement,
  scale = DEFAULT_SCALE,
  options?: ElementImageExportOptions,
): Promise<void> {
  await copyPngBlobToClipboard(htmlElementToPngBlob(element, scale, options), 96 * scale)
}

/**
 * Export da Apresentação: mantém fundos/cores dos cards (áreas, metas, valores),
 * mas deixa o fundo do slide transparente para colar no PPT.
 * Não usa applyExportHtmlColors (que zerava os backgrounds no PNG).
 */
function prepareApresentacaoExportElement(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  inlineNodeStyles(source, clone)
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())

  const sourceStyle = window.getComputedStyle(source)
  const sourceWidth = Math.max(1, Math.ceil(source.getBoundingClientRect().width))

  clone.style.setProperty('background', 'transparent', 'important')
  clone.style.setProperty('background-color', 'transparent', 'important')
  clone.style.setProperty('box-shadow', 'none', 'important')
  clone.style.setProperty('border', 'none', 'important')
  clone.style.setProperty('outline', 'none', 'important')
  clone.style.setProperty('margin', '0', 'important')
  clone.style.setProperty('padding', sourceStyle.padding, 'important')
  clone.style.setProperty('box-sizing', 'border-box', 'important')
  clone.style.setProperty('overflow', 'visible', 'important')
  clone.style.setProperty('width', 'max-content', 'important')
  clone.style.setProperty('min-width', `${sourceWidth}px`, 'important')
  clone.style.setProperty('max-width', 'none', 'important')
  clone.style.setProperty('height', 'auto', 'important')
  clone.style.setProperty('min-height', '0', 'important')
  clone.style.setProperty('max-height', 'none', 'important')

  // foreignObject/SVG costuma ignorar `background` shorthand — força background-color.
  const lockBg = (el: HTMLElement) => {
    const computed =
      el.style.backgroundColor ||
      (el !== clone ? window.getComputedStyle(el).backgroundColor : '')
    // No clone detached, prefer inline já copiado por inlineNodeStyles
    const inline = el.style.backgroundColor
    const color = inline || computed
    if (!color || isTransparentCssColor(color)) return
    el.style.setProperty('background-color', color, 'important')
    el.style.setProperty('print-color-adjust', 'exact', 'important')
    el.style.setProperty('-webkit-print-color-adjust', 'exact', 'important')
  }

  lockBg(clone)
  clone.querySelectorAll<HTMLElement>('*').forEach(lockBg)

  // Rótulos das áreas: quebra só nas linhas explícitas (não no meio da palavra).
  clone.querySelectorAll<HTMLElement>('[data-apresentacao-area-label]').forEach((el) => {
    el.style.setProperty('overflow', 'visible', 'important')
    el.style.setProperty('word-break', 'keep-all', 'important')
    el.style.setProperty('overflow-wrap', 'normal', 'important')
    el.style.setProperty('hyphens', 'none', 'important')
  })
  clone.querySelectorAll<HTMLElement>('[data-apresentacao-area-label] span').forEach((el) => {
    el.style.setProperty('display', 'block', 'important')
    el.style.setProperty('white-space', 'nowrap', 'important')
    el.style.setProperty('overflow', 'visible', 'important')
  })
  clone.querySelectorAll<HTMLElement>('[data-apresentacao-area-header]').forEach((el) => {
    el.style.setProperty('overflow', 'visible', 'important')
  })

  // Iniciativas: no PPT, nomes longos devem quebrar em linha em vez de terminar em "...".
  clone.querySelectorAll<HTMLElement>('[data-iniciativas-entrega-nome]').forEach((el) => {
    el.style.setProperty('max-width', 'none', 'important')
    el.style.setProperty('overflow', 'visible', 'important')
    el.style.setProperty('text-overflow', 'clip', 'important')
    el.style.setProperty('white-space', 'normal', 'important')
    el.style.setProperty('overflow-wrap', 'break-word', 'important')
    el.style.setProperty('line-height', '1.2', 'important')
  })

  // Liderança: mantém avatar em coluna fixa e centraliza o nome no espaço
  // restante. O PowerPoint recalcula flex rows e deixava nomes quebrados tortos.
  clone
    .querySelectorAll<HTMLElement>('[data-lideranca-pessoa-identidade]')
    .forEach((el) => {
      el.style.setProperty('display', 'grid', 'important')
      el.style.setProperty(
        'grid-template-columns',
        '32px minmax(0, 1fr)',
        'important',
      )
      el.style.setProperty('align-items', 'center', 'important')
      el.style.setProperty('width', '100%', 'important')
    })
  clone.querySelectorAll<HTMLElement>('[data-lideranca-pessoa-nome]').forEach((el) => {
    el.style.setProperty('display', 'block', 'important')
    el.style.setProperty('width', '100%', 'important')
    el.style.setProperty('text-align', 'center', 'important')
    el.style.setProperty('line-height', '1.25', 'important')
  })

  return clone
}

/**
 * Layout absoluto do Bloco 2 no tamanho do slide PPT — cada card com altura
 * igual, tipografia ampliada e tabelas 100% largura (sem depender de flex no SVG).
 */
/** +10% tipográfico no export PPT (sobre o tuning anterior de cada bloco). */
const APRESENTACAO_EXPORT_FONT_BONUS_SCALE = 1.1
const APRESENTACAO_EXPORT_FONT_DEFAULT_SCALE = 1.15 * 1.1
const APRESENTACAO_EXPORT_FONT_BIG_NUMBER_SCALE = 1.55

function resolveApresentacaoExportFontScale(exportId: string | null): number {
  if (exportId === 'programa_bonus') return APRESENTACAO_EXPORT_FONT_BONUS_SCALE
  if (exportId === 'bignumber') return APRESENTACAO_EXPORT_FONT_BIG_NUMBER_SCALE
  return APRESENTACAO_EXPORT_FONT_DEFAULT_SCALE
}

/**
 * Aumenta tipografia inline do clone de export PPT (~factor).
 * Só mexe em font-size já definido (px/rem), preservando hierarquia.
 */
function bumpApresentacaoExportFonts(
  root: HTMLElement,
  factor = APRESENTACAO_EXPORT_FONT_DEFAULT_SCALE,
): void {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const raw = el.style.fontSize
    if (!raw) return
    const m = raw.trim().match(/^([\d.]+)(px|rem)$/i)
    if (!m) return
    const n = Number(m[1])
    if (!Number.isFinite(n) || n <= 0) return
    const next = Math.round(n * factor * 10) / 10
    el.style.setProperty('font-size', `${next}${m[2]}`, 'important')
  })
}

/** Células Desenvolvimento Equipe (horas + %): export PPT precisa de quebra de linha explícita. */
function isStackedHeatCell(el: HTMLElement): boolean {
  return (
    el.hasAttribute('data-heat-cell-stacked') ||
    el.querySelector('[data-heat-cell-stacked]') != null
  )
}

function applyStackedHeatCellExportStyles(cell: HTMLElement, cellFs: number): void {
  // Usa a mesma tipografia das demais células do Jurídico. As alturas
  // explícitas mantêm as duas linhas dentro do card no SVG do clipboard.
  const primaryFs = cellFs
  const secondaryFs = cellFs
  const primaryLineH = Math.ceil(primaryFs * 1.05)
  const secondaryLineH = Math.ceil(secondaryFs * 1.05)
  const contentHeight = primaryLineH + secondaryLineH

  cell.style.setProperty('white-space', 'normal', 'important')
  cell.style.setProperty('line-height', '1', 'important')
  cell.style.setProperty('vertical-align', 'middle', 'important')
  cell.style.setProperty('padding', '2px', 'important')
  cell.style.setProperty('height', `${contentHeight + 4}px`, 'important')

  // O <td> também recebe o atributo apenas para seleção. O conteúdo empilhado
  // é o <span> interno; nunca transforme o próprio <td> em display:block,
  // pois isso remove a célula do layout da tabela e desloca os meses.
  const stacked =
    cell.querySelector<HTMLElement>('[data-heat-cell-stacked]') ??
    (cell.tagName !== 'TD' && cell.matches('[data-heat-cell-stacked]') ? cell : null)
  if (!stacked) return

  const primaryElement = stacked.querySelector<HTMLElement>(
    '[data-heat-cell-stacked-primary]',
  )
  const secondaryElement = stacked.querySelector<HTMLElement>(
    '[data-heat-cell-stacked-secondary]',
  )
  const primaryText =
    stacked.getAttribute('data-stacked-primary-text') ??
    primaryElement?.textContent?.trim() ??
    ''
  const secondaryText =
    stacked.getAttribute('data-stacked-secondary-text') ??
    secondaryElement?.textContent?.trim() ??
    ''

  // O SVG/foreignObject do clipboard desloca blocos aninhados dentro de <td>.
  // No clone de export, reduz a célula a um único nó com quebra explícita.
  // Isso preserva exatamente uma célula por mês e impede deslocamento de colunas.
  if (!stacked.hasAttribute('data-stacked-export-flat')) {
    stacked.setAttribute('data-stacked-export-flat', '1')
    stacked.setAttribute('data-stacked-primary-text', primaryText)
    stacked.setAttribute('data-stacked-secondary-text', secondaryText)
    stacked.textContent = `${primaryText}\n${secondaryText}`
  }

  stacked.style.setProperty('display', 'block', 'important')
  stacked.style.setProperty('white-space', 'pre-line', 'important')
  stacked.style.setProperty('font-size', `${primaryFs}px`, 'important')
  stacked.style.setProperty('font-weight', '600', 'important')
  stacked.style.setProperty('line-height', `${primaryLineH}px`, 'important')
  stacked.style.setProperty('text-align', 'center', 'important')
  stacked.style.setProperty('width', '100%', 'important')
  stacked.style.setProperty('margin', '0 auto', 'important')
  stacked.style.setProperty('height', `${contentHeight}px`, 'important')
  stacked.style.setProperty('overflow', 'visible', 'important')
}

/** Reduz textos de tabela somente quando ultrapassam a largura real da célula. */
function fitApresentacaoTableText(root: HTMLElement): void {
  const fit = (el: HTMLElement, minFontSize: number) => {
    if (isStackedHeatCell(el)) return
    const available = el.clientWidth
    const required = el.scrollWidth
    if (available <= 0 || required <= available) return

    const computed = window.getComputedStyle(el)
    const current = Number.parseFloat(computed.fontSize)
    if (!Number.isFinite(current) || current <= 0) return

    const next = Math.max(
      minFontSize,
      Math.floor(current * (available / required) * 0.96 * 10) / 10,
    )
    el.style.setProperty('font-size', `${next}px`, 'important')
    el.style.setProperty('max-width', '100%', 'important')
    el.style.setProperty('overflow', 'hidden', 'important')
    el.style.setProperty('text-overflow', 'clip', 'important')
    el.style.setProperty('white-space', 'nowrap', 'important')
  }

  root.querySelectorAll<HTMLTableRowElement>('tr').forEach((row) => {
    const firstCell = row.querySelector<HTMLElement>(':scope > th:first-child, :scope > td:first-child')
    if (!firstCell) return
    if (firstCell.tagName === 'TH') {
      fit(firstCell, 9)
      return
    }
    // Metas usam a mesma fonte em todos os cards; textos longos quebram em
    // até duas linhas em vez de serem reduzidos a tamanhos diferentes.
    firstCell.style.setProperty('white-space', 'normal', 'important')
    firstCell.style.setProperty('line-height', '1.05', 'important')
    firstCell.style.setProperty('overflow', 'visible', 'important')
  })

  root.querySelectorAll<HTMLElement>('tbody td > div').forEach((content) => {
    if (content.hasAttribute('data-year-band-pill')) return
    if (isStackedHeatCell(content)) return
    fit(content, 9)
  })

  root.querySelectorAll<HTMLElement>('tbody td[data-heat-cell-stacked]').forEach((cell) => {
    const fs = Number.parseFloat(window.getComputedStyle(cell).fontSize) || 11
    applyStackedHeatCellExportStyles(cell, fs)
  })
}

function applyApresentacaoFillSlideLayout(
  root: HTMLElement,
  slideW: number,
  slideH: number,
  fontScale = 1,
): void {
  const scalePx = (value: number) => Math.round(value * fontScale * 10) / 10
  /**
   * Big Numbers / Programa de Bônus: preenche o slide mantendo o visual do preview
   * (gaps, radius, padding) — sem colar tudo nas bordas.
   */
  if (root.hasAttribute('data-apresentacao-fill-preserve')) {
    const isBigNumber =
      root.getAttribute('data-apresentacao-export') === 'bignumber'
    const pad = isBigNumber ? 10 : 14
    const gap = isBigNumber ? 6 : 10
    const gridGap = isBigNumber ? 6 : 8

    const fullWidth = (el: HTMLElement | null) => {
      if (!el) return
      el.style.setProperty('width', '100%', 'important')
      el.style.setProperty('max-width', 'none', 'important')
      el.style.setProperty('min-width', '0', 'important')
      el.style.setProperty('box-sizing', 'border-box', 'important')
    }

    root.style.setProperty('position', 'relative', 'important')
    root.style.setProperty('width', `${slideW}px`, 'important')
    root.style.setProperty('min-width', `${slideW}px`, 'important')
    root.style.setProperty('max-width', `${slideW}px`, 'important')
    root.style.setProperty('height', `${slideH}px`, 'important')
    root.style.setProperty('min-height', `${slideH}px`, 'important')
    root.style.setProperty('max-height', `${slideH}px`, 'important')
    root.style.setProperty('padding', `${pad}px`, 'important')
    root.style.setProperty('margin', '0', 'important')
    root.style.setProperty('box-sizing', 'border-box', 'important')
    root.style.setProperty('overflow', 'hidden', 'important')
    root.style.setProperty('background', 'transparent', 'important')
    root.style.setProperty('background-color', 'transparent', 'important')
    root.style.setProperty('display', 'flex', 'important')
    root.style.setProperty('flex-direction', 'column', 'important')
    root.style.setProperty('gap', `${gap}px`, 'important')
    root.style.setProperty('justify-content', 'stretch', 'important')
    root.style.setProperty('align-items', 'stretch', 'important')

    root.querySelectorAll<HTMLElement>('[data-bn-periodo]').forEach((el) => {
      el.style.setProperty('display', 'none', 'important')
    })

    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      for (const prop of ['width', 'min-width', 'max-width'] as const) {
        const v = el.style.getPropertyValue(prop)
        if (!v) continue
        const px = v.endsWith('px') ? parseFloat(v) : NaN
        if (Number.isFinite(px) && px >= 80) {
          el.style.removeProperty(prop)
        }
      }
    })
    root.style.setProperty('width', `${slideW}px`, 'important')
    root.style.setProperty('min-width', `${slideW}px`, 'important')
    root.style.setProperty('max-width', `${slideW}px`, 'important')

    Array.from(root.children).forEach((child) => {
      fullWidth(child as HTMLElement)
    })

    const kpis = root.querySelector<HTMLElement>('[data-bn-kpis]')
    if (kpis) {
      fullWidth(kpis)
      kpis.style.setProperty('display', 'grid', 'important')
      kpis.style.setProperty(
        'grid-template-columns',
        'repeat(6, minmax(0, 1fr))',
        'important',
      )
      kpis.style.setProperty('flex', '0 0 auto', 'important')
      kpis.style.setProperty('gap', `${gridGap}px`, 'important')
      kpis.style.setProperty('margin', '0', 'important')
      kpis.querySelectorAll<HTMLElement>(':scope > *').forEach((card) => {
        card.style.setProperty('width', '100%', 'important')
        card.style.setProperty('max-width', 'none', 'important')
        card.style.setProperty('min-width', '0', 'important')
        card.style.setProperty('border-radius', '10px', 'important')
        card.style.setProperty(
          'padding',
          isBigNumber ? '8px 10px' : '10px 12px',
          'important',
        )
        card.style.setProperty('box-sizing', 'border-box', 'important')
        card.style.setProperty('border', '1px solid #E2E8F0', 'important')
        card.style.setProperty('background', '#FFFFFF', 'important')
        card.style.setProperty('background-color', '#FFFFFF', 'important')
      })
      kpis.querySelectorAll<HTMLElement>('[data-bn-receita-valor]').forEach((valor) => {
        valor.style.setProperty('font-size', '13px', 'important')
        valor.style.setProperty('line-height', '1.15', 'important')
        valor.style.setProperty('white-space', 'nowrap', 'important')
      })
      kpis.querySelectorAll<HTMLElement>('[data-bn-receita-anterior]').forEach((anterior) => {
        anterior.style.setProperty('font-size', '9px', 'important')
        anterior.style.setProperty('line-height', '1.15', 'important')
        anterior.style.setProperty('margin-top', '2px', 'important')
        anterior.style.setProperty('white-space', 'nowrap', 'important')
      })
      kpis.querySelectorAll<HTMLElement>('[data-bn-receita-delta]').forEach((delta) => {
        delta.style.setProperty('font-size', '10px', 'important')
        delta.style.setProperty('line-height', '1.15', 'important')
        delta.style.setProperty('margin-top', '4px', 'important')
        delta.style.setProperty('white-space', 'nowrap', 'important')
      })
    }

    const tops = root.querySelector<HTMLElement>('[data-bn-tops]')
    if (tops) {
      fullWidth(tops)
      tops.style.setProperty('display', 'grid', 'important')
      tops.style.setProperty('grid-template-columns', '1fr 1fr', 'important')
      tops.style.setProperty('grid-template-rows', '1fr 1fr', 'important')
      tops.style.setProperty('flex', '1 1 0', 'important')
      tops.style.setProperty('min-height', '0', 'important')
      tops.style.setProperty('max-height', '100%', 'important')
      tops.style.setProperty('overflow', 'hidden', 'important')
      tops.style.setProperty('gap', `${gridGap}px`, 'important')
      tops.style.setProperty('margin', '0', 'important')
      tops.style.setProperty('align-items', 'stretch', 'important')
      tops.querySelectorAll<HTMLElement>(':scope > *').forEach((card) => {
        card.style.setProperty('width', '100%', 'important')
        card.style.setProperty('max-width', 'none', 'important')
        card.style.setProperty('min-width', '0', 'important')
        card.style.setProperty('height', '100%', 'important')
        card.style.setProperty('min-height', '0', 'important')
        card.style.setProperty('border-radius', '12px', 'important')
        card.style.setProperty(
          'padding',
          isBigNumber ? '8px 10px' : '12px',
          'important',
        )
        card.style.setProperty('display', 'flex', 'important')
        card.style.setProperty('flex-direction', 'column', 'important')
        card.style.setProperty('box-sizing', 'border-box', 'important')
        card.style.setProperty('border', '1px solid #E2E8F0', 'important')
        card.style.setProperty('background', '#FFFFFF', 'important')
        card.style.setProperty('background-color', '#FFFFFF', 'important')
        if (isBigNumber) {
          const title = card.querySelector<HTMLElement>('[data-bn-title]')
          title?.style.setProperty('font-size', '14px', 'important')
        }
        const tablesWrap = card.querySelector<HTMLElement>(':scope > div:last-of-type')
        if (tablesWrap) {
          tablesWrap.style.setProperty('flex', '1 1 auto', 'important')
          tablesWrap.style.setProperty('min-height', '0', 'important')
          tablesWrap.style.setProperty('display', 'flex', 'important')
          tablesWrap.style.setProperty(
            'gap',
            isBigNumber ? '6px' : '10px',
            'important',
          )
          tablesWrap.style.setProperty('width', '100%', 'important')
          tablesWrap.querySelectorAll<HTMLElement>(':scope > *').forEach((col) => {
            col.style.setProperty('flex', '1 1 0', 'important')
            col.style.setProperty('min-width', '0', 'important')
            col.style.setProperty('width', 'auto', 'important')
            col.style.setProperty('max-width', 'none', 'important')
          })
          tablesWrap.querySelectorAll<HTMLElement>('table').forEach((table) => {
            table.style.setProperty('width', '100%', 'important')
            table.style.setProperty('max-width', 'none', 'important')
            if (isBigNumber) {
              table.style.setProperty('font-size', '12.5px', 'important')
            }
          })
          if (isBigNumber) {
            tablesWrap
              .querySelectorAll<HTMLElement>(':scope > * > div:first-child')
              .forEach((year) => {
                year.style.setProperty('font-size', '13px', 'important')
                year.style.setProperty('margin-bottom', '3px', 'important')
              })
            tablesWrap
              .querySelectorAll<HTMLElement>('th, td')
              .forEach((cell) => {
                cell.style.setProperty('padding', '3px 5px', 'important')
                cell.style.setProperty('line-height', '1.15', 'important')
              })
          }
        }
      })
    }

    root.querySelectorAll<HTMLElement>('[data-bn-title-row]').forEach((row) => {
      row.style.setProperty('width', '100%', 'important')
      row.style.setProperty('max-width', 'none', 'important')
      row.style.setProperty('min-width', '0', 'important')
      row.style.setProperty('box-sizing', 'border-box', 'important')
      row.style.setProperty('flex-wrap', 'nowrap', 'important')
      row.style.setProperty('overflow', 'visible', 'important')
    })
    root.querySelectorAll<HTMLElement>('[data-bn-title]').forEach((title) => {
      title.style.setProperty('width', 'auto', 'important')
      title.style.setProperty('max-width', 'none', 'important')
      title.style.setProperty('min-width', 'max-content', 'important')
      title.style.setProperty('white-space', 'nowrap', 'important')
      title.style.setProperty('overflow', 'visible', 'important')
      title.style.setProperty('word-break', 'keep-all', 'important')
      title.style.setProperty('overflow-wrap', 'normal', 'important')
    })


    // Programa de Bônus — mesmos ganchos do Big Numbers (kpis + body)
    const bonusKpis = root.querySelector<HTMLElement>('[data-bonus-kpis]')
    if (bonusKpis) {
      fullWidth(bonusKpis)
      bonusKpis.style.setProperty('display', 'grid', 'important')
      bonusKpis.style.setProperty(
        'grid-template-columns',
        'repeat(4, minmax(0, 1fr))',
        'important',
      )
      bonusKpis.style.setProperty('flex', '0 0 auto', 'important')
      bonusKpis.style.setProperty('gap', `${gridGap}px`, 'important')
      bonusKpis.style.setProperty('margin', '0', 'important')
      bonusKpis.querySelectorAll<HTMLElement>(':scope > *').forEach((card) => {
        card.style.setProperty('width', '100%', 'important')
        card.style.setProperty('max-width', 'none', 'important')
        card.style.setProperty('min-width', '0', 'important')
        card.style.setProperty('box-sizing', 'border-box', 'important')
        card.style.setProperty('border-radius', '12px', 'important')
        card.style.setProperty('overflow', 'hidden', 'important')
        card.style.setProperty('background', '#FFFFFF', 'important')
        card.style.setProperty('background-color', '#FFFFFF', 'important')
      })
      bonusKpis
        .querySelectorAll<HTMLElement>('[data-bonus-summary-header]')
        .forEach((header) => {
          header.style.setProperty('width', '100%', 'important')
          header.style.setProperty('max-width', 'none', 'important')
          header.style.setProperty('align-self', 'stretch', 'important')
          header.style.setProperty('box-sizing', 'border-box', 'important')
          header.style.setProperty('text-align', 'center', 'important')
        })
      bonusKpis
        .querySelectorAll<HTMLElement>('[data-bonus-summary-body]')
        .forEach((body) => {
          body.style.setProperty('width', '100%', 'important')
          body.style.setProperty('max-width', 'none', 'important')
          body.style.setProperty('align-self', 'stretch', 'important')
          body.style.setProperty('box-sizing', 'border-box', 'important')
          body.style.setProperty('align-items', 'center', 'important')
          body.style.setProperty('text-align', 'center', 'important')
        })
      bonusKpis
        .querySelectorAll<HTMLElement>(
          '[data-bonus-card-label], [data-bonus-card-value], [data-bonus-card-sub]',
        )
        .forEach((content) => {
          content.style.setProperty('width', '100%', 'important')
          content.style.setProperty('max-width', 'none', 'important')
          content.style.setProperty('text-align', 'center', 'important')
          content.style.setProperty('box-sizing', 'border-box', 'important')
        })
    }

    const bonusBody = root.querySelector<HTMLElement>('[data-bonus-body]')
    if (bonusBody) {
      fullWidth(bonusBody)
      bonusBody.style.setProperty('display', 'grid', 'important')
      bonusBody.style.setProperty(
        'grid-template-columns',
        'minmax(0, 0.38fr) minmax(0, 0.62fr)',
        'important',
      )
      bonusBody.style.setProperty('flex', '1 1 0', 'important')
      bonusBody.style.setProperty('min-height', '0', 'important')
      bonusBody.style.setProperty('max-height', '100%', 'important')
      bonusBody.style.setProperty('overflow', 'hidden', 'important')
      bonusBody.style.setProperty('gap', `${gridGap}px`, 'important')
      bonusBody.style.setProperty('margin', '0', 'important')
      bonusBody.style.setProperty('align-items', 'start', 'important')
      bonusBody.querySelectorAll<HTMLElement>(':scope > *').forEach((card) => {
        card.style.setProperty('width', '100%', 'important')
        card.style.setProperty('max-width', 'none', 'important')
        card.style.setProperty('min-width', '0', 'important')
        card.style.setProperty('border-radius', '12px', 'important')
        card.style.setProperty('overflow', 'hidden', 'important')
        card.style.setProperty('display', 'flex', 'important')
        card.style.setProperty('flex-direction', 'column', 'important')
        card.style.setProperty('box-sizing', 'border-box', 'important')
        card.style.setProperty('background', '#FFFFFF', 'important')
        card.style.setProperty('background-color', '#FFFFFF', 'important')
      })
      const tabela = bonusBody.querySelector<HTMLElement>('[data-bonus-tabela]')
      if (tabela) {
        tabela.style.setProperty('height', '100%', 'important')
        tabela.style.setProperty('min-height', '0', 'important')
        tabela.style.setProperty('align-self', 'stretch', 'important')
      }
      const premissas = bonusBody.querySelector<HTMLElement>('[data-bonus-premissas]')
      if (premissas) {
        premissas.style.setProperty('height', 'fit-content', 'important')
        premissas.style.setProperty('align-self', 'center', 'important')
      }
      bonusBody
        .querySelectorAll<HTMLElement>('[data-bonus-section-header]')
        .forEach((header) => {
          header.style.setProperty('width', '100%', 'important')
          header.style.setProperty('max-width', 'none', 'important')
          header.style.setProperty('align-self', 'stretch', 'important')
          header.style.setProperty('box-sizing', 'border-box', 'important')
        })
      bonusBody.querySelectorAll<HTMLElement>('table').forEach((table) => {
        table.style.setProperty('width', '100%', 'important')
        table.style.setProperty('max-width', 'none', 'important')
      })
    }

    const footer = root.querySelector<HTMLElement>('[data-apresentacao-top-contratos]')
    if (footer) {
      fullWidth(footer)
      footer.style.setProperty('flex', '0 0 auto', 'important')
      footer.style.setProperty('margin', '0', 'important')
      footer.style.setProperty('border-radius', '8px', 'important')
      footer.style.setProperty('padding', '12px 14px 14px', 'important')
      footer.style.setProperty('box-sizing', 'border-box', 'important')
      footer.style.setProperty('border', '1px solid #E6E8EB', 'important')
      footer.style.setProperty('background', '#FFFFFF', 'important')
      footer.style.setProperty('background-color', '#FFFFFF', 'important')
      footer.style.setProperty('overflow', 'visible', 'important')
      footer.style.setProperty('min-height', '0', 'important')
      footer.style.setProperty('height', 'auto', 'important')
      footer.style.setProperty('max-height', 'none', 'important')
      const row =
        footer.querySelector<HTMLElement>('[data-top-contratos-row]') ??
        footer.querySelector<HTMLElement>(':scope > div:last-of-type')
      if (row) {
        row.style.setProperty('display', 'flex', 'important')
        row.style.setProperty('width', '100%', 'important')
        row.style.setProperty('gap', `${gridGap}px`, 'important')
        row.style.setProperty('align-items', 'stretch', 'important')
        row.style.setProperty('overflow', 'visible', 'important')
        row
          .querySelectorAll<HTMLElement>('[data-top-contrato-cell]')
          .forEach((cell) => {
            const hasValor = cell.querySelector('[data-top-contrato-valor]') != null
            cell.style.setProperty('flex', '1 1 0', 'important')
            cell.style.setProperty('min-width', '0', 'important')
            cell.style.setProperty('width', 'auto', 'important')
            cell.style.setProperty('max-width', 'none', 'important')
            cell.style.setProperty('min-height', hasValor ? '68px' : '52px', 'important')
            cell.style.setProperty('height', 'auto', 'important')
            cell.style.setProperty('padding', hasValor ? '12px 10px' : '10px 12px', 'important')
            cell.style.setProperty('border-radius', '8px', 'important')
            cell.style.setProperty('box-sizing', 'border-box', 'important')
            cell.style.setProperty('display', 'flex', 'important')
            cell.style.setProperty('flex-direction', 'column', 'important')
            cell.style.setProperty('align-items', 'center', 'important')
            cell.style.setProperty('justify-content', 'center', 'important')
            cell.style.setProperty('overflow', 'visible', 'important')
          })
        row.querySelectorAll<HTMLElement>('[data-top-contrato-content]').forEach((wrap) => {
          wrap.style.setProperty('display', 'flex', 'important')
          wrap.style.setProperty('flex-direction', 'column', 'important')
          wrap.style.setProperty('align-items', 'center', 'important')
          wrap.style.setProperty('justify-content', 'center', 'important')
          wrap.style.setProperty('width', '100%', 'important')
          wrap.style.setProperty('text-align', 'center', 'important')
          wrap.style.setProperty('gap', '6px', 'important')
        })
      }
    }

    root.querySelectorAll<HTMLElement>('[data-top-contrato-nome]').forEach((el) => {
      el.style.setProperty('font-size', '13px', 'important')
      el.style.setProperty('font-weight', '700', 'important')
      el.style.setProperty('line-height', '1.3', 'important')
      el.style.setProperty('white-space', 'normal', 'important')
      el.style.setProperty('word-break', 'break-word', 'important')
      el.style.setProperty('overflow-wrap', 'anywhere', 'important')
      el.style.setProperty('width', '100%', 'important')
      el.style.setProperty('text-align', 'center', 'important')
      el.style.setProperty('overflow', 'visible', 'important')
      el.style.setProperty('display', 'block', 'important')
      el.style.removeProperty('-webkit-line-clamp')
      el.style.removeProperty('-webkit-box-orient')
    })
    root.querySelectorAll<HTMLElement>('[data-top-contrato-valor]').forEach((el) => {
      el.style.setProperty('font-size', '11px', 'important')
      el.style.setProperty('font-weight', '700', 'important')
      el.style.setProperty('color', '#64748B', 'important')
      el.style.setProperty('font-variant-numeric', 'tabular-nums', 'important')
      el.style.setProperty('width', '100%', 'important')
      el.style.setProperty('text-align', 'center', 'important')
      el.style.setProperty('line-height', '1.25', 'important')
      el.style.setProperty('display', 'block', 'important')
      el.style.removeProperty('margin-top')
    })
    return
  }

  const padX = 18
  const padY = 14
  const gap = 7
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>('[data-overview-copy-card]'),
  )
  const headerCards = cards.filter((c) =>
    c.hasAttribute('data-apresentacao-area-header'),
  )
  const footerCards = cards.filter((c) =>
    c.hasAttribute('data-apresentacao-top-contratos'),
  )
  const bodyCards = cards.filter(
    (c) =>
      !c.hasAttribute('data-apresentacao-area-header') &&
      !c.hasAttribute('data-apresentacao-top-contratos'),
  )

  const headerH = headerCards.length > 0 ? 72 : 0
  const footerH = footerCards.length > 0 ? 56 : 0
  const headerBlock =
    headerCards.length > 0
      ? headerH * headerCards.length + gap * headerCards.length
      : 0
  const footerBlock =
    footerCards.length > 0
      ? footerH * footerCards.length + gap * footerCards.length
      : 0
  const bodyN = Math.max(1, bodyCards.length)
  const bodyAvail = Math.max(
    36 * bodyN,
    slideH - padY * 2 - headerBlock - footerBlock - gap * Math.max(0, bodyN - 1),
  )
  const desenvolvimentoCard = bodyCards.find(
    (card) =>
      card.getAttribute('data-overview-kpi-title') === 'Desenvolvimento Equipe',
  )
  // Desenvolvimento possui meta longa e valores em duas linhas. Reserva uma
  // linha mais alta no PPT; o espaço é descontado igualmente dos demais cards.
  const desenvolvimentoExtraH = desenvolvimentoCard ? 28 : 0
  const bodyCardH = Math.max(
    36,
    Math.floor((bodyAvail - desenvolvimentoExtraH) / bodyN),
  )
  const desenvolvimentoCardH = bodyCardH + desenvolvimentoExtraH
  const cardW = slideW - padX * 2

  // Tipografia única em todos os cards do Jurídico Unificado. Evita que textos
  // semelhantes mudem de tamanho conforme o comprimento ou tipo do indicador.
  const titleFs = scalePx(15)
  const metaFs = scalePx(11)
  const headFs = scalePx(12)
  const cellFs = scalePx(14)
  const titleColW = Math.round(240 * fontScale)
  const metaColW = Math.round(72 * fontScale)
  const areaTitleColW = Math.round(210 * fontScale)

  root.style.setProperty('position', 'relative', 'important')
  root.style.setProperty('width', `${slideW}px`, 'important')
  root.style.setProperty('min-width', `${slideW}px`, 'important')
  root.style.setProperty('max-width', `${slideW}px`, 'important')
  root.style.setProperty('height', `${slideH}px`, 'important')
  root.style.setProperty('min-height', `${slideH}px`, 'important')
  root.style.setProperty('max-height', `${slideH}px`, 'important')
  root.style.setProperty('padding', '0', 'important')
  root.style.setProperty('margin', '0', 'important')
  root.style.setProperty('box-sizing', 'border-box', 'important')
  root.style.setProperty('overflow', 'hidden', 'important')
  root.style.setProperty('background', 'transparent', 'important')
  root.style.setProperty('background-color', 'transparent', 'important')
  root.style.setProperty('display', 'block', 'important')

  let cursorY = padY

  const placeCard = (
    card: HTMLElement,
    height: number,
    opts?: { overflowVisible?: boolean; transparentBg?: boolean },
  ) => {
    card.style.setProperty('position', 'absolute', 'important')
    card.style.setProperty('left', `${padX}px`, 'important')
    card.style.setProperty('top', `${cursorY}px`, 'important')
    card.style.setProperty('width', `${cardW}px`, 'important')
    card.style.setProperty('min-width', `${cardW}px`, 'important')
    card.style.setProperty('max-width', `${cardW}px`, 'important')
    card.style.setProperty('height', `${height}px`, 'important')
    card.style.setProperty('min-height', `${height}px`, 'important')
    card.style.setProperty('max-height', `${height}px`, 'important')
    card.style.setProperty('box-sizing', 'border-box', 'important')
    card.style.setProperty(
      'overflow',
      opts?.overflowVisible ? 'visible' : 'hidden',
      'important',
    )
    card.style.setProperty('margin', '0', 'important')
    card.style.setProperty('padding', '6px 10px', 'important')
    card.style.setProperty('border-radius', '8px', 'important')
    if (opts?.transparentBg) {
      card.style.setProperty('background', 'transparent', 'important')
      card.style.setProperty('background-color', 'transparent', 'important')
      card.style.setProperty('border', 'none', 'important')
      card.style.setProperty('box-shadow', 'none', 'important')
    } else {
      card.style.setProperty('background', '#FFFFFF', 'important')
      card.style.setProperty('background-color', '#FFFFFF', 'important')
      card.style.setProperty('border', '1px solid #E2E8F0', 'important')
      card.style.setProperty('box-shadow', '0 1px 2px rgba(15,23,42,0.06)', 'important')
    }
    card.style.setProperty('display', 'block', 'important')
    card.style.setProperty('flex', 'none', 'important')
    cursorY += height + gap
  }

  headerCards.forEach((card) => {
    placeCard(card, headerH, { overflowVisible: true, transparentBg: true })
  })
  bodyCards.forEach((card) => {
    placeCard(
      card,
      card === desenvolvimentoCard ? desenvolvimentoCardH : bodyCardH,
    )
  })
  footerCards.forEach((card) => {
    placeCard(card, footerH)
  })

  cards.forEach((card) => {
    const wrap = card.firstElementChild as HTMLElement | null
    if (wrap) {
      wrap.style.setProperty('width', '100%', 'important')
      wrap.style.setProperty('height', '100%', 'important')
      wrap.style.setProperty(
        'overflow',
        card.hasAttribute('data-apresentacao-area-header') ? 'visible' : 'hidden',
        'important',
      )
      wrap.style.setProperty('display', 'block', 'important')
    }

    const isAreaMatrix =
      card.querySelector('[data-apresentacao-area-label]') != null ||
      card.querySelectorAll('colgroup col').length >= 8

    card.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
      table.style.setProperty('width', '100%', 'important')
      table.style.setProperty('min-width', '0', 'important')
      table.style.setProperty('max-width', '100%', 'important')
      table.style.setProperty('height', 'auto', 'important')
      table.style.setProperty('table-layout', 'fixed', 'important')
      table.style.setProperty('border-collapse', 'collapse', 'important')

      const cols = Array.from(table.querySelectorAll('colgroup col'))
      if (cols.length >= 2) {
        if (isAreaMatrix && cols.length >= 8) {
          const titleW = areaTitleColW
          const metaW = metaColW
          const restN = cols.length - 2
          const restW = Math.max(
            70,
            Math.floor((cardW - 28 - titleW - metaW) / restN),
          )
          cols.forEach((col, ci) => {
            const el = col as HTMLElement
            const w = ci === 0 ? titleW : ci === 1 ? metaW : restW
            el.style.setProperty('width', `${w}px`, 'important')
          })
        } else {
          const titleW = titleColW
          const monthN = cols.length - 1
          const monthW = Math.max(28, Math.floor((cardW - 28 - titleW) / monthN))
          cols.forEach((col, ci) => {
            const el = col as HTMLElement
            el.style.setProperty(
              'width',
              `${ci === 0 ? titleW : monthW}px`,
              'important',
            )
          })
        }
      }
    })

    card.querySelectorAll<HTMLTableRowElement>('tr').forEach((tr) => {
      tr.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell, colIdx) => {
        const isHeader = cell.tagName === 'TH'
        const baseFs =
          colIdx === 0
            ? titleFs
            : colIdx === 1 && isAreaMatrix && !isHeader
              ? metaFs
              : isHeader
                ? headFs
                : cellFs
        const fs = baseFs
        const fontWeight = isHeader
          ? colIdx === 0
            ? '700'
            : '600'
          : colIdx === 0 || (isAreaMatrix && colIdx === 1)
            ? '600'
            : cell.style.fontWeight || '600'
        cell.style.setProperty('font-size', `${fs}px`, 'important')
        cell.style.setProperty('font-weight', fontWeight, 'important')
        cell.style.setProperty(
          'text-align',
          colIdx === 0 ? 'left' : 'center',
          'important',
        )
        cell.style.setProperty('vertical-align', 'middle', 'important')
        cell.style.setProperty(
          'padding',
          colIdx === 0 ? '2px 6px 2px 3px' : cell.style.padding || '2px 3px',
          'important',
        )
        if (colIdx === 0) {
          cell.style.setProperty('line-height', isHeader ? '1.15' : '1.05', 'important')
          cell.style.setProperty('white-space', isHeader ? 'nowrap' : 'normal', 'important')
          cell.style.setProperty('overflow', 'visible', 'important')
          cell.style.setProperty('word-break', 'normal', 'important')
          cell.style.setProperty('overflow-wrap', 'normal', 'important')
          cell.style.setProperty('vertical-align', 'middle', 'important')
        } else if (isStackedHeatCell(cell)) {
          applyStackedHeatCellExportStyles(cell, cellFs)
        } else {
          cell.style.setProperty('line-height', '1.15', 'important')
          cell.style.setProperty('white-space', 'nowrap', 'important')
        }
      })
    })

    card.querySelectorAll<HTMLElement>('tbody td div').forEach((div) => {
      if (div.hasAttribute('data-year-band-pill')) return
      if (isStackedHeatCell(div)) return
      const textLength = (div.textContent ?? '').trim().length
      const fittedFs =
        textLength > 14
          ? Math.max(10, cellFs * 0.7)
          : textLength > 10
            ? Math.max(11, cellFs * 0.82)
            : cellFs
      div.style.setProperty('font-size', `${fittedFs}px`, 'important')
      div.style.setProperty('line-height', '1.1', 'important')
      div.style.setProperty('white-space', 'nowrap', 'important')
    })

    card.querySelectorAll<HTMLElement>('[data-year-band-pill]').forEach((pill) => {
      pill.style.setProperty('font-size', `${cellFs}px`, 'important')
      pill.style.setProperty('font-weight', '700', 'important')
      pill.style.setProperty('padding', '3px 2px', 'important')
      pill.style.setProperty(
        'min-height',
        `${Math.max(16, Math.round(bodyCardH * 0.32))}px`,
        'important',
      )
    })

    card.querySelectorAll<HTMLElement>('[data-top-contrato-nome]').forEach((el) => {
      el.style.setProperty(
        'font-size',
        `${Math.max(11, Math.min(14, cellFs))}px`,
        'important',
      )
      el.style.setProperty('font-weight', '700', 'important')
    })
  })
}

/**
 * html2canvas/foreignObject não funde border-radius parcial entre células.
 * No clone, troca as pílulas mensais por uma faixa absoluta por ano (Ago–Dez, Jan–Jul…).
 */
function mergeYearBandPillsForExport(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-overview-copy-card]').forEach((card) => {
    const pills = Array.from(
      card.querySelectorAll<HTMLElement>('[data-year-band-pill]'),
    )
    if (pills.length === 0) return

    // Card já é `position: absolute` no fill-slide — âncora ok para overlays.

    // Zera padding horizontal das células para a faixa cobrir o quadrante do mês inteiro.
    for (const pill of pills) {
      const td = pill.parentElement
      if (!(td instanceof HTMLElement)) continue
      td.style.setProperty('padding-left', '0', 'important')
      td.style.setProperty('padding-right', '0', 'important')
      td.style.setProperty('padding-top', '2px', 'important')
      td.style.setProperty('padding-bottom', '2px', 'important')
      pill.style.setProperty('width', '100%', 'important')
      pill.style.setProperty('border-radius', '0', 'important')
    }
    void card.offsetWidth

    const groups = new Map<string, HTMLElement[]>()
    for (const pill of pills) {
      const key = pill.getAttribute('data-year-band-group') ?? '_'
      const list = groups.get(key) ?? []
      list.push(pill)
      groups.set(key, list)
    }

    const cardRect = card.getBoundingClientRect()

    for (const groupPills of groups.values()) {
      if (groupPills.length === 0) continue

      const tds = groupPills
        .map((p) => p.parentElement)
        .filter((el): el is HTMLElement => el instanceof HTMLElement)
      if (tds.length === 0) continue

      const firstTd = tds[0]!
      const lastTd = tds[tds.length - 1]!
      const firstRect = firstTd.getBoundingClientRect()
      const lastRect = lastTd.getBoundingClientRect()
      const samplePill = groupPills.find((p) => {
        const t = (p.textContent ?? '').replace(/\u00A0/g, ' ').trim()
        return t.length > 0 && t !== '-'
      }) ?? groupPills[0]!

      let label = ''
      for (const pill of groupPills) {
        const t = (pill.textContent ?? '').replace(/\u00A0/g, ' ').trim()
        if (t && t !== '-') label = t
      }

      const bg =
        samplePill.getAttribute('data-band-bg') ||
        samplePill.style.backgroundColor ||
        '#FEE2E2'
      const color =
        samplePill.getAttribute('data-band-fg') ||
        samplePill.style.color ||
        '#DC2626'
      const fontSize = samplePill.style.fontSize || '11px'

      const bl = parseFloat(window.getComputedStyle(firstTd).borderLeftWidth) || 0
      const left = firstRect.left - cardRect.left + bl
      const top = firstRect.top - cardRect.top + 2
      const width = Math.max(8, lastRect.right - firstRect.left - bl)
      const height = Math.max(16, firstRect.height - 4)

      for (const pill of groupPills) {
        pill.style.setProperty('visibility', 'hidden', 'important')
        pill.style.setProperty('opacity', '0', 'important')
      }

      const overlay = document.createElement('div')
      overlay.setAttribute('data-year-band-merged', '1')
      const labelSpan = document.createElement('span')
      labelSpan.textContent = label || '-'
      labelSpan.style.setProperty('color', color, 'important')
      labelSpan.style.setProperty('-webkit-text-fill-color', color, 'important')
      labelSpan.style.setProperty('font-weight', '700', 'important')
      labelSpan.style.setProperty('font-size', fontSize, 'important')
      overlay.appendChild(labelSpan)
      overlay.style.setProperty('position', 'absolute', 'important')
      overlay.style.setProperty('left', `${left}px`, 'important')
      overlay.style.setProperty('top', `${top}px`, 'important')
      overlay.style.setProperty('width', `${width}px`, 'important')
      overlay.style.setProperty('height', `${height}px`, 'important')
      overlay.style.setProperty('box-sizing', 'border-box', 'important')
      overlay.style.setProperty('border-radius', '6px', 'important')
      overlay.style.setProperty('background', bg, 'important')
      overlay.style.setProperty('background-color', bg, 'important')
      overlay.style.setProperty('color', color, 'important')
      overlay.style.setProperty('-webkit-text-fill-color', color, 'important')
      overlay.style.setProperty('font-weight', '700', 'important')
      overlay.style.setProperty('font-size', fontSize, 'important')
      overlay.style.setProperty('line-height', '1', 'important')
      overlay.style.setProperty('display', 'flex', 'important')
      overlay.style.setProperty('align-items', 'center', 'important')
      overlay.style.setProperty('justify-content', 'center', 'important')
      overlay.style.setProperty('border', '1px solid rgba(15,23,42,0.08)', 'important')
      overlay.style.setProperty('pointer-events', 'none', 'important')
      overlay.style.setProperty('z-index', '2', 'important')
      overlay.style.setProperty('print-color-adjust', 'exact', 'important')
      overlay.style.setProperty('-webkit-print-color-adjust', 'exact', 'important')
      card.appendChild(overlay)
    }
  })
}

/**
 * Slide Apresentação Jurídico → PNG no tamanho físico do PPT
 * (33,87 cm × 16,32 cm).
 *
 * Com `data-apresentacao-fill-slide` (Bloco 2): layout absoluto no tamanho do
 * slide + tipografia ampliada — PNG preenche toda a área de colagem.
 */
export async function copyApresentacaoSlideToClipboard(
  element: HTMLElement,
  scale = DEFAULT_SCALE,
): Promise<void> {
  /** Dimensão física do slide (cm). */
  const SLIDE_CM_W = 33.87
  const SLIDE_CM_H = 16.32
  /** Pixels lógicos proporcionais (~2,076:1). */
  const SLIDE_W = 1920
  const SLIDE_H = Math.round((SLIDE_W * SLIDE_CM_H) / SLIDE_CM_W) // ≈ 925
  const SLIDE_IN_W = SLIDE_CM_W / 2.54
  const SLIDE_IN_H = SLIDE_CM_H / 2.54

  const fillSlide = element.hasAttribute('data-apresentacao-fill-slide')
  const prepared = prepareApresentacaoExportElement(element)

  let width: number
  let height: number

  const exportId = element.getAttribute('data-apresentacao-export')
  const fontScale = resolveApresentacaoExportFontScale(exportId)
  const layoutFontScale = exportId === 'juridico_unificado' ? fontScale : 1

  if (fillSlide) {
    applyApresentacaoFillSlideLayout(prepared, SLIDE_W, SLIDE_H, layoutFontScale)
    // Monta no DOM para o layout absoluto “assar” antes do foreignObject.
    prepared.style.setProperty('position', 'fixed', 'important')
    prepared.style.setProperty('left', '-10000px', 'important')
    prepared.style.setProperty('top', '0', 'important')
    prepared.style.setProperty('visibility', 'hidden', 'important')
    document.body.appendChild(prepared)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    if (exportId === 'juridico_unificado') {
      fitApresentacaoTableText(prepared)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }
    // Retenção: funde pílulas mensais em faixas por ano (html2canvas não une células).
    prepared.style.setProperty('visibility', 'visible', 'important')
    mergeYearBandPillsForExport(prepared)
    prepared.style.setProperty('visibility', 'hidden', 'important')
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
    if (exportId !== 'juridico_unificado') {
      bumpApresentacaoExportFonts(prepared, fontScale)
    }
    width = SLIDE_W
    height = SLIDE_H
  } else {
    bumpApresentacaoExportFonts(prepared, fontScale)
    const measured = measurePreparedElement(prepared)
    width = measured.width
    height = measured.height
  }

  if (width === 0 || height === 0) {
    if (fillSlide && prepared.parentNode) prepared.parentNode.removeChild(prepared)
    throw new Error('Slide ainda não renderizado')
  }

  try {
    const contentBlob = await renderPreparedElementToPngBlob(prepared, width, height, scale)
    const part = await measureBlobPart(contentBlob)
    const img = await blobToImage(part.blob)

    const canvas = document.createElement('canvas')
    canvas.width = SLIDE_W * scale
    canvas.height = SLIDE_H * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas não suportado neste navegador')

    if (fillSlide) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const fit = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight)
      const dw = img.naturalWidth * fit
      const dh = img.naturalHeight * fit
      const dx = (canvas.width - dw) / 2
      const dy = (canvas.height - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Falha ao gerar imagem PNG'))),
        'image/png',
      )
    })

    const dpi = Math.round((SLIDE_W * scale) / SLIDE_IN_W)
    void SLIDE_IN_H
    await copyPngBlobToClipboard(blob, dpi)
  } finally {
    if (fillSlide && prepared.parentNode) prepared.parentNode.removeChild(prepared)
  }
}

/** Cards KPI do Overview — snapshot fiel (cores das células alinhadas ao card branco). */
export async function copyOverviewKpiCardsToClipboard(
  cards: HTMLElement[],
  scale = DEFAULT_SCALE,
): Promise<void> {
  if (cards.length === 0) {
    throw new Error('Conteúdo não disponível para cópia')
  }

  const gapPx = Math.round(12 * scale)
  const parts = await Promise.all(
    cards.map(async (card) => {
      const rect = card.getBoundingClientRect()
      const width = Math.max(1, Math.ceil(rect.width))
      const height = Math.max(1, Math.ceil(rect.height))
      const prepared = preparePrintSnapshotElement(card, { preserveBackground: true })
      const blob = await renderPreparedElementToPngBlob(prepared, width, height, scale)
      return measureBlobPart(blob)
    }),
  )

  const stacked = await compositeColumnParts(parts, gapPx)
  await copyPngBlobToClipboard(stacked.blob, 96 * scale)
}

export async function chartToPngBlob(
  exportRoot: HTMLElement,
  scale = DEFAULT_SCALE,
): Promise<Blob> {
  const legendEl = exportRoot.querySelector<HTMLElement>('[data-chart-legend]')
  const plotEl = exportRoot.querySelector<HTMLElement>('[data-chart-plot]')
  const tableEl = exportRoot.querySelector<HTMLElement>('[data-chart-export-table]')

  if (!plotEl) {
    throw new Error('Área do gráfico não encontrada')
  }

  const chartBlob = await compositeToPngBlob(legendEl, plotEl, scale)
  if (!tableEl) return chartBlob

  const tableGapPx = Math.round(EXPORT_TABLE_GAP * scale)
  const [chartPart, tablePart] = await Promise.all([
    measureBlobPart(chartBlob),
    measureBlobPart(await htmlElementToPngBlob(tableEl, scale)),
  ])

  const stacked = await compositeColumnParts([chartPart, tablePart], tableGapPx)
  return stacked.blob
}

export async function copyChartImageToClipboard(
  exportRoot: HTMLElement,
  scale = DEFAULT_SCALE,
): Promise<void> {
  const blob = await chartToPngBlob(exportRoot, scale)
  await copyPngBlobToClipboard(blob, 96 * scale)
}

type ImagePart = { blob: Blob; width: number; height: number }

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Falha ao carregar imagem'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function measureBlobPart(blob: Blob): Promise<ImagePart> {
  const img = await blobToImage(blob)
  return { blob, width: img.naturalWidth, height: img.naturalHeight }
}

async function compositeRowParts(parts: ImagePart[], gapPx: number): Promise<ImagePart> {
  const width = parts.reduce((sum, part, index) => sum + part.width + (index > 0 ? gapPx : 0), 0)
  const height = Math.max(...parts.map((part) => part.height))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador')

  let x = 0
  for (const part of parts) {
    const img = await blobToImage(part.blob)
    ctx.drawImage(img, x, 0, part.width, part.height)
    x += part.width + gapPx
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Falha ao gerar imagem PNG'))),
      'image/png',
    )
  })

  return { blob, width, height }
}

async function compositeColumnParts(parts: ImagePart[], gapPx: number): Promise<ImagePart> {
  const width = Math.max(...parts.map((part) => part.width))
  const height = parts.reduce((sum, part, index) => sum + part.height + (index > 0 ? gapPx : 0), 0)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador')

  let y = 0
  for (const part of parts) {
    const img = await blobToImage(part.blob)
    ctx.drawImage(img, 0, y, part.width, part.height)
    y += part.height + gapPx
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Falha ao gerar imagem PNG'))),
      'image/png',
    )
  })

  return { blob, width, height }
}

export type InadimplenciaKpiPackExportElements = {
  acumulada: HTMLElement
  pct: HTMLElement
  top5: HTMLElement
}

/** KPIs Resultado R$ / % + top 5 inadimplentes em um único PNG para PowerPoint. */
export async function copyInadimplenciaKpiPackToClipboard(
  elements: InadimplenciaKpiPackExportElements,
  scale = DEFAULT_SCALE,
): Promise<void> {
  const gridGap = 16
  const acumuladaRect = elements.acumulada.getBoundingClientRect()
  const pctRect = elements.pct.getBoundingClientRect()
  const top5Rect = elements.top5.getBoundingClientRect()

  const rowWidth = acumuladaRect.width + gridGap + pctRect.width
  const rowHeight = Math.max(acumuladaRect.height, pctRect.height)
  const totalWidth = Math.max(rowWidth, top5Rect.width)
  const totalHeight = rowHeight + gridGap + top5Rect.height

  const wrapper = document.createElement('div')
  wrapper.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    `width:${totalWidth}px`,
    `height:${totalHeight}px`,
    'background:transparent',
    'overflow:hidden',
    'box-sizing:border-box',
  ].join(';')

  const row = document.createElement('div')
  row.style.cssText = [
    'display:block',
    'white-space:nowrap',
    'font-size:0',
    'line-height:0',
    `width:${rowWidth}px`,
    `height:${rowHeight}px`,
  ].join(';')

  const acumuladaClone = preparePrintSnapshotElement(elements.acumulada, { preserveBackground: true })
  const pctClone = preparePrintSnapshotElement(elements.pct, { preserveBackground: true })
  acumuladaClone.style.setProperty('display', 'inline-block', 'important')
  acumuladaClone.style.setProperty('vertical-align', 'top', 'important')
  pctClone.style.setProperty('display', 'inline-block', 'important')
  pctClone.style.setProperty('vertical-align', 'top', 'important')
  pctClone.style.setProperty('margin-left', `${gridGap}px`, 'important')

  row.appendChild(acumuladaClone)
  row.appendChild(pctClone)

  const top5Clone = preparePrintSnapshotElement(elements.top5, { preserveBackground: true })
  top5Clone.style.setProperty('display', 'block', 'important')
  top5Clone.style.setProperty('margin-top', `${gridGap}px`, 'important')

  wrapper.appendChild(row)
  wrapper.appendChild(top5Clone)
  document.body.appendChild(wrapper)

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const width = Math.max(1, Math.ceil(totalWidth))
  const height = Math.max(1, Math.ceil(totalHeight))

  try {
    const blob = await renderPreparedElementToPngBlob(wrapper, width, height, scale)
    await copyPngBlobToClipboard(blob, 96 * scale)
  } finally {
    wrapper.remove()
  }
}

export type InadimplenciaPackExportElements = {
  acumulada: HTMLElement
  pct: HTMLElement
  top5: HTMLElement
  chartRoot: HTMLElement
}

/** KPIs + top 5 + gráfico comparativo (somente linha inadimplência) em um único PNG. */
export async function copyInadimplenciaPackToClipboard(
  elements: InadimplenciaPackExportElements,
  scale = DEFAULT_SCALE,
): Promise<void> {
  const preserveBg = { preserveBackground: true } as const
  const gapPx = Math.round(16 * scale)
  const rowGapPx = Math.round(20 * scale)

  const [acumuladaPart, pctPart, top5Part, chartBlob] = await Promise.all([
    measureBlobPart(await htmlElementToPngBlob(elements.acumulada, scale, preserveBg)),
    measureBlobPart(await htmlElementToPngBlob(elements.pct, scale, preserveBg)),
    measureBlobPart(await htmlElementToPngBlob(elements.top5, scale, preserveBg)),
    chartToPngBlob(elements.chartRoot, scale),
  ])

  const kpiRow = await compositeRowParts([acumuladaPart, pctPart], gapPx)
  const chartPart = await measureBlobPart(chartBlob)
  const stacked = await compositeColumnParts([kpiRow, top5Part, chartPart], rowGapPx)

  await copyPngBlobToClipboard(stacked.blob, 96 * scale)
}
