import { Check, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  status: string | null | undefined
  fromMe?: boolean
  className?: string
}

/** Indicador de status de entrega/leitura (mensagens enviadas). */
export function WhatsappMessageStatus({ status, fromMe, className }: Props) {
  if (!fromMe || !status) return null

  const s = status.toUpperCase()
  const isRead = s === 'READ' || s === 'PLAYED' || s === '4' || s === '5'
  const isDelivered = isRead || s === 'DELIVERY_ACK' || s === 'SERVER_ACK' || s === '3' || s === '2'

  return (
    <span className={cn('inline-flex items-center', className)} title={status}>
      {isRead ? (
        <CheckCheck className="h-3 w-3 text-sky-200" />
      ) : isDelivered ? (
        <CheckCheck className="h-3 w-3 text-emerald-100/80" />
      ) : (
        <Check className="h-3 w-3 text-emerald-100/60" />
      )}
    </span>
  )
}
