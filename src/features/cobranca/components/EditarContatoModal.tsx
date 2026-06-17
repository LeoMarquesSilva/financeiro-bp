import { useEffect, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { cobrancaService } from '../services/cobrancaService'
import { formatPhoneMasked, maskPhoneOnChange } from '../utils/phoneMask'
import { toast } from 'sonner'
import type { CobrancaPainelRow } from '@/lib/database.types'
import type { PessoaTelefoneWhatsappInput } from '../types/cobranca.types'

interface Props {
  open: boolean
  row: CobrancaPainelRow | null
  onClose: () => void
  onSaved: () => void
}

type TelefoneRow = PessoaTelefoneWhatsappInput & { key: string }

function newRow(nome = ''): TelefoneRow {
  return { key: crypto.randomUUID(), nome, telefone: '' }
}

export function EditarContatoModal({ open, row, onClose, onSaved }: Props) {
  const [telefones, setTelefones] = useState<TelefoneRow[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !row?.pessoa_id) return
    let cancelled = false
    setLoading(true)
    void cobrancaService.listTelefonesWhatsapp(row.pessoa_id).then((list) => {
      if (cancelled) return
      if (list.length > 0) {
        setTelefones(
          list.map((t) => ({
            key: t.id,
            id: t.id,
            nome: t.nome,
            telefone: formatPhoneMasked(t.telefone),
          })),
        )
      } else if (row.pessoa_telefone?.trim()) {
        setTelefones([
          {
            key: 'legacy',
            nome: row.pessoa_nome?.trim() || 'Principal',
            telefone: formatPhoneMasked(row.pessoa_telefone),
          },
        ])
      } else {
        setTelefones([newRow('WhatsApp')])
      }
      setEmail(row.pessoa_email ?? '')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, row])

  const updateTelefone = (key: string, patch: Partial<TelefoneRow>) => {
    setTelefones((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)))
  }

  const removeTelefone = (key: string) => {
    setTelefones((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.key !== key)))
  }

  const handleSave = async () => {
    if (!row?.pessoa_id) {
      toast.error('Este título não está vinculado a uma pessoa cadastrada; não é possível salvar o contato.')
      return
    }
    const validos = telefones.filter((t) => t.telefone.trim())
    if (validos.length === 0) {
      toast.error('Informe ao menos um telefone WhatsApp.')
      return
    }
    setSaving(true)
    try {
      await cobrancaService.updateContato(row.pessoa_id, {
        telefones: validos.map(({ id, nome, telefone }) => ({ id, nome, telefone })),
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
      description="Cadastre um ou mais telefones WhatsApp com nome específico para cobrança."
      className="max-w-lg"
    >
      <div className="space-y-4 pt-2">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{row?.pessoa_nome || row?.cliente}</p>
          <p className="text-xs">Título {row?.nro_titulo ?? '-'}</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Telefones WhatsApp</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={loading || saving}
              onClick={() => setTelefones((prev) => [...prev, newRow('')])}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Carregando telefones…</p>
          ) : (
            <div className="space-y-3">
              {telefones.map((t) => (
                <div
                  key={t.key}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={t.nome}
                      onChange={(e) => updateTelefone(t.key, { nome: e.target.value })}
                      placeholder="Ex.: Juliana (Financeiro)"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={t.telefone}
                      onChange={(e) =>
                        updateTelefone(t.key, { telefone: maskPhoneOnChange(e.target.value) })
                      }
                      placeholder="+55 (11) 99999-9999 ou +351 912 345 678"
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={telefones.length <= 1 || saving}
                      onClick={() => removeTelefone(t.key)}
                      aria-label="Remover telefone"
                    >
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400">
            O primeiro telefone da lista será usado como principal no painel.
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
          <Button onClick={handleSave} disabled={saving || loading || !row?.pessoa_id}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </ModalBase>
  )
}
