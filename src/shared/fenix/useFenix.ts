import { useContext, useEffect, useId } from 'react'
import type { FenixExplicar } from './fenix.types'
import { FenixEstadoCtx, FenixRegistroCtx, type FenixContexto } from './fenixContext'

export function useFenix(): FenixContexto | null {
  return useContext(FenixEstadoCtx)
}

/**
 * Marca um número como explicável. Devolve o valor do atributo `data-fenix`
 * para o elemento que mostra o número (ou `undefined` fora do layout com Fênix).
 * `explicar` só roda quando a pessoa clica, com os valores daquele momento.
 */
export function useFenixAlvo(chave: string | undefined, explicar: FenixExplicar | undefined): string | undefined {
  const registrar = useContext(FenixRegistroCtx)
  const uid = useId()
  const id = chave ? `${chave}${uid}` : undefined
  useEffect(() => {
    if (!registrar || !id || !explicar) return
    return registrar(id, explicar)
  }, [registrar, id, explicar])
  return registrar && id && explicar ? id : undefined
}
