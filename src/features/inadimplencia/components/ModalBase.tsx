import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ModalBaseProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function ModalBase({ open, onClose, title, children, className }: ModalBaseProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showClose={true} className={cn('max-h-[85vh] overflow-hidden flex flex-col p-0', className)}>
        <DialogHeader>
          <DialogTitle id="modal-title">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
