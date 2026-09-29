import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import {
  fetchSaldoDevedorTitulosGrupo,
  type SaldoDevedorTituloRow,
} from '../services/saldoDevedorService'
import { nomeExibicaoGrupo } from '../utils/saldoDevedor'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupoNome: string | null
  ano: number
  mesFim: number
}

export function SaldoDevedorTitulosSheet({
  open,
  onOpenChange,
  grupoNome,
  ano,
  mesFim,
}: Props) {
  const grupo = grupoNome?.trim() ?? ''

  const { data, isLoading, error } = useQuery({
    queryKey: ['inadimplencia', 'saldo-devedor-titulos', grupo, ano, mesFim] as const,
    queryFn: () => fetchSaldoDevedorTitulosGrupo(grupo, ano, mesFim),
    enabled: open && grupo.length > 0,
    staleTime: 30_000,
  })

  const linhas = (data ?? []).filter((r: SaldoDevedorTituloRow) => r.saldo_vivo > 0.01)
  const total = linhas.reduce((s: number, r: SaldoDevedorTituloRow) => s + r.saldo_vivo, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Títulos no saldo devedor</SheetTitle>
          <SheetDescription>
            {grupo ? nomeExibicaoGrupo(grupo) : '—'} · vencidos até o corte · soma saldo vivo{' '}
            {formatCurrency(total)}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto pt-2">
          {isLoading ? (
            <p className="text-sm text-slate-500">Carregando títulos…</p>
          ) : error ? (
            <p className="text-sm text-red-600">Não foi possível carregar os títulos.</p>
          ) : linhas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum item com saldo vivo neste grupo.</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-2 font-medium">Título</th>
                  <th className="pb-2 pr-2 font-medium">Venc.</th>
                  <th className="pb-2 pr-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((row: SaldoDevedorTituloRow, idx: number) => (
                  <tr key={`${row.nro_titulo}-${row.valor_item}-${idx}`} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 align-top">
                      <div className="font-medium text-slate-800">{row.nro_titulo}</div>
                      <div className="text-[10px] text-slate-500">{row.cliente}</div>
                      {row.eh_saldo_parcial_vios ? (
                        <div className="text-[10px] font-medium text-sky-700">Saldo parcial VIOS</div>
                      ) : null}
                      {row.valor_parcial_aberto != null &&
                      row.valor_item != null &&
                      row.valor_parcial_aberto < row.valor_item - 0.01 ? (
                        <div className="text-[10px] text-amber-700">
                          Parcial aberto {formatCurrency(row.valor_parcial_aberto)} (item{' '}
                          {formatCurrency(row.valor_item)})
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 align-top text-slate-600">
                      {row.data_vencimento ? formatDate(row.data_vencimento) : '—'}
                      <div className="text-[10px] text-slate-400">{row.situacao_titulo ?? '—'}</div>
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right align-top font-semibold tabular-nums text-slate-900">
                      {formatCurrency(row.saldo_vivo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
