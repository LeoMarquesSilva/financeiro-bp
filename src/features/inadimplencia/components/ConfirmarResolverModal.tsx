import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmarResolverModalProps {
  open: boolean
  clientName?: string | null
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}

export function ConfirmarResolverModal({
  open,
  clientName,
  onClose,
  onConfirm,
  loading = false,
}: ConfirmarResolverModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showClose={true}>
        <DialogHeader>
          <DialogTitle>Marcar como resolvido?</DialogTitle>
          <DialogDescription>
            {clientName
              ? `O cliente "${clientName}" será marcado como resolvido e sairá da lista de inadimplentes.`
              : 'Este cliente será marcado como resolvido e sairá da lista de inadimplentes.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? 'Salvando…' : 'Sim, marcar resolvido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
