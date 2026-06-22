import { useEffect, useMemo, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Mail } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import { formatCurrency } from '@/shared/utils/format'
import { buildAssuntoEmailCobranca, buildCorpoEmailCobranca } from '../utils/emailCobranca'
import { cobrancaService } from '../services/cobrancaService'
import { EmailHtmlEditor } from './EmailHtmlEditor'
import type { CobrancaPainelRow } from '@/lib/database.types'

interface Props {
  open: boolean
  rows: CobrancaPainelRow[]
  onClose: () => void
  /** Chamado após envio bem-sucedido (não altera indicadores D+1). */
  onSent?: () => void
}

export function CobrarEmailModal({ open, rows, onClose, onSent }: Props) {
  const { fullName } = useAuth()
  const [sending, setSending] = useState(false)
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [emailDestino, setEmailDestino] = useState('')

  const total = useMemo(() => rows.reduce((sum, r) => sum + Number(r.valor ?? 0), 0), [rows])
  const nome = rows[0]?.pessoa_nome || rows[0]?.cliente || 'Cliente'
  const isSingular = rows.length === 1

  useEffect(() => {
    if (!open || rows.length === 0) return
    setEmailDestino(rows[0]?.pessoa_email?.trim() ?? '')
    setAssunto(buildAssuntoEmailCobranca(rows))
    setCorpo(buildCorpoEmailCobranca(rows, fullName))
  }, [open, rows, fullName])

  const handleSend = async () => {
    if (rows.length === 0) return
    const destino = emailDestino.trim()
    if (!destino) {
      toast.error('Informe o e-mail de destino.')
      return
    }
    if (!assunto.trim()) {
      toast.error('O assunto não pode estar vazio.')
      return
    }
    if (!corpo.trim()) {
      toast.error('O corpo do e-mail não pode estar vazio.')
      return
    }

    setSending(true)
    try {
      const result = await cobrancaService.enviarEmail(
        [
          {
            parcela_id: rows[0].parcela_id,
            pessoa_id: rows[0].pessoa_id,
            email: destino,
            assunto: assunto.trim(),
            corpo: corpo.trim(),
          },
        ],
        fullName,
        { registrar_evento: false },
      )

      if (result.enviados > 0) {
        toast.success('E-mail de cobrança enviado com sucesso.')
        onSent?.()
        onClose()
      } else {
        const erro = result.results.find((r) => !r.ok)?.erro
        toast.error(erro ?? 'Não foi possível enviar o e-mail.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao enviar e-mail'
      if (msg.toLowerCase().includes('graph') || msg.toLowerCase().includes('secrets')) {
        toast.error(
          'Microsoft Graph não configurado. Solicite ao administrador as credenciais (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER).',
          { duration: 8000 },
        )
      } else {
        toast.error(msg)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={isSingular ? 'Cobrar por e-mail' : 'Cobrança consolidada por e-mail'}
      description="Redija e envie a cobrança por e-mail. Este envio não altera os indicadores D+1."
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Mail className="h-4 w-4 text-blue-600" />
          <span>
            Cliente: <strong className="text-slate-900">{nome}</strong> ·{' '}
            <strong className="text-slate-900">{rows.length}</strong> título(s) ·{' '}
            <strong className="text-slate-900">{formatCurrency(total)}</strong>
          </span>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Remetente: <strong>financeiro@bismarchipires.com.br</strong> via Microsoft Graph.
            Este envio é complementar e <strong>não contabiliza</strong> nos indicadores de
            efetividade D+1.
          </span>
        </div>

        {!rows[0]?.pessoa_email && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Cliente sem e-mail cadastrado. Informe o destinatário abaixo.</span>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Destinatário</Label>
          <Input
            type="email"
            value={emailDestino}
            onChange={(e) => setEmailDestino(e.target.value)}
            placeholder="financeiro@empresa.com.br"
            disabled={sending}
          />
        </div>

        {!isSingular && (
          <div className="space-y-1">
            <Label className="text-xs">Títulos incluídos</Label>
            <div className="max-h-24 overflow-auto rounded-lg border border-slate-200 p-2">
              <div className="flex flex-wrap gap-1.5">
                {rows.map((r) => (
                  <Badge key={r.parcela_id} variant="secondary">
                    {r.nro_titulo || 'Sem número'} · {formatCurrency(Number(r.valor ?? 0))}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Assunto</Label>
          <Input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            disabled={sending}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Corpo do e-mail</Label>
          <EmailHtmlEditor
            value={corpo}
            onChange={setCorpo}
            disabled={sending}
          />
          <p className="text-[11px] text-slate-400">
            Visualização formatada do e-mail. Você pode editar o texto diretamente aqui.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending || rows.length === 0}>
            {sending ? 'Enviando…' : 'Enviar e-mail'}
          </Button>
        </div>
      </div>
    </ModalBase>
  )
}
