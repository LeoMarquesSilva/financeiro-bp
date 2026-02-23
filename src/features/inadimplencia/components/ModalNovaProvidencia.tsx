import { useState } from 'react'
import { ModalBase } from './ModalBase'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { providenciaService } from '../services/providenciaService'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

const inputClass =
  'flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

interface ModalNovaProvidenciaProps {
  open: boolean
  onClose: () => void
  clientId: string
  onSuccess?: () => void
}

export function ModalNovaProvidencia({ open, onClose, clientId, onSuccess }: ModalNovaProvidenciaProps) {
  const queryClient = useQueryClient()
  const [texto, setTexto] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) {
      toast.error('Informe o texto da providência')
      return
    }
    setSubmitting(true)
    const { data, error } = await providenciaService.create(clientId, t)
    setSubmitting(false)
    if (error) {
      toast.error('Erro ao criar providência')
      return
    }
    toast.success('Providência criada')
    setTexto('')
    queryClient.invalidateQueries({ queryKey: ['providencias', clientId] })
    onClose()
    onSuccess?.()
  }

  return (
    <ModalBase open={open} onClose={onClose} title="Nova providência">
      <p className="mb-3 text-sm text-slate-500">
        Registre a providência definida no comitê (coordenadora do financeiro).
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Texto da providência</Label>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={inputClass}
            placeholder="Ex.: Enviar notificação formal e agendar reunião em 5 dias"
            rows={4}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Criar providência'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
