import { cn } from '@/lib/utils'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface Props {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onDoubleClickReset?: () => void
}

/** Divisor entre o histórico e o campo de digitação (arrastar ↕). */
export function WhatsappComposerResizeHandle({ onPointerDown, onDoubleClickReset }: Props) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Redimensionar campo de mensagem"
      title="Arraste para cima ou para baixo para ajustar o tamanho do campo de mensagem"
      className={cn(
        'relative z-20 shrink-0 cursor-ns-resize touch-none select-none',
        'border-t border-slate-200 bg-slate-100/90',
        'hover:bg-emerald-50 active:bg-emerald-100',
      )}
      style={{ height: 10 }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.preventDefault()
        onDoubleClickReset?.()
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        <span className="h-1 w-14 rounded-full bg-slate-400 shadow-sm" />
      </div>
    </div>
  )
}
