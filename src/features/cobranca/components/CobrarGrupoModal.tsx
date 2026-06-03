import { useEffect, useMemo, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import { formatCurrency } from '@/shared/utils/format'
import { buildMensagemGrupoWhatsApp } from '../utils/template'
import { cobrancaService } from '../services/cobrancaService'
import { whatsappService } from '../services/whatsappService'
import { phoneToRemoteJid } from '../utils/phone'
import { formatPhoneMasked } from '../utils/phoneMask'
import type { CobrancaPainelRow } from '@/lib/database.types'

interface Props {
  open: boolean
  rows: CobrancaPainelRow[]
  onClose: () => void
  onSent: () => void
}

export function CobrarGrupoModal({ open, rows, onClose, onSent }: Props) {
  const { fullName, area } = useAuth()
  const [sending, setSending] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [telefone, setTelefone] = useState('')
  const [nomeContato, setNomeContato] = useState('')

  const telefones = useMemo(
    () => Array.from(new Set(rows.map((r) => r.pessoa_telefone?.trim()).filter(Boolean))) as string[],
    [rows],
  )
  const total = useMemo(() => rows.reduce((sum, r) => sum + Number(r.valor ?? 0), 0), [rows])
  const nome = rows[0]?.pessoa_nome || rows[0]?.cliente || 'Cliente'
  const isSingular = rows.length === 1

  useEffect(() => {
    if (!open) return
    const nomeDefault = rows[0]?.pessoa_nome || rows[0]?.cliente || 'Cliente'
    setNomeContato(nomeDefault)
    setTelefone(telefones[0] ?? '')
  }, [open, rows, telefones])

  useEffect(() => {
    if (!open) return
    setMensagem(buildMensagemGrupoWhatsApp(rows, fullName, area, nomeContato))
  }, [open, rows, fullName, area, nomeContato])

  const handleSend = async () => {
    if (rows.length === 0) return
    if (!telefone) {
      toast.error('Selecione um telefone para envio.')
      return
    }
    if (!mensagem.trim()) {
      toast.error('A mensagem não pode estar vazia.')
      return
    }

    setSending(true)
    try {
      const payload = {
        parcela_ids: rows.map((r) => r.parcela_id),
        pessoa_id: rows[0]?.pessoa_id ?? null,
        number: telefone,
        mensagem: mensagem.trim(),
      }
      const result = await cobrancaService.enviarWhatsappGrupo(payload, fullName)
      const falhas = result.total - result.enviados
      if (result.enviados > 0) {
        const jid = phoneToRemoteJid(telefone)
        if (jid) {
          await whatsappService.ensureChatCategoriaCobranca(jid).catch(() => {})
        }
        toast.success(
          `Cobrança consolidada enviada para ${nome} (${result.enviados} título(s) marcados)${
            falhas > 0 ? `, ${falhas} com erro` : ''
          }`,
        )
        onSent()
        onClose()
      } else {
        const primeiroErro = result.results.find((r) => !r.ok)?.erro
        toast.error(primeiroErro ?? 'Não foi possível enviar a cobrança consolidada.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar cobrança consolidada')
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title={isSingular ? 'Cobrar título por WhatsApp' : 'Cobrança consolidada do grupo'}
      description={
        isSingular
          ? 'Envia uma mensagem de cobrança para este título.'
          : 'Envia uma única mensagem para o cliente com todos os títulos do grupo.'
      }
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          <span>
            Cliente: <strong className="text-slate-900">{nome}</strong> ·{' '}
            <strong className="text-slate-900">{rows.length}</strong> título(s) ·{' '}
            <strong className="text-slate-900">{formatCurrency(total)}</strong>
          </span>
        </div>

        {telefones.length > 1 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Foram encontrados múltiplos telefones neste grupo. Selecione o destino correto.</span>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Nome do contato financeiro</Label>
          <Input
            value={nomeContato}
            onChange={(e) => setNomeContato(e.target.value)}
            placeholder="Ex.: Maria (Financeiro)"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Telefone de destino</Label>
          {telefones.length === 0 ? (
            <Input readOnly value="Sem telefone cadastrado" className="bg-slate-50 text-slate-500" />
          ) : telefones.length === 1 ? (
            <Input
              readOnly
              value={formatPhoneMasked(telefone) || telefone}
              className="bg-slate-50"
            />
          ) : (
            <select
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              {telefones.map((tel) => (
                <option key={tel} value={tel}>
                  {formatPhoneMasked(tel) || tel}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Títulos incluídos</Label>
          <div className="max-h-28 overflow-auto rounded-lg border border-slate-200 p-2">
            <div className="flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <Badge key={r.parcela_id} variant="secondary">
                  {r.nro_titulo || 'Sem número'} · {formatCurrency(Number(r.valor ?? 0))}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Mensagem</Label>
          <Textarea
            rows={12}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !telefone || rows.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? 'Enviando…' : isSingular ? 'Enviar cobrança' : 'Enviar cobrança consolidada'}
          </Button>
        </div>
      </div>
    </ModalBase>
  )
}
