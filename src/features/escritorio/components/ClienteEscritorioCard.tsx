import type { ClienteEscritorioRow } from '@/lib/database.types'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { formatHorasDuracao, formatCnpj } from '@/shared/utils/format'
import { Briefcase, Clock, Building2 } from 'lucide-react'

interface ClienteEscritorioCardProps {
  cliente: ClienteEscritorioRow
}

export function ClienteEscritorioCard({ cliente }: ClienteEscritorioCardProps) {
  const processos = Number(cliente.qtd_processos) || 0
  const horas = Number(cliente.horas_total) || 0
  const grupo = cliente.grupo_cliente?.trim() || null

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Building2 className="h-5 w-5 shrink-0 text-slate-500" />
              <span className="truncate">{cliente.razao_social}</span>
            </CardTitle>
            {grupo && (
              <p className="mt-1 text-sm font-medium text-slate-500">{grupo}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-slate-600">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <strong>{processos}</strong> {processos === 1 ? 'processo' : 'processos'}
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <strong>{formatHorasDuracao(horas)}</strong>
          </span>
        </div>
        {cliente.cnpj && (
          <p className="text-xs text-slate-400 font-mono">
            CNPJ {formatCnpj(cliente.cnpj)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

