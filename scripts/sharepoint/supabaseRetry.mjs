/**
 * Chamadas ao Supabase (PostgREST) com nova tentativa em erro transitório.
 *
 * Uma rodada do sync faz ~1.000 requisições (só tarefas_historico regrava ~157 mil linhas em ~314
 * lotes de 500). Um soquete derrubado no meio ("TypeError: fetch failed") ou um 502/503/504 do
 * gateway derrubava a fonte inteira, porque não havia retry. Aqui o lote tenta de novo com backoff.
 *
 * O supabase-js não lança em erro de rede: devolve { error: { message: 'TypeError: fetch failed',
 * details: '… Caused by: SocketError: other side closed (UND_ERR_SOCKET)' }, status: 0 }.
 * A causa real só aparece em `details`; descreverErro() a traz para a mensagem.
 */

export const RETRY_TENTATIVAS = 6
const RETRY_BASE_MS = 2000
/** Lotes seguidos que falham mesmo após as tentativas: o banco caiu, não adianta seguir. */
const MAX_LOTES_FALHOS_SEGUIDOS = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Rede (status 0), timeout, rate limit e gateway passam com nova tentativa; erro de dado não. */
export function erroTransitorio(error, status) {
  if (!status) return true
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  if (status >= 520 && status <= 527) return true // Cloudflare na frente do Supabase
  return error?.code === '57014' // statement timeout
}

export function descreverErro(error, status) {
  const base =
    error?.message ?? error?.error ?? error?.msg ?? (status ? `HTTP ${status}` : 'erro desconhecido')
  const causa = String(error?.details ?? '').match(/Caused by: ([^\n]+)/)?.[1]
  const prefixo = status && status >= 400 && !String(base).includes(String(status)) ? `HTTP ${status}: ` : ''
  return `${prefixo}${base}${causa ? ` (${causa.trim()})` : ''}`
}

/**
 * Uma tentativa. `fazer` monta a query do supabase-js e devolve a promessa dela.
 * Lança Error com `.transitorio` quando a resposta tem erro.
 */
export async function chamarSupabase(rotulo, fazer) {
  let res
  try {
    res = await fazer()
  } catch (e) {
    const causa = e?.cause ? `Caused by: ${e.cause.name ?? 'Error'}: ${e.cause.message ?? ''} ${e.cause.code ?? ''}` : ''
    res = { error: { message: `${e?.name ?? 'Error'}: ${e?.message ?? e}`, details: causa }, status: 0 }
  }
  if (!res?.error) return res
  const err = new Error(`${rotulo}: ${descreverErro(res.error, res.status)}`)
  err.transitorio = erroTransitorio(res.error, res.status)
  throw err
}

/**
 * Repete `operacao` enquanto ela lançar erro transitório, com backoff exponencial e jitter
 * (2s, 4s, 8s, 16s, 32s ≈ 1 min no total). A operação precisa ser idempotente.
 */
export async function comRetry(rotulo, operacao, { tentativas = RETRY_TENTATIVAS, baseMs = RETRY_BASE_MS } = {}) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await operacao()
    } catch (err) {
      if (!err?.transitorio || tentativa >= tentativas) {
        if (tentativa > 1) err.message += ` (após ${tentativa} tentativas)`
        throw err
      }
      const espera = baseMs * 2 ** (tentativa - 1) + Math.floor(Math.random() * Math.min(baseMs, 1000))
      console.warn(
        `[retry] ${err.message} — tentativa ${tentativa}/${tentativas}, nova em ${(espera / 1000).toFixed(1)}s`,
      )
      await sleep(espera)
    }
  }
}

/** Uma chamada ao Supabase com retry. Para leitura, upsert e delete por chave (idempotentes). */
export function sbComRetry(rotulo, fazer, opts) {
  return comRetry(rotulo, () => chamarSupabase(rotulo, fazer), opts)
}

/**
 * Upsert em lotes. Cada lote tenta de novo em erro transitório; se mesmo assim falhar, segue com os
 * demais (upsert é idempotente, a próxima rodada completa) e lança no fim com o resumo.
 * Erro de dado (coluna, constraint) para na hora: repetiria igual em todos os lotes.
 * O erro lançado carrega `.upserted` com o que entrou.
 */
export async function upsertEmLotes(client, table, rows, onConflict, { batch = 500, retry } = {}) {
  const totalLotes = Math.ceil(rows.length / batch)
  let upserted = 0
  let seguidos = 0
  const falhas = []
  for (let i = 0; i < rows.length; i += batch) {
    const lote = i / batch + 1
    const chunk = rows.slice(i, i + batch)
    try {
      await sbComRetry(
        `upsert ${table} (lote ${lote}/${totalLotes})`,
        () => client.from(table).upsert(chunk, { onConflict }),
        retry,
      )
      upserted += chunk.length
      seguidos = 0
    } catch (err) {
      err.upserted = upserted
      if (!err.transitorio) throw err
      console.error(`[Sync SharePoint] ${err.message}`)
      falhas.push(err.message)
      seguidos += 1
      if (seguidos >= MAX_LOTES_FALHOS_SEGUIDOS) {
        const parar = new Error(
          `${table}: ${seguidos} lotes seguidos falharam, carga interrompida no lote ${lote}/${totalLotes} — ${err.message}`,
        )
        parar.upserted = upserted
        throw parar
      }
    }
  }
  if (falhas.length) {
    const err = new Error(
      `${falhas.length} de ${totalLotes} ${totalLotes === 1 ? 'lote' : 'lotes'} sem gravar — ${falhas[0]}`,
    )
    err.upserted = upserted
    throw err
  }
  return upserted
}
