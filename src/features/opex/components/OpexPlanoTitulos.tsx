import { useQuery } from '@tanstack/react-query'
import { Calendar, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { opexService } from '../services/opexService'
import { OPEX_COLORS } from '../constants'
import { mesesFiltroKey } from '../utils/opexPeriodo'
import type { OpexTituloRow } from '../types/opex.types'

type Props = {
  ano: number
  grupo: string
  plano: string
  mesesFiltro: number[]
}

function situacaoBadgeClass(situacao: string): string {
  const s = situacao.toUpperCase()
  if (s.includes('PAGO') || s.includes('QUIT')) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  if (s.includes('ABERTO') || s.includes('VENC')) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function TituloCard({ titulo }: { titulo: OpexTituloRow }) {
  return (
    <article className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-slate-900">{titulo.descricao}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Título {titulo.nro_titulo}
            {titulo.fornecedor !== '—' && (
              <>
                {' '}
                · <span className="text-slate-600">{titulo.fornecedor}</span>
              </>
            )}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            situacaoBadgeClass(titulo.situacao_titulo),
          )}
        >
          {titulo.situacao_titulo}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Vencimento</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-medium tabular-nums text-slate-800">
            <Calendar className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            {formatDate(titulo.data_vencimento)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Pagamento</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-medium tabular-nums text-slate-800">
            <Calendar className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            {formatDate(titulo.data_pagamento)}
          </dd>
        </div>
        <div>
          <dt className={cn('text-slate-500', OPEX_COLORS.previsto.text)}>Previsto</dt>
          <dd className={cn('mt-0.5 font-semibold tabular-nums', OPEX_COLORS.previsto.text)}>
            {titulo.valor_previsto > 0 ? formatCurrency(titulo.valor_previsto) : '—'}
          </dd>
        </div>
        <div>
          <dt className={cn('text-slate-500', OPEX_COLORS.realizado.text)}>Realizado</dt>
          <dd className={cn('mt-0.5 font-semibold tabular-nums', OPEX_COLORS.realizado.text)}>
            {titulo.valor_realizado > 0 ? formatCurrency(titulo.valor_realizado) : '—'}
          </dd>
        </div>
      </dl>

      {titulo.departamento !== '—' && (
        <p className="mt-2 text-[10px] text-slate-500">
          Depto. <span className="text-slate-600">{titulo.departamento}</span>
        </p>
      )}
    </article>
  )
}

export function OpexPlanoTitulos({ ano, grupo, plano, mesesFiltro }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['opex', 'titulos', ano, grupo, plano, mesesFiltroKey(mesesFiltro)],
    queryFn: () => opexService.fetchPlanoTitulos(ano, grupo, plano, mesesFiltro),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando títulos…
      </div>
    )
  }

  if (error) {
    return (
      <p className="py-3 text-xs text-red-600">
        Erro ao carregar títulos. Aplique a migration <code>opex_plano_titulos</code>.
      </p>
    )
  }

  if (!data?.length) {
    return <p className="py-3 text-xs text-slate-400">Nenhum título encontrado neste plano.</p>
  }

  return (
    <div className="grid gap-2 pt-2 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((titulo: OpexTituloRow) => (
        <TituloCard key={titulo.ci_item} titulo={titulo} />
      ))}
    </div>
  )
}
