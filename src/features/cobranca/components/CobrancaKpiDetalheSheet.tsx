import { useMemo, useState } from 'react'
import { Mail, MessageCircle, Search } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/format'
import type { CobrancaPainelKpiRow } from '../services/cobrancaService'

export type KpiCardTipo = 'vencidos' | 'd1' | 'fora_prazo' | 'sem_cobranca' | 'com_whatsapp'

function labelCanalCobranca(canal: string | null | undefined): string {
  if (canal === 'whatsapp') return 'WhatsApp'
  if (canal === 'email') return 'E-mail'
  return '—'
}

const CARD_LABELS: Record<KpiCardTipo, string> = {
  vencidos: 'Títulos vencidos',
  d1: 'No D+1 (indicador)',
  fora_prazo: 'Fora do prazo D+1',
  sem_cobranca: 'Sem cobrança',
  com_whatsapp: 'Com WhatsApp (total)',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tipo: KpiCardTipo | null
  rows: CobrancaPainelKpiRow[]
}

export function CobrancaKpiDetalheSheet({ open, onOpenChange, tipo, rows }: Props) {
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 250)

  const titulo = tipo ? CARD_LABELS[tipo] : 'Detalhe'
  const valorTotal = useMemo(
    () => rows.reduce((s, r) => s + Number(r.valor ?? 0), 0),
    [rows],
  )

  const filtradas = useMemo(() => {
    const termo = buscaDebounced.trim().toLowerCase()
    const base = [...rows].sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0))
    if (!termo) return base
    return base.filter((r) => {
      const hay = [r.cliente, r.grupo_cliente, r.nro_titulo, r.plano_contas]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(termo)
    })
  }, [rows, buscaDebounced])

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setBusca('')
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>
            {rows.length} título(s) · {formatCurrency(valorTotal)}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, título, grupo..."
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-6">
          {filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum título encontrado.</p>
          ) : (
            <ul className="space-y-2">
              {filtradas.map((r) => (
                <li
                  key={r.parcela_id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {r.cliente || r.grupo_cliente || '—'}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {r.nro_titulo || 'Sem número'}
                        {r.grupo_cliente ? ` · ${r.grupo_cliente}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900">
                      {formatCurrency(Number(r.valor ?? 0))}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span>Venc. {formatDate(r.data_vencimento)}</span>
                    <span>{Number(r.dias_atraso ?? 0)} dia(s) em atraso</span>
                    {r.plano_contas && <span className="truncate">{r.plano_contas}</span>}
                  </div>
                  {r.ultima_cobranca_at ? (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                      {r.ultima_cobranca_canal === 'email' ? (
                        <Mail className="h-3 w-3 shrink-0" />
                      ) : (
                        <MessageCircle className="h-3 w-3 shrink-0" />
                      )}
                      <span>
                        Cobrança em {formatDateTime(r.ultima_cobranca_at)} ·{' '}
                        {labelCanalCobranca(r.ultima_cobranca_canal)}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">Sem cobrança registrada</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
