import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

function formatar(v: number, casas: number): string {
  if (!Number.isFinite(v)) return ''
  return v.toLocaleString('pt-BR', { maximumFractionDigits: casas, useGrouping: casas === 0 })
}

function parse(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(/^R\$/, '').replace(/\./g, '').replace(',', '.').replace('%', '')
  if (t === '' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Campo numérico pt-BR (vírgula decimal). Confirma ao sair do campo ou com Enter. Fundo âmbar = premissa editável. */
export function NumInput({
  value,
  onChange,
  casas = 2,
  sufixo,
  className,
  min,
  max,
  ariaLabel,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  casas?: number
  sufixo?: string
  className?: string
  min?: number
  max?: number
  ariaLabel?: string
  disabled?: boolean
}) {
  const [texto, setTexto] = useState(formatar(value, casas))
  useEffect(() => setTexto(formatar(value, casas)), [value, casas])
  const confirmar = () => {
    let n = parse(texto)
    if (n == null) n = 0
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    setTexto(formatar(n, casas))
    if (n !== value) onChange(n)
  }
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <input
        value={texto}
        aria-label={ariaLabel}
        disabled={disabled}
        inputMode="decimal"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="h-7 w-full min-w-0 rounded-md border border-amber-300 bg-amber-50 px-1.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-60"
      />
      {sufixo && <span className="shrink-0 text-[10px] text-slate-400">{sufixo}</span>}
    </span>
  )
}
