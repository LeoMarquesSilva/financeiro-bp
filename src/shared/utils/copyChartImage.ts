const DEFAULT_SCALE = 2
const LEGEND_GAP = 12
const EXPORT_TEXT_COLOR = '#000000'
const LEGEND_FONT = '600 11px system-ui, -apple-system, sans-serif'
const LEGEND_PAD_X = 10
const LEGEND_PAD_Y = 4
const LEGEND_ITEM_GAP = 8
const LEGEND_SWATCH_GAP = 6
const LEGEND_ROW_GAP = 6
const KEEP_WHITE_FILLS = new Set(['#fff', '#ffffff', 'white', 'rgb(255, 255, 255)', 'rgb(255,255,255)'])

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

function inlineNodeStyles(source: Element, target: Element): void {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) return

  const computed = window.getComputedStyle(source)
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i]
    target.style.setProperty(prop, computed.getPropertyValue(prop), computed.getPropertyPriority(prop))
  }

  for (let i = 0; i < source.children.length; i++) {
    const targetChild = target.children[i]
    if (targetChild) inlineNodeStyles(source.children[i], targetChild)
  }
}

function isColorSwatch(el: HTMLElement): boolean {
  const inline = el.style.backgroundColor
  if (inline && inline !== 'transparent') return true
  const bg = window.getComputedStyle(el).backgroundColor
  return bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'
}

function applyExportHtmlColors(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (isColorSwatch(el)) return
    const bg = window.getComputedStyle(el).backgroundColor
    if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
      el.style.setProperty('background', 'transparent', 'important')
    }
  })

  root.querySelectorAll<HTMLElement>('p, span, li, div').forEach((el) => {
    if (isColorSwatch(el)) return
    el.style.setProperty('color', EXPORT_TEXT_COLOR, 'important')
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
    el.style.setProperty('flex-shrink', '0', 'important')
  })
}

function measurePreparedElement(prepared: HTMLElement): { width: number; height: number } {
  prepared.style.position = 'absolute'
  prepared.style.left = '-9999px'
  prepared.style.top = '0'
  prepared.style.visibility = 'hidden'
  prepared.style.height = 'auto'
  prepared.style.width = 'max-content'
  prepared.style.maxWidth = 'none'
  prepared.style.boxSizing = 'border-box'

  document.body.appendChild(prepared)
  const width = Math.ceil(prepared.scrollWidth)
  const height = Math.ceil(prepared.scrollHeight)
  document.body.removeChild(prepared)

  return { width, height }
}

function prepareHtmlExportElement(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())
  inlineNodeStyles(source, clone)

  clone.style.setProperty('background', 'transparent', 'important')
  clone.style.setProperty('box-shadow', 'none', 'important')
  clone.style.setProperty('border', 'none', 'important')
  clone.style.setProperty('outline', 'none', 'important')

  applyExportHtmlColors(clone)
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

  clone.style.margin = '0'
  clone.style.padding = window.getComputedStyle(source).padding

  return clone
}

async function htmlElementToPngBlob(element: HTMLElement, scale = DEFAULT_SCALE): Promise<Blob> {
  const prepared = prepareHtmlExportElement(element)
  const { width, height } = measurePreparedElement(prepared)

  if (width === 0 || height === 0) {
    throw new Error('Legenda ainda não renderizada')
  }

  prepared.style.position = 'static'
  prepared.style.left = 'auto'
  prepared.style.visibility = 'visible'
  prepared.style.width = `${width}px`
  const exportHeight = height + 4

  prepared.style.height = `${exportHeight}px`

  const xhtmlNs = 'http://www.w3.org/1999/xhtml'
  const wrapper = document.createElement('div')
  wrapper.setAttribute('xmlns', xhtmlNs)
  wrapper.appendChild(prepared)

  const svgNs = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNs, 'svg')
  svg.setAttribute('xmlns', svgNs)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(exportHeight))

  const foreignObject = document.createElementNS(svgNs, 'foreignObject')
  foreignObject.setAttribute('width', '100%')
  foreignObject.setAttribute('height', '100%')
  foreignObject.appendChild(wrapper)
  svg.appendChild(foreignObject)

  const serialized = new XMLSerializer().serializeToString(svg)
  const img = await loadImageFromSvgString(serialized)

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = exportHeight * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não suportado neste navegador')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, exportHeight)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem PNG'))),
      'image/png',
    )
  })
}

async function copyPngBlobToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Cópia de imagem não suportada neste navegador')
  }

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export async function copyElementImageToClipboard(
  element: HTMLElement,
  scale = DEFAULT_SCALE,
): Promise<void> {
  const blob = await htmlElementToPngBlob(element, scale)
  await copyPngBlobToClipboard(blob)
}

export async function copyChartImageToClipboard(
  exportRoot: HTMLElement,
  scale = DEFAULT_SCALE,
): Promise<void> {
  const legendEl = exportRoot.querySelector<HTMLElement>('[data-chart-legend]')
  const plotEl = exportRoot.querySelector<HTMLElement>('[data-chart-plot]')

  if (!plotEl) {
    throw new Error('Área do gráfico não encontrada')
  }

  const blob = await compositeToPngBlob(legendEl, plotEl, scale)
  await copyPngBlobToClipboard(blob)
}
