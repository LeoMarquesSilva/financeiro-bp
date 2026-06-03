import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const STORAGE_KEY = 'whatsapp-inbox-composer-height'
/** Altura total da faixa de digitação (~3 linhas + botões + padding). */
export const COMPOSER_HEIGHT_DEFAULT = 148
const COMPOSER_HEIGHT_MIN = 88
const COMPOSER_HEIGHT_MAX = 360

function readStoredHeight(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return COMPOSER_HEIGHT_DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n)) return COMPOSER_HEIGHT_DEFAULT
    return Math.min(COMPOSER_HEIGHT_MAX, Math.max(COMPOSER_HEIGHT_MIN, n))
  } catch {
    return COMPOSER_HEIGHT_DEFAULT
  }
}

function clampHeight(px: number): number {
  return Math.min(COMPOSER_HEIGHT_MAX, Math.max(COMPOSER_HEIGHT_MIN, px))
}

export function useComposerResize() {
  const [composerHeight, setComposerHeight] = useState(readStoredHeight)
  const heightRef = useRef(composerHeight)
  heightRef.current = composerHeight

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(composerHeight))
    } catch {
      /* ignore */
    }
  }, [composerHeight])

  const onHandlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)

    const startY = e.clientY
    const startH = heightRef.current

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      // Arrastar para cima aumenta o campo; para baixo diminui (como redimensionar uma borda superior).
      const next = clampHeight(startH - (ev.clientY - startY))
      heightRef.current = next
      setComposerHeight(next)
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      if (el.hasPointerCapture(ev.pointerId)) {
        el.releasePointerCapture(ev.pointerId)
      }
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }, [])

  const resetHeight = useCallback(() => {
    heightRef.current = COMPOSER_HEIGHT_DEFAULT
    setComposerHeight(COMPOSER_HEIGHT_DEFAULT)
  }, [])

  return { composerHeight, onHandlePointerDown, resetHeight }
}
