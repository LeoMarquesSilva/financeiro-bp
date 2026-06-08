import { useEffect, useMemo, useRef, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { toast } from 'sonner'
import { formatCurrency } from '@/shared/utils/format'
import { buildMensagemGrupoWhatsApp } from '../utils/template'
import { cobrancaService } from '../services/cobrancaService'
import { whatsappService } from '../services/whatsappService'
import { phoneToRemoteJid } from '../utils/phone'
import { TelefoneWhatsappPicker, type TelefoneWhatsappPickerHandle } from './TelefoneWhatsappPicker'
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
  const pickerRef = useRef<TelefoneWhatsappPickerHandle>(null)

  const total = useMemo(() => rows.reduce((sum, r) => sum + Number(r.valor ?? 0), 0), [rows])
  const nome = rows[0]?.pessoa_nome || rows[0]?.cliente || 'Cliente'
  const pessoaId = rows[0]?.pessoa_id ?? null
  const fallbackTelefone = rows[0]?.pessoa_telefone ?? null
  const isSingular = rows.length === 1

  useEffect(() => {
    if (!open) return
    setNomeContato(rows[0]?.pessoa_nome || rows[0]?.cliente || 'Cliente')
    setTelefone(fallbackTelefone?.trim() ?? '')
  }, [open, rows, fallbackTelefone])

  useEffect(() => {
    if (!open) return
    setMensagem(buildMensagemGrupoWhatsApp(rows, fullName, area, nomeContato))
  }, [open, rows, fullName, area, nomeContato])

  const handleSend = async () => {
    if (rows.length === 0) return

    const resolved = (await pickerRef.current?.resolve()) ?? (telefone ? { telefone, nome: nomeContato } : null)
    if (!resolved?.telefone) {
      toast.error('Selecione ou informe um telefone para envio.')
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
        pessoa_id: pessoaId,
        number: resolved.telefone,
        mensagem: mensagem.trim(),
      }
      const result = await cobrancaService.enviarWhatsappGrupo(payload, fullName)
      const falhas = result.total - result.enviados
      if (result.enviados > 0) {
        const jid = phoneToRemoteJid(resolved.telefone)
        if (jid) {
          await whatsappService.ensureChatCategoriaCobranca(jid).catch(() => {})
        }
        toast.success(
          `Cobrança consolidada enviada para ${resolved.nome || nome} (${result.enviados} título(s) marcados)${
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
          ? 'Escolha o contato WhatsApp e envie a mensagem de cobrança.'
          : 'Escolha o contato WhatsApp e envie uma única mensagem com todos os títulos do grupo.'
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

        <div className="space-y-1">
          <Label className="text-xs">Nome do contato financeiro (na mensagem)</Label>
          <Input
            value={nomeContato}
            onChange={(e) => setNomeContato(e.target.value)}
            placeholder="Ex.: Maria (Financeiro)"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Telefone de destino</Label>
          <TelefoneWhatsappPicker
            ref={pickerRef}
            pessoaId={pessoaId}
            pessoaNome={nome}
            fallbackTelefone={fallbackTelefone}
            value={telefone}
            onChange={(tel, meta) => {
              setTelefone(tel)
              if (meta?.nome) setNomeContato(meta.nome)
            }}
            disabled={sending}
          />
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
            disabled={sending || rows.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? 'Enviando…' : isSingular ? 'Enviar cobrança' : 'Enviar cobrança consolidada'}
          </Button>
        </div>
      </div>
    </ModalBase>
  )
}
