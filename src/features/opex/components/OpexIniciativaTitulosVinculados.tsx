import { formatCurrency, formatDate } from '@/shared/utils/format'
import { OPEX_COLORS } from '../constants'
import { useOpexTitulosCiItens } from '../hooks/useOpexTitulosCiItens'
import { valorReferenciaTitulos } from '../services/opexService'
import type { OpexTituloVinculado } from '../types/opexMetas.types'
import { cn } from '@/lib/utils'
import { Link2, Loader2 } from 'lucide-react'

type Props = {
  ciItens: number[]
  compact?: boolean
  showTotal?: boolean
}

function TituloVinculoCard({ t, compact }: { t: OpexTituloVinculado; compact?: boolean }) {
  const valor = Math.max(t.valor_previsto, t.valor_realizado)
  return (
    <div
      className={cn(
        'rounded-md border border-slate-200/80 bg-white',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
      )}
    >
      <p className={cn('font-medium text-slate-900', compact ? 'text-[11px] leading-snug' : 'text-xs')}>
        {t.descricao}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Nº {t.nro_titulo}
        {t.fornecedor !== '—' && <> · {t.fornecedor}</>}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
        <span>
          {t.grupo_conta} / {t.plano_contas}
        </span>
        <span>
          Venc. {formatDate(t.data_vencimento)} · Pag. {formatDate(t.data_pagamento)}
        </span>
        <span className="font-semibold tabular-nums text-slate-800">{formatCurrency(valor)}</span>
      </div>
    </div>
  )
}

export function OpexIniciativaTitulosVinculados({ ciItens, compact, showTotal }: Props) {
  const { data, isLoading } = useOpexTitulosCiItens(ciItens)

  if (!ciItens.length) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
        <Link2 className="h-3 w-3 shrink-0" aria-hidden />
        Nenhum título VIOS vinculado
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-1 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Carregando títulos…
      </div>
    )
  }

  if (!data?.length) {
    return (
      <p className="text-[11px] text-slate-500">
        Títulos vinculados não encontrados no VIOS (CI Item: {ciItens.join(', ')}).
      </p>
    )
  }

  const total = valorReferenciaTitulos(data)

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        <Link2 className="h-3 w-3" aria-hidden />
        Título(s) VIOS vinculado(s)
      </p>
      <div className="space-y-1.5">
        {data.map((t: OpexTituloVinculado) => (
          <TituloVinculoCard key={t.ci_item} t={t} compact={compact} />
        ))}
      </div>
      {showTotal && (
        <p className="text-[11px] text-slate-600">
          Valor de referência dos títulos:{' '}
          <strong className={cn('tabular-nums', OPEX_COLORS.realizado.text)}>{formatCurrency(total)}</strong>
        </p>
      )}
    </div>
  )
}
