import { supabase } from '@/lib/supabaseClient'
import {
  slugFromCategoriaLabel,
  type WhatsappCategoriaRow,
  type WhatsappColorScheme,
} from '../constants/whatsappCategorias'

export interface CreateWhatsappCategoriaInput {
  label: string
  colorScheme: WhatsappColorScheme
}

async function nextUniqueId(label: string, existingIds: Set<string>): Promise<string> {
  const base = slugFromCategoriaLabel(label)
  if (!base) throw new Error('Informe um nome válido para a categoria.')
  if (!existingIds.has(base)) return base
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}_${i}`.slice(0, 40)
    if (!existingIds.has(candidate)) return candidate
  }
  throw new Error('Não foi possível gerar um identificador único para a categoria.')
}

export const whatsappCategoriasService = {
  async list(): Promise<WhatsappCategoriaRow[]> {
    const { data, error } = await supabase
      .from('whatsapp_categorias')
      .select('id, label, color_scheme, sort_order, is_system, created_at')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })

    if (error) throw error
    return (data ?? []) as WhatsappCategoriaRow[]
  },

  async create(input: CreateWhatsappCategoriaInput): Promise<WhatsappCategoriaRow> {
    const label = input.label.trim()
    if (label.length < 2) throw new Error('O nome deve ter pelo menos 2 caracteres.')

    const existing = await this.list()
    const existingIds = new Set(existing.map((c) => c.id))
    const id = await nextUniqueId(label, existingIds)
    const sortOrder =
      existing.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1

    const { data, error } = await supabase
      .from('whatsapp_categorias')
      .insert({
        id,
        label,
        color_scheme: input.colorScheme,
        sort_order: sortOrder,
        is_system: false,
      } as never)
      .select('id, label, color_scheme, sort_order, is_system, created_at')
      .single()

    if (error) throw error
    return data as WhatsappCategoriaRow
  },
}
