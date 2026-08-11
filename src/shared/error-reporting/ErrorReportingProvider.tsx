import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { Bug, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { installClientLogBuffer, formatClientLogsForTicket } from './clientLogBuffer'
import { captureViewportScreenshot } from './captureScreenshot'
import {
  appendCursorPromptToDescription,
  buildDefaultDescription,
  buildDefaultTitle,
  resolveModuloFromPath,
  type ReportarErroContext,
} from './buildReportContent'
import { reportarErroSioe } from './reportarErroService'

type OpenOpts = ReportarErroContext

type ErrorReportingValue = {
  openReport: (opts?: OpenOpts) => void
}

const ErrorReportingContext = createContext<ErrorReportingValue | null>(null)

export function useErrorReporting(): ErrorReportingValue {
  const ctx = useContext(ErrorReportingContext)
  if (!ctx) {
    throw new Error('useErrorReporting deve ser usado dentro de ErrorReportingProvider')
  }
  return ctx
}

/** Hook opcional (sidebar / heat rows) — no-op se provider ausente. */
export function useErrorReportingOptional(): ErrorReportingValue {
  const ctx = useContext(ErrorReportingContext)
  return (
    ctx ?? {
      openReport: () => {
        toast.error('Reportar Erro indisponível nesta tela')
      },
    }
  )
}

type Draft = {
  title: string
  description: string
  ctx: ReportarErroContext
  route: string
  screenshot: string | null
  capturing: boolean
}

export function ErrorReportingProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    installClientLogBuffer()
  }, [])

  const openReport = useCallback(
    (opts: OpenOpts = {}) => {
      const route = `${location.pathname}${location.search}`
      const ctx: ReportarErroContext = {
        ...opts,
        modulo: opts.modulo ?? resolveModuloFromPath(location.pathname),
      }
      setDraft({
        title: buildDefaultTitle(ctx, route),
        description: buildDefaultDescription(ctx, route),
        ctx,
        route,
        screenshot: null,
        capturing: true,
      })
      setOpen(true)

      void (async () => {
        const shot = await captureViewportScreenshot()
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                screenshot: shot,
                capturing: false,
              }
            : prev,
        )
      })()
    },
    [location.pathname, location.search],
  )

  const value = useMemo(() => ({ openReport }), [openReport])

  const handleSubmit = async () => {
    if (!draft) return
    const title = draft.title.trim()
    const userDescription = draft.description.trim()
    if (!title || !userDescription) {
      toast.error('Informe título e descrição')
      return
    }
    const description = appendCursorPromptToDescription(
      userDescription,
      draft.ctx,
      draft.route,
    )
    setSubmitting(true)
    try {
      const result = await reportarErroSioe({
        title,
        description,
        route: draft.route,
        indicador: draft.ctx.indicador,
        modulo: draft.ctx.modulo,
        ano: draft.ctx.ano,
        mes: draft.ctx.mes,
        area: draft.ctx.area,
        screenshot_base64: draft.screenshot,
        client_logs: formatClientLogsForTicket(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        error_message: draft.ctx.error?.message ?? null,
        error_stack: draft.ctx.error?.stack ?? null,
      })
      toast.success(
        result.assigned_to_name
          ? `Ticket criado na RESPONSUM (${result.ticket_id.slice(0, 8)}…) · ${result.assigned_to_name}`
          : `Ticket criado na RESPONSUM (${result.ticket_id.slice(0, 8)}…)`,
      )
      setOpen(false)
      setDraft(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao criar ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ErrorReportingContext.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (submitting) return
          setOpen(next)
          if (!next) setDraft(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-rose-600" aria-hidden />
              Reportar Erro
            </DialogTitle>
            <DialogDescription>
              Abre chamado na RESPONSUM · Manutenção em Sistemas / SIOE (LexNextLab), com
              screenshot da tela.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reportar-erro-titulo">Título</Label>
                <Input
                  id="reportar-erro-titulo"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportar-erro-desc">O que está inconsistente?</Label>
                <Textarea
                  id="reportar-erro-desc"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  disabled={submitting}
                  className="min-h-[160px] text-sm"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {draft.capturing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Capturando screenshot…
                  </span>
                ) : draft.screenshot ? (
                  <div className="space-y-2">
                    <p className="font-medium text-slate-700">Screenshot capturado</p>
                    <img
                      src={draft.screenshot}
                      alt="Prévia do screenshot"
                      className="max-h-40 w-full rounded border border-slate-200 object-contain bg-white"
                    />
                  </div>
                ) : (
                  <p>Não foi possível capturar o screenshot — o ticket seguirá com logs e contexto.</p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setOpen(false)
                setDraft(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={submitting || !draft || draft.capturing}
              onClick={() => void handleSubmit()}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Bug className="h-4 w-4" aria-hidden />
              )}
              Criar ticket RESPONSUM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorReportingContext.Provider>
  )
}

type BoundaryProps = {
  children: ReactNode
  onReport?: (error: Error) => void
}

type BoundaryState = { error: Error | null }

export class FinanceiroErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error): void {
    installClientLogBuffer()
    console.error('[FinanceiroErrorBoundary]', error)
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div className="mx-auto flex max-w-lg flex-col items-start gap-4 rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-rose-700">
            <Bug className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-semibold">Algo quebrou nesta tela</h2>
          </div>
          <p className="text-sm text-slate-600">
            {err.message || 'Erro inesperado no módulo financeiro.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => this.props.onReport?.(err)}
            >
              <Bug className="h-4 w-4" aria-hidden />
              Reportar Erro
            </Button>
            <Button type="button" variant="outline" onClick={() => this.setState({ error: null })}>
              Tentar novamente
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/** Liga o boundary ao provider (precisa estar dentro do provider). */
export function FinanceiroErrorBoundaryConnected({ children }: { children: ReactNode }) {
  const { openReport } = useErrorReporting()
  return (
    <FinanceiroErrorBoundary
      onReport={(error) =>
        openReport({
          error,
          resumo: error.message.slice(0, 80),
        })
      }
    >
      {children}
    </FinanceiroErrorBoundary>
  )
}
