/** Ring buffer de logs do cliente para anexar em "Reportar Erro". */

export type ClientLogLevel = 'error' | 'warn' | 'info' | 'unhandled'

export type ClientLogEntry = {
  ts: string
  level: ClientLogLevel
  message: string
}

const MAX_ENTRIES = 50
const buffer: ClientLogEntry[] = []
let installed = false

function push(level: ClientLogLevel, message: string): void {
  const cleaned = message.replace(/\s+/g, ' ').trim().slice(0, 800)
  if (!cleaned) return
  buffer.push({ ts: new Date().toISOString(), level, message: cleaned })
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES)
}

function serializeArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
}

/** Instala hooks uma vez (safe em HMR). */
export function installClientLogBuffer(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const origError = console.error.bind(console)
  const origWarn = console.warn.bind(console)

  console.error = (...args: unknown[]) => {
    push('error', serializeArgs(args))
    origError(...args)
  }
  console.warn = (...args: unknown[]) => {
    push('warn', serializeArgs(args))
    origWarn(...args)
  }

  window.addEventListener('error', (ev) => {
    const msg = ev.error instanceof Error
      ? `${ev.error.name}: ${ev.error.message}`
      : ev.message || 'window.error'
    push('unhandled', msg)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason
    const msg =
      reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : typeof reason === 'string'
          ? reason
          : serializeArgs([reason])
    push('unhandled', `unhandledrejection: ${msg}`)
  })
}

export function getClientLogSnapshot(limit = 40): ClientLogEntry[] {
  return buffer.slice(-limit)
}

export function formatClientLogsForTicket(limit = 40): string {
  const rows = getClientLogSnapshot(limit)
  if (rows.length === 0) return '(nenhum log capturado nesta sessão)'
  return rows.map((r) => `[${r.ts}] ${r.level.toUpperCase()} ${r.message}`).join('\n')
}

export function recordClientError(error: unknown): void {
  if (error instanceof Error) {
    push('error', `${error.name}: ${error.message}`)
    return
  }
  push('error', String(error))
}
