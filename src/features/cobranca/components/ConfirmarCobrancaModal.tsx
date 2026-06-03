import { useEffect, useMemo, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, Mail, AlertTriangle } from 'lucide-react'
import { applyTemplate, buildTemplateVars } from '../utils/template'
import type { CobrancaTemplates } from '../services/cobrancaTemplatesService'
import { cobrancaService } from '../services/cobrancaService'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import type { CobrancaPainelRow } from '@/lib/database.types'
import type { PendingWhatsappCobranca } from '../types/cobranca.types'
import { formatPhoneMasked } from '../utils/phoneMask'

interface Props {
  open: boolean
  canal: 'whatsapp' | 'email' | null
  rows: CobrancaPainelRow[]
  templates: CobrancaTemplates
  onClose: () => void
  onSent: () => void
  /** Após envio WhatsApp, abre a conversa do primeiro cliente cobrado. */
  onSentWhatsapp?: (pending: PendingWhatsappCobranca) => void
}

export function ConfirmarCobrancaModal({
  open,
  canal,
  rows,
  templates,
  onClose,
  onSent,
  onSentWhatsapp,
}: Props) {
  const { fullName } = useAuth()
  const [sending, setSending] = useState(false)
  const [mensagens, setMensagens] = useState<Record<string, string>>({})
  const [assuntos, setAssuntos] = useState<Record<string, string>>({})

  const { enviaveis, semContato } = useMemo(() => {
    if (!canal) return { enviaveis: [] as CobrancaPainelRow[], semContato: [] as CobrancaPainelRow[] }
    const enviaveis: CobrancaPainelRow[] = []
    const semContato: CobrancaPainelRow[] = []
    for (const r of rows) {
      const contato = canal === 'whatsapp' ? r.pessoa_telefone : r.pessoa_email
      if (contato && contato.trim()) enviaveis.push(r)
      else semContato.push(r)
    }
    return { enviaveis, semContato }
  }, [rows, canal])

  useEffect(() => {
    if (!open || !canal) return
    const msgMap: Record<string, string> = {}
    const assMap: Record<string, string> = {}
    for (const r of enviaveis) {
      const vars = buildTemplateVars(r, fullName)
      if (canal === 'whatsapp') {
        msgMap[r.parcela_id] = applyTemplate(templates.whatsapp, vars)
      } else {
        msgMap[r.parcela_id] = applyTemplate(templates.emailCorpo, vars)
        assMap[r.parcela_id] = applyTemplate(templates.emailAssunto, vars)
      }
    }
    setMensagens(msgMap)
    setAssuntos(assMap)
  }, [open, canal, enviaveis, templates])

  const handleSend = async () => {
    if (!canal || enviaveis.length === 0) return
    setSending(true)
    try {
      let result
      let firstWhatsapp: PendingWhatsappCobranca | null = null

      if (canal === 'whatsapp') {
        const itens = enviaveis.map((r) => {
          const mensagem = mensagens[r.parcela_id] ?? applyTemplate(templates.whatsapp, buildTemplateVars(r, fullName))
          if (!firstWhatsapp) {
            firstWhatsapp = {
              parcela_id: r.parcela_id,
              pessoa_id: r.pessoa_id,
              telefone: r.pessoa_telefone!,
              nome: r.pessoa_nome || r.cliente,
              mensagem,
            }
          }
          return {
            parcela_id: r.parcela_id,
            pessoa_id: r.pessoa_id,
            number: r.pessoa_telefone!,
            mensagem,
          }
        })
        result = await cobrancaService.enviarWhatsapp(itens, fullName)
      } else {
        const itens = enviaveis.map((r) => {
          const vars = buildTemplateVars(r, fullName)
          return {
            parcela_id: r.parcela_id,
            pessoa_id: r.pessoa_id,
            email: r.pessoa_email!,
            assunto: assuntos[r.parcela_id] ?? applyTemplate(templates.emailAssunto, vars),
            corpo: mensagens[r.parcela_id] ?? applyTemplate(templates.emailCorpo, vars),
          }
        })
        result = await cobrancaService.enviarEmail(itens, fullName)
      }

      const falhas = result.total - result.enviados
      if (result.enviados > 0) {
        toast.success(`${result.enviados} cobrança(s) enviada(s)${falhas > 0 ? `, ${falhas} com erro` : ''}`)
        onSent()
        onClose()
        if (canal === 'whatsapp' && firstWhatsapp && onSentWhatsapp) {
          onSentWhatsapp(firstWhatsapp)
        }
      } else {
        const primeiroErro = result.results.find((r) => !r.ok)?.erro
        toast.error(primeiroErro ?? 'Nenhuma cobrança enviada. Verifique a configuração e os contatos.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar cobranças')
    } finally {
      setSending(false)
    }
  }

  const canalLabel = canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'
  const Icon = canal === 'whatsapp' ? MessageCircle : Mail

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={`Cobrar por ${canalLabel}`}
      description={`Edite as mensagens antes de disparar a cobrança por ${canalLabel}.`}
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Icon className="h-4 w-4" />
          <span>
            <strong className="text-slate-900">{enviaveis.length}</strong> título(s) serão cobrados por {canalLabel}.
          </span>
        </div>

        {semContato.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {semContato.length} título(s) sem {canal === 'whatsapp' ? 'telefone' : 'e-mail'} serão ignorados.
              Edite o contato na linha para incluí-los.
            </span>
          </div>
        )}

        {enviaveis.length > 0 && (
          <ScrollArea className="max-h-[50vh] space-y-4 pr-2">
            {enviaveis.map((r) => (
              <div key={r.parcela_id} className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {r.pessoa_nome || r.cliente}
                  </span>
                  <Badge variant="secondary">
                    {canal === 'whatsapp'
                      ? formatPhoneMasked(r.pessoa_telefone) || r.pessoa_telefone
                      : r.pessoa_email}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  Título {r.nro_titulo ?? '-'} · {r.plano_contas ?? '-'}
                </p>
                {canal === 'email' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Assunto</Label>
                    <Input
                      value={assuntos[r.parcela_id] ?? ''}
                      onChange={(e) =>
                        setAssuntos((prev) => ({ ...prev, [r.parcela_id]: e.target.value }))
                      }
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea
                    rows={canal === 'whatsapp' ? 5 : 8}
                    value={mensagens[r.parcela_id] ?? ''}
                    onChange={(e) =>
                      setMensagens((prev) => ({ ...prev, [r.parcela_id]: e.target.value }))
                    }
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || enviaveis.length === 0}
            className={canal === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {sending ? 'Enviando…' : `Disparar ${enviaveis.length} cobrança(s)`}
          </Button>
        </div>
      </div>
    </ModalBase>
  )
}
