import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  className?: string
}

/** Editor visual de corpo de e-mail HTML (negrito, parágrafos). */
export function EmailHtmlEditor({ value, onChange, disabled, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Não sobrescreve enquanto o usuário edita (evita pular o cursor).
    if (document.activeElement === el) return
    if (el.innerHTML !== value) {
      el.innerHTML = value
    }
  }, [value])

  const handleInput = () => {
    const el = ref.current
    if (!el) return
    onChange(el.innerHTML)
  }

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      className={cn(
        'min-h-[320px] w-full overflow-y-auto rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&_p]:mb-3 [&_p:last-child]:mb-0',
        '[&_strong]:font-semibold [&_strong]:text-slate-900',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    />
  )
}
