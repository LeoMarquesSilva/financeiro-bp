import type { GrupoEscritorio } from '../services/escritorioService'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { formatHorasHHMMSS } from '@/shared/utils/format'
import { Building2, Briefcase, Clock, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const LABELS_CONTAGEM: Record<string, string> = {
  arquivado: 'Arquivado',
  arquivado_definitivamente: 'Arquivado Definitivamente',
  arquivado_provisoriamente: 'Arquivado Provisoriamente',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  ex_cliente: 'Encerrado - Ex-Cliente',
  suspenso: 'Suspenso',
  outros: 'Outros',
}

interface GrupoEscritorioCardProps {
  grupo: GrupoEscritorio
  onSelectCliente?: (cliente: ClienteEscritorioRow) => void
}

export function GrupoEscritorioCard({ grupo, onSelectCliente }: GrupoEscritorioCardProps) {
  const [maisInfosAberto, setMaisInfosAberto] = useState(false)
  const { grupo_cliente, empresas, contagem, horasGrupo, horasPorAno } = grupo
  const totalGeral = contagem?.total_geral ?? 0
  const anosOrdenados = Object.keys(horasPorAno ?? {})
    .filter((y) => Number(horasPorAno[y]) > 0)
    .sort()

  const itensContagem: [string, number][] = []
  if (contagem) {
    for (const key of Object.keys(LABELS_CONTAGEM)) {
      const value = contagem[key as keyof typeof contagem]
      if (typeof value === 'number' && value > 0) {
        itensContagem.push([key, value])
      }
    }
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <Building2 className="h-5 w-5 shrink-0 text-slate-500" />
          <span>{grupo_cliente}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Empresas do grupo */}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
            Empresas ({empresas.length})
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700">
            {empresas.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelectCliente?.(e)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 truncate text-left hover:bg-slate-100/80 rounded px-2 py-1 -mx-2 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-inset',
                    onSelectCliente && 'cursor-pointer'
                  )}
                >
                  <span className="min-w-0 truncate">{e.razao_social}</span>
                  {onSelectCliente && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Total geral (processos) e Horas (timesheets) */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-slate-600">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <strong>{totalGeral}</strong> {totalGeral === 1 ? 'processo' : 'processos'} (total geral)
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <strong>{formatHorasHHMMSS(horasGrupo)}</strong> (TimeSheets)
          </span>
        </div>

        {/* Horas por ano (TimeSheets) */}
        {anosOrdenados.length > 0 && (
          <div className="rounded border border-slate-200 bg-slate-50/50 px-3 py-2">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              TimeSheets por ano
            </p>
            <ul className="space-y-1 text-sm text-slate-600">
              {anosOrdenados.map((ano) => (
                <li key={ano} className="flex justify-between gap-2">
                  <span>{ano}</span>
                  <strong>{formatHorasHHMMSS(Number(horasPorAno[ano]))}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mais infos: breakdown por situação */}
        {itensContagem && itensContagem.length > 0 && (
          <div className="rounded border border-slate-200 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setMaisInfosAberto((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100/80"
            >
              Mais infos (tipos no total geral)
              {maisInfosAberto ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {maisInfosAberto && (
              <ul className="border-t border-slate-200 px-3 py-2 text-sm text-slate-600">
                {itensContagem.map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-2">
                    <span>{LABELS_CONTAGEM[key] ?? key}</span>
                    <strong>{value}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
