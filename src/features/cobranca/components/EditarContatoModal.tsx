import { useEffect, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cobrancaService } from '../services/cobrancaService'
import { formatPhoneMasked, maskPhoneOnChange, parsePhoneForStorage } from '../utils/phoneMask'
import { toast } from 'sonner'
import type { CobrancaPainelRow } from '@/lib/database.types'

interface Props {
  open: boolean
  row: CobrancaPainelRow | null
  onClose: () => void
  onSaved: () => void
}

export function EditarContatoModal({ open, row, onClose, onSaved }: Props) {
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (row) {
      setTelefone(formatPhoneMasked(row.pessoa_telefone))
      setEmail(row.pessoa_email ?? '')
    }
  }, [row])

  const handleSave = async () => {
    if (!row?.pessoa_id) {
      toast.error('Este título não está vinculado a uma pessoa cadastrada; não é possível salvar o contato.')
      return
    }
    setSaving(true)
    try {
      await cobrancaService.updateContato(row.pessoa_id, {
        telefone: parsePhoneForStorage(telefone),
        email: email.trim() || null,
      })
      toast.success('Contato atualizado')
      onSaved()
      onClose()
    } catch {
      toast.error('Erro ao salvar contato')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="Editar contato"
      description="Atualize telefone e e-mail do cliente para permitir a cobrança."
      className="max-w-md"
    >
      <div className="space-y-4 pt-2">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{row?.pessoa_nome || row?.cliente}</p>
          <p className="text-xs">Título {row?.nro_titulo ?? '-'}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contato-telefone">Telefone (WhatsApp)</Label>
          <Input
            id="contato-telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telefone}
            onChange={(e) => {
              const next = maskPhoneOnChange(e.target.value)
              setTelefone(next)
            }}
            onFocus={() => {
              if (!telefone.trim()) setTelefone('+55 ')
            }}
            placeholder="+55 (11) 99999-9999"
          />
          <p className="text-xs text-slate-400">
            País (DDI), DDD e número. Salvo com DDI 55 para envio no WhatsApp.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contato-email">E-mail</Label>
          <Input
            id="contato-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@empresa.com.br"
          />
        </div>
        {!row?.pessoa_id && (
          <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
            Título sem pessoa vinculada. Vincule a pessoa na base antes de salvar o contato.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !row?.pessoa_id}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </ModalBase>
  )
}
