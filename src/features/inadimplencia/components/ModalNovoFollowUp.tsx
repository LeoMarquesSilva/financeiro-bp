import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ModalBase } from './ModalBase'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { providenciaService, PROVIDENCIA_FOLLOW_UP_TIPO_LABEL } from '../services/providenciaService'
import type { ProvidenciaFollowUpTipo } from '@/lib/database.types'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDate } from '@/shared/utils/format'

const inputClass =
  'flex min-h-[60px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'
const selectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

const TIPOS: ProvidenciaFollowUpTipo[] = ['devolutiva', 'cobranca', 'acordo']

interface ModalNovoFollowUpProps {
  open: boolean
  onClose: () => void
  clientId: string
  onSuccess?: () => void
}

export function ModalNovoFollowUp({ open, onClose, clientId, onSuccess }: ModalNovoFollowUpProps) {
  const queryClient = useQueryClient()
  const [providenciaId, setProvidenciaId] = useState('')
  const [tipo, setTipo] = useState<ProvidenciaFollowUpTipo>('devolutiva')
  const [texto, setTexto] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: providencias = [] } = useQuery({
    queryKey: ['providencias', clientId],
    queryFn: async () => {
      const { data, error } = await providenciaService.listByCliente(clientId)
      if (error) throw error
      return data
    },
    enabled: open && !!clientId,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!providenciaId) {
      toast.error('Selecione uma providência')
      return
    }
    setSubmitting(true)
    const { error } = await providenciaService.addFollowUp(providenciaId, tipo, texto.trim() || null)
    setSubmitting(false)
    if (error) {
      toast.error('Erro ao registrar follow-up')
      return
    }
    toast.success('Follow-up registrado')
    setTexto('')
    queryClient.invalidateQueries({ queryKey: ['providencias', clientId] })
    queryClient.invalidateQueries({ queryKey: ['providencia-follow-ups', providenciaId] })
    onClose()
    onSuccess?.()
  }

  const semProvidencias = providencias.length === 0

  return (
    <ModalBase open={open} onClose={onClose} title="Novo follow-up">
      <p className="mb-3 text-sm text-slate-500">
        Registre um follow-up vinculado a uma providência (gestor). Escolha o tipo: devolutiva, cobrança ou acordo.
      </p>
      {semProvidencias ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Não há providências para este cliente. Crie uma providência antes de adicionar follow-ups.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Providência</Label>
            <select
              value={providenciaId}
              onChange={(e) => setProvidenciaId(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">Selecione…</option>
              {providencias.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.texto.slice(0, 60)}
                  {p.texto.length > 60 ? '…' : ''} — {formatDate(p.created_at)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ProvidenciaFollowUpTipo)}
              className={selectClass}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {PROVIDENCIA_FOLLOW_UP_TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={inputClass}
              placeholder="Ex.: Cliente retornou ligação, prometeu pagar até sexta"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Registrar follow-up'}
            </Button>
          </div>
        </form>
      )}
    </ModalBase>
  )
}
