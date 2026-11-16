import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/shared/utils/format'
import { AlertTriangle, MessageCircle, ListChecks } from 'lucide-react'
import type { FenixExplicar } from '@/shared/fenix/fenix.types'
import { useFenixAlvo } from '@/shared/fenix/useFenix'
import type { PainelResumo } from '../services/cobrancaService'
import {
  explicarPainelAguardando,
  explicarPainelCobrados,
  explicarPainelTitulos,
  explicarPainelValorPendente,
  type CobrancaPainelFenixFiltros,
} from '../fenix/cobrancaFenix'

interface Props {
  resumo: PainelResumo
  loading?: boolean
  /** Filtros do painel, para o Fênix explicar os cards. */
  fenixFiltros?: CobrancaPainelFenixFiltros
}

type CardItem = {
  label: string
  value: string
  icon: typeof AlertTriangle
  color: string
  fenix?: { chave: string; explicar: FenixExplicar }
}

function KpiCard({ card, loading }: { card: CardItem; loading?: boolean }) {
  const fenixId = useFenixAlvo(card.fenix?.chave, card.fenix?.explicar)
  const Icon = card.icon
  return (
    <Card className="p-4" data-fenix={fenixId}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {card.label}
        </span>
        <Icon className={`h-4 w-4 ${card.color}`} />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {loading ? '…' : card.value}
      </p>
    </Card>
  )
}

export function CobrancaKPIs({ resumo, loading, fenixFiltros }: Props) {
  const { totalValor, qtd, comWhatsapp } = resumo
  const faltaWhatsapp = Math.max(0, qtd - comWhatsapp)
  const fenixInput = fenixFiltros && !loading ? { resumo, filtros: fenixFiltros } : null

  const cards: CardItem[] = [
    {
      label: 'Valor pendente',
      value: formatCurrency(totalValor),
      icon: AlertTriangle,
      color: 'text-red-600',
      fenix: fenixInput
        ? { chave: 'cobranca.painel.valor-pendente', explicar: () => explicarPainelValorPendente(fenixInput) }
        : undefined,
    },
    {
      label: 'Títulos no painel',
      value: String(qtd),
      icon: ListChecks,
      color: 'text-slate-700',
      fenix: fenixInput
        ? { chave: 'cobranca.painel.titulos', explicar: () => explicarPainelTitulos(fenixInput) }
        : undefined,
    },
    {
      label: 'Cobrados (WhatsApp)',
      value: `${comWhatsapp}/${qtd}`,
      icon: MessageCircle,
      color: 'text-emerald-600',
      fenix: fenixInput
        ? { chave: 'cobranca.painel.cobrados', explicar: () => explicarPainelCobrados(fenixInput) }
        : undefined,
    },
    {
      label: 'Aguardando WhatsApp',
      value: String(faltaWhatsapp),
      icon: AlertTriangle,
      color: 'text-amber-600',
      fenix: fenixInput
        ? { chave: 'cobranca.painel.aguardando', explicar: () => explicarPainelAguardando(fenixInput) }
        : undefined,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <KpiCard key={c.label} card={c} loading={loading} />
      ))}
    </div>
  )
}
