import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/shared/utils/format'
import { AlertTriangle, MessageCircle, ListChecks } from 'lucide-react'
import type { PainelResumo } from '../services/cobrancaService'

interface Props {
  resumo: PainelResumo
  loading?: boolean
}

export function CobrancaKPIs({ resumo, loading }: Props) {
  const { totalValor, qtd, comWhatsapp } = resumo
  const faltaWhatsapp = Math.max(0, qtd - comWhatsapp)

  const cards = [
    {
      label: 'Valor pendente',
      value: formatCurrency(totalValor),
      icon: AlertTriangle,
      color: 'text-red-600',
    },
    {
      label: 'Títulos no painel',
      value: String(qtd),
      icon: ListChecks,
      color: 'text-slate-700',
    },
    {
      label: 'Cobrados (WhatsApp)',
      value: `${comWhatsapp}/${qtd}`,
      icon: MessageCircle,
      color: 'text-emerald-600',
    },
    {
      label: 'Aguardando WhatsApp',
      value: String(faltaWhatsapp),
      icon: AlertTriangle,
      color: 'text-amber-600',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {c.label}
              </span>
              <Icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {loading ? '…' : c.value}
            </p>
          </Card>
        )
      })}
    </div>
  )
}
