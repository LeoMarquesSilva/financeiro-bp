import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { FenixExplicacao, FenixExplicar } from './fenix.types'
import {
  FENIX_ATRIBUTO,
  FENIX_MODO_ATRIBUTO,
  FENIX_UI_ATRIBUTO,
  FenixEstadoCtx,
  FenixRegistroCtx,
  type FenixContexto,
  type FenixEstado,
} from './fenixContext'

function dentroDaInterfaceFenix(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest(`[${FENIX_UI_ATRIBUTO}]`) != null
}

const ESTADO_INICIAL: FenixEstado = {
  painelAberto: false,
  inspecionando: false,
  selecionado: null,
  erro: null,
  semAlvos: false,
  avisoSemAlvo: false,
}

export function FenixProvider({ children }: { children: React.ReactNode }) {
  const registro = useRef(new Map<string, FenixExplicar>())
  const { pathname } = useLocation()
  const [estado, setEstado] = useState<FenixEstado>(ESTADO_INICIAL)

  const registrar = useCallback((id: string, explicar: FenixExplicar) => {
    registro.current.set(id, explicar)
    return () => {
      if (registro.current.get(id) === explicar) registro.current.delete(id)
    }
  }, [])

  const abrirPainel = useCallback(() => setEstado((s) => ({ ...s, painelAberto: true })), [])
  const fecharPainel = useCallback(
    () => setEstado((s) => ({ ...s, painelAberto: false, inspecionando: false, semAlvos: false })),
    [],
  )

  const iniciarInspecao = useCallback(() => {
    const temAlvo = document.querySelector(`[${FENIX_ATRIBUTO}]`) != null
    setEstado((s) =>
      temAlvo
        ? { ...s, inspecionando: true, painelAberto: false, semAlvos: false, avisoSemAlvo: false }
        : { ...s, painelAberto: true, semAlvos: true },
    )
  }, [])

  const cancelarInspecao = useCallback(
    () => setEstado((s) => ({ ...s, inspecionando: false, painelAberto: true, avisoSemAlvo: false })),
    [],
  )

  // Trocar de tela encerra o modo de apontar e o aviso de tela sem números.
  useEffect(() => {
    setEstado((s) => (s.inspecionando || s.semAlvos ? { ...s, inspecionando: false, semAlvos: false } : s))
  }, [pathname])

  useEffect(() => {
    if (!estado.inspecionando) return
    const html = document.documentElement
    html.setAttribute(FENIX_MODO_ATRIBUTO, '')

    /** No modo de apontar, o clique não abre detalhes nem navega: só escolhe o número. */
    const bloquear = (e: Event) => {
      if (dentroDaInterfaceFenix(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }

    const aoClicar = (e: MouseEvent) => {
      if (dentroDaInterfaceFenix(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      const el = e.target instanceof Element ? e.target.closest(`[${FENIX_ATRIBUTO}]`) : null
      const id = el?.getAttribute(FENIX_ATRIBUTO)
      const explicar = id ? registro.current.get(id) : undefined
      if (!explicar) {
        setEstado((s) => ({ ...s, avisoSemAlvo: true }))
        return
      }
      let selecionado: FenixExplicacao | null = null
      let erro: string | null = null
      try {
        selecionado = explicar()
      } catch (err) {
        erro = err instanceof Error ? err.message : 'Não foi possível montar a explicação deste número.'
      }
      setEstado((s) => ({
        ...s,
        inspecionando: false,
        painelAberto: true,
        avisoSemAlvo: false,
        selecionado,
        erro,
      }))
    }

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setEstado((s) => ({ ...s, inspecionando: false, painelAberto: true, avisoSemAlvo: false }))
    }

    const eventosBloqueados = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'submit'] as const
    for (const tipo of eventosBloqueados) document.addEventListener(tipo, bloquear, true)
    document.addEventListener('click', aoClicar, true)
    document.addEventListener('keydown', aoTeclar, true)
    return () => {
      html.removeAttribute(FENIX_MODO_ATRIBUTO)
      for (const tipo of eventosBloqueados) document.removeEventListener(tipo, bloquear, true)
      document.removeEventListener('click', aoClicar, true)
      document.removeEventListener('keydown', aoTeclar, true)
    }
  }, [estado.inspecionando])

  useEffect(() => {
    if (!estado.avisoSemAlvo) return
    const t = window.setTimeout(() => setEstado((s) => ({ ...s, avisoSemAlvo: false })), 3500)
    return () => window.clearTimeout(t)
  }, [estado.avisoSemAlvo])

  const valor = useMemo<FenixContexto>(
    () => ({ ...estado, abrirPainel, fecharPainel, iniciarInspecao, cancelarInspecao }),
    [estado, abrirPainel, fecharPainel, iniciarInspecao, cancelarInspecao],
  )

  return (
    <FenixRegistroCtx.Provider value={registrar}>
      <FenixEstadoCtx.Provider value={valor}>{children}</FenixEstadoCtx.Provider>
    </FenixRegistroCtx.Provider>
  )
}
