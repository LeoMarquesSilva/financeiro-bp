import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type RelatorioRpcResult = {
  data: unknown
  error: { message?: string; details?: string; hint?: string; code?: string } | null
}

export type RelatorioRpcCache = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RelatorioRpcResult>
}

function isStatementTimeout(error: RelatorioRpcResult['error']): boolean {
  if (!error) return false
  const code = error.code ?? ''
  const message = `${error.message ?? ''} ${error.details ?? ''}`
  return code === '57014' || /statement timeout/i.test(message)
}

async function rpcWithRetry(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  attempts = 2,
): Promise<RelatorioRpcResult> {
  let last: RelatorioRpcResult = { data: null, error: { message: 'RPC não executada' } }
  for (let i = 0; i < attempts; i++) {
    const result = await supabase.rpc(name, args)
    last = { data: result.data, error: result.error }
    if (!last.error || !isStatementTimeout(last.error)) return last
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  return last
}

/** Evita repetir a mesma RPC no mesmo job (ex.: indicadores + overview). */
export function createRelatorioRpcCache(supabase: SupabaseClient): RelatorioRpcCache {
  const pending = new Map<string, Promise<RelatorioRpcResult>>()
  return {
    rpc(name, args) {
      const key = `${name}:${JSON.stringify(args, Object.keys(args).sort())}`
      if (!pending.has(key)) {
        pending.set(key, rpcWithRetry(supabase, name, args))
      }
      return pending.get(key)!
    },
  }
}
