import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { formatCnpj, formatHorasDuracao } from '@/shared/utils/format'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import { Briefcase, Clock, Building2 } from 'lucide-react'

export interface ClienteEscritorioDetailSheetProps {
  open: boolean
  onClose: () => void
  cliente: ClienteEscritorioRow | null
}

export function ClienteEscritorioDetailSheet({
  open,
  onClose,
  cliente,
}: ClienteEscritorioDetailSheetProps) {
  if (!cliente) return null

  const processos = Number(cliente.qtd_processos) || 0
  const horas = Number(cliente.horas_total) || 0
  const grupo = cliente.grupo_cliente?.trim() || null
  const horasPorAno = cliente.horas_por_ano ?? {}

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-slate-200 px-6 py-4">
          <SheetTitle className="pr-8 text-xl text-slate-900">{cliente.razao_social}</SheetTitle>
          {grupo && (
            <SheetDescription className="flex items-center gap-2 text-slate-500">
              <Building2 className="h-4 w-4 shrink-0" />
              {grupo}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <section className="mb-6">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Processos e horas
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Briefcase className="h-4 w-4" />
                  <span className="text-xs font-medium">Processos</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">{processos}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Horas total</span>
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatHorasDuracao(horas)}
                </p>
              </div>
            </div>
          </section>

          {cliente.cnpj && (
            <section className="mb-6">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                CNPJ
              </h4>
              <p className="font-mono text-sm text-slate-700">{formatCnpj(cliente.cnpj)}</p>
            </section>
          )}

          {Object.keys(horasPorAno).length > 0 && (
            <section className="rounded-xl border border-slate-200/80 bg-slate-50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Horas por ano (TimeSheets)
              </h4>
              <ul className="space-y-2">
                {Object.entries(horasPorAno)
                  .filter(([, h]) => Number(h) > 0)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([ano, h]) => (
                    <li key={ano} className="flex justify-between gap-2 text-sm">
                      <span className="text-slate-600">{ano}</span>
                      <strong className="text-slate-900">{formatHorasDuracao(Number(h))}</strong>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <p className="mt-6 text-xs text-slate-400">
            Em breve: mais informações e histórico deste contato.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
