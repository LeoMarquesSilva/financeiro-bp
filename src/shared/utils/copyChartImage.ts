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

function isColorSwatch(el: HTMLElement): boolean {
  const inline = el.style.backgroundColor
  if (inline && inline !== 'transparent') return true
  const bg = window.getComputedStyle(el).backgroundColor
  return bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'
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

function shouldInlineRowCardExport(source: HTMLElement): boolean {
  return source.hasAttribute('data-chart-export-inline-row')
}

function shouldPrintSnapshotExport(source: HTMLElement): boolean {
  if (!source.hasAttribute('data-chart-export-preserve-bg')) return false
  if (shouldExpandExportWidth(source)) return false
  if (shouldFitContentExport(source)) return false
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
      child.style.setProperty('border-radius', '9999px', 'important')
      child.style.setProperty('overflow', 'hidden', 'important')
    }
  })
}

/** Clone fiel ao que está na tela — sem redimensionar, só remove nós ignorados. */
function preparePrintSnapshotElement(source: HTMLElement, options?: HtmlExportOptions): HTMLElement {
  const { preserveBackground } = resolveHtmlExportOptions(source, options)
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())
  inlineNodeStyles(source, clone)

  const sourceStyle = window.getComputedStyle(source)
  const rect = source.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(rect.width))
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

  const display = sourceStyle.display
  if (display === 'flex' || display === 'inline-flex') {
    applyPrintFlexRowFix(clone, source)
  }

  return clone
}

function isFixedSizeIcon(el: HTMLElement): boolean {
  const cls = el.className
  if (typeof cls !== 'string') return false
  return (
    el.classList.contains('shrink-0') &&
    (/\bh-10\b/.test(cls) || /\bh-11\b/.test(cls)) &&
    (/\bw-10\b/.test(cls) || /\bw-11\b/.test(cls))
  )
}

async function renderPreparedElementToPngBlob(
  prepared: HTMLElement,
  width: number,
  height: number,
  scale = DEFAULT_SCALE,
): Promise<Blob> {
  // Clona para não mover o nó original (ex.: wrapper montado em document.body).
  const snapshot = prepared.cloneNode(true) as HTMLElement
  snapshot.style.position = 'static'
  snapshot.style.left = 'auto'
  snapshot.style.visibility = 'visible'
  snapshot.style.width = `${width}px`
  snapshot.style.height = `${height}px`
  snapshot.style.overflow = 'hidden'

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
  cell.style.setProperty('width', `${size}px`, 'important')
  cell.style.setProperty('min-width', `${size}px`, 'important')
  cell.style.setProperty('max-width', `${size}px`, 'important')
  cell.style.setProperty('height', `${size}px`, 'important')
  cell.style.setProperty('min-height', `${size}px`, 'important')
  cell.style.setProperty('max-height', `${size}px`, 'important')
  cell.style.setProperty('border-radius', '9999px', 'important')
  cell.style.setProperty('overflow', 'hidden', 'important')
  cell.style.setProperty('box-sizing', 'border-box', 'important')
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

function applyPreserveBackgroundExportLayout(
  root: HTMLElement,
  source: HTMLElement,
  expandWidth = false,
  fitContent = false,
): void {
  const inlineRow = shouldInlineRowCardExport(source)
  const sourceStyle = window.getComputedStyle(source)
  const sourceWidth = Math.ceil(source.getBoundingClientRect().width)

  stripInlineHeights(root)

  root.style.setProperty('position', 'static', 'important')
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
    prepared.offsetHeight || prepared.getBoundingClientRect().height || prepared.scrollHeight,
  )
  document.body.removeChild(prepared)

  return { width, height }
}

function prepareHtmlExportElement(source: HTMLElement, options?: HtmlExportOptions): HTMLElement {
  const { preserveBackground } = resolveHtmlExportOptions(source, options)
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-chart-export-ignore]').forEach((el) => el.remove())
  inlineNodeStyles(source, clone)

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

  if (printSnapshot) {
    const prepared = preparePrintSnapshotElement(element, options)
    const rect = element.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(rect.width))
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
  const fixedWidth = preserveBackground
    ? Math.ceil(element.getBoundingClientRect().width)
    : undefined
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

async function copyPngBlobToClipboard(blob: Blob, dpi?: number): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Cópia de imagem não suportada neste navegador')
  }

  const finalBlob = dpi ? await embedPngDpi(blob, dpi) : blob
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': finalBlob })])
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
  const blob = await htmlElementToPngBlob(element, scale, options)
  await copyPngBlobToClipboard(blob, 96 * scale)
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
