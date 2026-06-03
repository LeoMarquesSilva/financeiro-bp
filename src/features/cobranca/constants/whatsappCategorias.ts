export type WhatsappChatCategoriaId = 'COBRANCA' | 'COLABORADOR_BP' | 'SOCIO'

/** Categoria aplicada automaticamente a conversas iniciadas pelo painel de cobrança. */
export const WHATSAPP_CATEGORIA_COBRANCA_AUTO: WhatsappChatCategoriaId = 'COBRANCA'

export type WhatsappCategoriaFiltro = WhatsappChatCategoriaId | 'sem_categoria' | 'nao_lidas' | null

/** Filtro rápido por conversas com mensagens não lidas (não é categoria salva no chat). */
export const WHATSAPP_FILTRO_NAO_LIDAS = {
  id: 'nao_lidas' as const,
  label: 'Não lidas',
  chipActive: 'border-rose-600 bg-rose-600 text-white',
  chipIdle: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
}

export interface WhatsappCategoriaDef {
  id: WhatsappChatCategoriaId
  label: string
  chipActive: string
  chipIdle: string
  badgeClass: string
}

export const WHATSAPP_CATEGORIAS: WhatsappCategoriaDef[] = [
  {
    id: 'COBRANCA',
    label: 'Cobrança',
    chipActive: 'border-emerald-600 bg-emerald-600 text-white',
    chipIdle: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'COLABORADOR_BP',
    label: 'Colaborador BP',
    chipActive: 'border-blue-600 bg-blue-600 text-white',
    chipIdle: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'SOCIO',
    label: 'Sócio',
    chipActive: 'border-violet-600 bg-violet-600 text-white',
    chipIdle: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
    badgeClass: 'bg-violet-100 text-violet-800',
  },
]

export function getWhatsappCategoria(id: string | null | undefined): WhatsappCategoriaDef | null {
  if (!id) return null
  return WHATSAPP_CATEGORIAS.find((c) => c.id === id) ?? null
}

export function categoriaLabel(id: string | null | undefined): string | null {
  return getWhatsappCategoria(id)?.label ?? null
}
