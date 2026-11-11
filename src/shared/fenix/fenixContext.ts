import { createContext } from 'react'
import type { FenixExplicacao, FenixExplicar } from './fenix.types'

/** Atributo que marca um número explicável na tela. */
export const FENIX_ATRIBUTO = 'data-fenix'
/** Atributo da interface do próprio Fênix (o clique passa direto no modo de apontar). */
export const FENIX_UI_ATRIBUTO = 'data-fenix-ui'
/** Atributo no <html> enquanto a pessoa está apontando um número. */
export const FENIX_MODO_ATRIBUTO = 'data-fenix-inspecao'

export type FenixEstado = {
  painelAberto: boolean
  inspecionando: boolean
  selecionado: FenixExplicacao | null
  erro: string | null
  /** A tela atual não tem nenhum número explicável. */
  semAlvos: boolean
  /** A pessoa clicou num ponto sem explicação durante o modo de apontar. */
  avisoSemAlvo: boolean
  /** Ao cancelar o modo de apontar, reabre o painel (só quando ele estava aberto antes). */
  voltarAoPainel: boolean
}

export type FenixContexto = FenixEstado & {
  abrirPainel: () => void
  fecharPainel: () => void
  iniciarInspecao: () => void
  cancelarInspecao: () => void
}

export type FenixRegistrar = (id: string, explicar: FenixExplicar) => () => void

export const FenixEstadoCtx = createContext<FenixContexto | null>(null)

/** Separado do estado para os números da tela não re-renderizarem a cada clique no Fênix. */
export const FenixRegistroCtx = createContext<FenixRegistrar | null>(null)
