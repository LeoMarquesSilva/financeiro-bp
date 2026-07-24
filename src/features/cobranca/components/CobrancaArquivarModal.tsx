import { useEffect, useState } from 'react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import type { CobrancaPainelRow } from '@/lib/database.types'

interface Props {
  open: boolean
  row: CobrancaPainelRow | null
  onClose: () => void
  onConfirm: (row: CobrancaPainelRow, motivo: string) => Promise<void>
}

export function CobrancaArquivarModal({ open, row, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setMotivo('')
  }, [open, row?.parcela_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!row) return

    const texto = motivo.trim()
    if (!texto) {
      toast.error('Informe a justificativa para remover o título do painel')
      return
    }

    setSubmitting(true)
    try {
      await onConfirm(row, texto)
      onClose()
    } catch {
      toast.error('Erro ao remover título')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="Remover do painel"
      description={
        row
          ? `Arquivar título de ${row.cliente} — informe a justificativa`
          : 'Informe a justificativa para arquivar o título'
      }
    >
      {row && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm">
            <p className="font-medium text-slate-800">{row.cliente}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Título {row.nro_titulo ?? '-'} · {formatCurrency(Number(row.valor ?? 0))} · venc.{' '}
              {formatDate(row.data_vencimento)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo-arquivar">Justificativa</Label>
            <Textarea
              id="motivo-arquivar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: título quitado, acordo com cliente, cobrança indevida..."
              className="min-h-[100px]"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting}
            >
              {submitting ? 'Removendo…' : 'Remover do painel'}
            </Button>
          </div>
        </form>
      )}
    </ModalBase>
  )
}
