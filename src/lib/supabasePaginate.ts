import type { PostgrestError } from '@supabase/supabase-js'

/** Limite padrão do PostgREST/Supabase por requisição. */
export const SUPABASE_PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: PostgrestError | null }

/**
 * Coleta todas as páginas de uma query com `.range()`.
 * A query DEVE incluir `.order()` com coluna única (ex.: `id`) para ordem estável;
 * sem isso o PostgREST pode pular ou duplicar linhas entre páginas.
 */
export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await fetchPage(from, to)
    if (error) throw error
    const chunk = data ?? []
    all.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }
  return all
}
