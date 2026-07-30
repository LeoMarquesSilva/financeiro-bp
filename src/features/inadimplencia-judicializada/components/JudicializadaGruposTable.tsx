import { useMemo, useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { InadimplenciaJudicializadaRow } from '../types/judicializada.types'

type Props = {
  rows: InadimplenciaJudicializadaRow[]
  loading?: boolean
  onOpenRow: (row: InadimplenciaJudicializadaRow) => void
  buscaAtiva?: string
  onIncluirCaso?: () => void
}

export function JudicializadaGruposTable({
  rows,
  loading,
  onOpenRow,
  buscaAtiva = '',
  onIncluirCaso,
}: Props) {
  const [areaFiltro, setAreaFiltro] = useState('')

  const areas = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      set.add(r.area?.trim() || 'Não informada')
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [rows])

  const filtradas = useMemo(() => {
    if (!areaFiltro) return rows
    return rows.filter((r) => (r.area?.trim() || 'Não informada') === areaFiltro)
  }, [rows, areaFiltro])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Carregando casos judicializados…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">
          {buscaAtiva ? `Nenhum caso encontrado para "${buscaAtiva}"` : 'Nenhum caso judicializado'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {buscaAtiva
            ? 'A busca filtra apenas casos já cadastrados. Use "Incluir caso" para registrar um novo grupo.'
            : 'Inclua um grupo com processo VIOS para começar o acompanhamento.'}
        </p>
        {onIncluirCaso && (
          <Button type="button" size="sm" className="mt-4" onClick={onIncluirCaso}>
            Incluir caso
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {areas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Área:</span>
          <Button
            type="button"
            size="sm"
            variant={areaFiltro === '' ? 'default' : 'outline'}
            onClick={() => setAreaFiltro('')}
          >
            Todas
          </Button>
          {areas.map((area) => (
            <Button
              key={area}
              type="button"
              size="sm"
              variant={areaFiltro === area ? 'default' : 'outline'}
              onClick={() => setAreaFiltro(area)}
            >
              {area}
            </Button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grupo</TableHead>
              <TableHead>CNJ</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor em aberto</TableHead>
              <TableHead>Judicializado em</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  'cursor-pointer hover:bg-slate-50',
                  row.encerrado_at && 'opacity-60',
                )}
                onClick={() => onOpenRow(row)}
              >
                <TableCell className="font-medium text-slate-900">{row.grupo_cliente}</TableCell>
                <TableCell className="font-mono text-xs text-slate-700">
                  {row.nro_cnj || '—'}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-sm text-slate-700">
                  {row.acao || '—'}
                </TableCell>
                <TableCell className="text-sm text-slate-600">{row.area || '—'}</TableCell>
                <TableCell className="text-sm text-slate-600">
                  {row.situacao_processo || '—'}
                </TableCell>
                <TableCell className="text-right font-semibold text-slate-900">
                  {formatCurrency(row.valor_em_aberto)}
                  {row.valor_em_aberto_ajuste != null && (
                    <span className="ml-1 text-[10px] font-normal text-amber-600">ajustado</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {row.data_judicializacao ? formatDate(row.data_judicializacao) : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {row.encerrado_at && (
                      <Badge variant="secondary" className="text-[10px]">
                        Encerrado
                      </Badge>
                    )}
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
