import { useCallback, useContext, useEffect, useId, useRef } from 'react'
import type { MouseHandlerDataParam } from 'recharts'
import type { FenixExplicacao, FenixExplicar, FenixPontoGrafico } from './fenix.types'
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

/**
 * Gráfico explicável (Recharts). No modo de apontar o clique é bloqueado, mas o mouse
 * continua mexendo o tooltip: o hook guarda o ponto sob o mouse e, no clique, `explicar`
 * recebe esse ponto (ou `null` quando o clique foi fora de um mês/categoria → explica o
 * gráfico inteiro).
 *
 * Uso: `const g = useFenixGrafico('receita.grafico.x', (ponto) => ...)`; `data-fenix={g.fenixId}`
 * no container do gráfico e `onMouseMove={g.onMouseMove} onMouseLeave={g.onMouseLeave}` no
 * BarChart/LineChart/ComposedChart (se já houver handlers, chame os dois).
 */
export function useFenixGrafico(
  chave: string | undefined,
  explicar: ((ponto: FenixPontoGrafico | null) => FenixExplicacao) | undefined,
) {
  const ponto = useRef<FenixPontoGrafico | null>(null)
  const fenixId = useFenixAlvo(chave, explicar ? () => explicar(ponto.current) : undefined)

  const onMouseMove = useCallback((estado: MouseHandlerDataParam) => {
    const indice = Number(estado?.activeTooltipIndex)
    ponto.current =
      estado?.isTooltipActive && Number.isInteger(indice) && indice >= 0
        ? {
            indice,
            rotulo: estado.activeLabel != null ? String(estado.activeLabel) : null,
            serie: estado.activeDataKey != null ? String(estado.activeDataKey) : null,
          }
        : null
  }, [])

  const onMouseLeave = useCallback(() => {
    ponto.current = null
  }, [])

  return { fenixId, onMouseMove, onMouseLeave }
}
