import { forwardRef, type HTMLAttributes } from 'react'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { useFenixAlvo } from '@/shared/fenix/useFenix'

export type FenixAlvoProp = { chave: string; explicar: FenixExplicar }

/**
 * Mesmo `<div>` de antes, só com o `data-fenix`. Serve para números renderizados
 * depois de retornos antecipados, onde o componente pai não pode chamar o hook.
 */
export const FenixDiv = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { fenix?: FenixAlvoProp }>(
  function FenixDiv({ fenix, ...props }, ref) {
    const id = useFenixAlvo(fenix?.chave, fenix?.explicar)
    return <div ref={ref} data-fenix={id} {...props} />
  },
)

/** Mesma `<tr>` de antes, com o `data-fenix`. */
export function FenixTr({ fenix, ...props }: HTMLAttributes<HTMLTableRowElement> & { fenix?: FenixAlvoProp }) {
  const id = useFenixAlvo(fenix?.chave, fenix?.explicar)
  return <tr data-fenix={id} {...props} />
}
