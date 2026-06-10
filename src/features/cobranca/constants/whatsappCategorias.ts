export type WhatsappChatCategoriaId = string

/** Categoria aplicada automaticamente a conversas iniciadas pelo painel de cobrança. */
export const WHATSAPP_CATEGORIA_COBRANCA_AUTO = 'COBRANCA'

export type WhatsappCategoriaFiltro = string | 'sem_categoria' | 'nao_lidas' | null

/** Filtro rápido por conversas com mensagens não lidas (não é categoria salva no chat). */
export const WHATSAPP_FILTRO_NAO_LIDAS = {
  id: 'nao_lidas' as const,
  label: 'Não lidas',
  chipActive: 'border-rose-600 bg-rose-600 text-white',
  chipIdle: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
}

export type WhatsappColorScheme =
  | 'emerald'
  | 'blue'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'cyan'
  | 'orange'
  | 'indigo'
  | 'pink'
  | 'slate'

export interface WhatsappColorSchemeDef {
  id: WhatsappColorScheme
  label: string
  chipActive: string
  chipIdle: string
  badgeClass: string
}

export const WHATSAPP_COLOR_SCHEMES: WhatsappColorSchemeDef[] = [
  {
    id: 'emerald',
    label: 'Verde',
    chipActive: 'border-emerald-600 bg-emerald-600 text-white',
    chipIdle: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'blue',
    label: 'Azul',
    chipActive: 'border-blue-600 bg-blue-600 text-white',
    chipIdle: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'violet',
    label: 'Roxo',
    chipActive: 'border-violet-600 bg-violet-600 text-white',
    chipIdle: 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100',
    badgeClass: 'bg-violet-100 text-violet-800',
  },
  {
    id: 'rose',
    label: 'Rosa',
    chipActive: 'border-rose-600 bg-rose-600 text-white',
    chipIdle: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
    badgeClass: 'bg-rose-100 text-rose-800',
  },
  {
    id: 'amber',
    label: 'Âmbar',
    chipActive: 'border-amber-600 bg-amber-600 text-white',
    chipIdle: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'cyan',
    label: 'Ciano',
    chipActive: 'border-cyan-600 bg-cyan-600 text-white',
    chipIdle: 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100',
    badgeClass: 'bg-cyan-100 text-cyan-800',
  },
  {
    id: 'orange',
    label: 'Laranja',
    chipActive: 'border-orange-600 bg-orange-600 text-white',
    chipIdle: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100',
    badgeClass: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'indigo',
    label: 'Índigo',
    chipActive: 'border-indigo-600 bg-indigo-600 text-white',
    chipIdle: 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
    badgeClass: 'bg-indigo-100 text-indigo-800',
  },
  {
    id: 'pink',
    label: 'Pink',
    chipActive: 'border-pink-600 bg-pink-600 text-white',
    chipIdle: 'border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100',
    badgeClass: 'bg-pink-100 text-pink-800',
  },
  {
    id: 'slate',
    label: 'Cinza',
    chipActive: 'border-slate-600 bg-slate-600 text-white',
    chipIdle: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
]

const COLOR_SCHEME_MAP = new Map(WHATSAPP_COLOR_SCHEMES.map((s) => [s.id, s]))

export function getWhatsappColorScheme(id: string | null | undefined): WhatsappColorSchemeDef {
  return COLOR_SCHEME_MAP.get(id as WhatsappColorScheme) ?? COLOR_SCHEME_MAP.get('slate')!
}

export interface WhatsappCategoriaDef {
  id: WhatsappChatCategoriaId
  label: string
  colorScheme: WhatsappColorScheme
  chipActive: string
  chipIdle: string
  badgeClass: string
  isSystem?: boolean
  sortOrder?: number
}

export interface WhatsappCategoriaRow {
  id: string
  label: string
  color_scheme: string
  sort_order: number
  is_system: boolean
  created_at: string
}

export function buildCategoriaDef(row: WhatsappCategoriaRow): WhatsappCategoriaDef {
  const colors = getWhatsappColorScheme(row.color_scheme)
  return {
    id: row.id,
    label: row.label,
    colorScheme: colors.id,
    chipActive: colors.chipActive,
    chipIdle: colors.chipIdle,
    badgeClass: colors.badgeClass,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
  }
}

/** Fallback enquanto o Supabase carrega ou em ambiente sem migração aplicada. */
export const DEFAULT_WHATSAPP_CATEGORIAS: WhatsappCategoriaDef[] = [
  buildCategoriaDef({
    id: 'COBRANCA',
    label: 'Cobrança',
    color_scheme: 'emerald',
    sort_order: 1,
    is_system: true,
    created_at: '',
  }),
  buildCategoriaDef({
    id: 'COLABORADOR_BP',
    label: 'Colaborador BP',
    color_scheme: 'blue',
    sort_order: 2,
    is_system: true,
    created_at: '',
  }),
  buildCategoriaDef({
    id: 'SOCIO',
    label: 'Sócio',
    color_scheme: 'violet',
    sort_order: 3,
    is_system: true,
    created_at: '',
  }),
]

export function getWhatsappCategoria(
  id: string | null | undefined,
  categorias: WhatsappCategoriaDef[] = DEFAULT_WHATSAPP_CATEGORIAS,
): WhatsappCategoriaDef | null {
  if (!id) return null
  return categorias.find((c) => c.id === id) ?? null
}

export function categoriaLabel(
  id: string | null | undefined,
  categorias: WhatsappCategoriaDef[] = DEFAULT_WHATSAPP_CATEGORIAS,
): string | null {
  return getWhatsappCategoria(id, categorias)?.label ?? null
}

export function slugFromCategoriaLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}
