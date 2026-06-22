import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/shared/utils/format'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useEscritorioGruposResumo } from '../hooks/useEscritorioGruposResumo'
import {
  getMetricaBySlug,
  nomeGrupoExibicao,
  valorMetricaGrupo,
  type MetricaFinanceiraEscritorio,
} from '../constants/financeiroTotais'
import type { GrupoResumoRow } from '../services/escritorioService'
import { cn } from '@/lib/utils'

const DEBOUNCE_BUSCA_MS = 300

interface GrupoMetricaRow {
  grupo: string
  valor: number
  totalEmpresas: number
  resumo: GrupoResumoRow
}

export function EscritorioFinanceiroDetalhePage() {
  const { metrica: metricaSlug } = useParams<{ metrica: string }>()
  const metricaConfig = getMetricaBySlug(metricaSlug)
  const [busca, setBusca] = useState('')
  const debouncedBusca = useDebounce(busca, DEBOUNCE_BUSCA_MS)

  const { data: resumo = [], isLoading, error } = useEscritorioGruposResumo()

  if (!metricaConfig) {
    return <Navigate to="/financeiro/escritorio" replace />
  }

  const metrica = metricaConfig.id as MetricaFinanceiraEscritorio
  const Icon = metricaConfig.icon

  const linhas = useMemo(() => {
    const b = debouncedBusca.toLowerCase().trim()
    const rows: GrupoMetricaRow[] = []

    for (const r of resumo) {
      const valor = valorMetricaGrupo(r, metrica)
      if (valor <= 0) continue
      const grupo = nomeGrupoExibicao(r.grupo_cliente)
      if (b && !grupo.toLowerCase().includes(b)) continue
      rows.push({
        grupo,
        valor,
        totalEmpresas: r.total_empresas,
        resumo: r,
      })
    }

    return rows.sort((a, b) => b.valor - a.valor || a.grupo.localeCompare(b.grupo))
  }, [resumo, metrica, debouncedBusca])

  const total = useMemo(() => linhas.reduce((acc, row) => acc + row.valor, 0), [linhas])

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-slate-600" asChild>
          <Link to="/financeiro/escritorio">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Escritório
          </Link>
        </Button>

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            <Icon className={cn('h-7 w-7 shrink-0', metricaConfig.labelClassName)} aria-hidden />
            {metricaConfig.label}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
            Valores por grupo. {metricaConfig.subtitle ?? 'Clique em um grupo na listagem principal para ver empresas e detalhes.'}
          </p>
        </div>
      </header>

      <Card className={cn('border shadow-sm', metricaConfig.cardClassName)}>
        <CardContent className="flex flex-col gap-1 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={cn('text-xs font-medium uppercase tracking-wide', metricaConfig.labelClassName)}>
              Total geral
            </p>
            <p className={cn('text-2xl font-bold sm:text-3xl', metricaConfig.valueClassName)}>
              {formatCurrency(total)}
            </p>
          </div>
          <p className={cn('text-sm', metricaConfig.countClassName)}>
            {linhas.length} grupo{linhas.length !== 1 ? 's' : ''} com valor
          </p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          placeholder="Buscar grupo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Erro ao carregar dados.'}
        </div>
      )}

      {!isLoading && !error && linhas.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          Nenhum grupo encontrado para esta métrica.
        </div>
      )}

      {!isLoading && !error && linhas.length > 0 && (
        <>
          {/* Mobile: cards empilhados */}
          <div className="space-y-2 md:hidden">
            {linhas.map((row) => (
              <Link
                key={row.grupo}
                to={`/financeiro/escritorio?busca=${encodeURIComponent(row.grupo)}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium text-slate-900">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{row.grupo}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.totalEmpresas} empresa{row.totalEmpresas !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className={cn('shrink-0 text-sm font-semibold', metricaConfig.valueClassName)}>
                    {formatCurrency(row.valor)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Empresas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((row, index) => (
                  <TableRow key={row.grupo} className="group">
                    <TableCell className="text-center text-xs text-slate-400">{index + 1}</TableCell>
                    <TableCell>
                      <Link
                        to={`/financeiro/escritorio?busca=${encodeURIComponent(row.grupo)}`}
                        className="flex items-center gap-2 font-medium text-slate-900 hover:text-slate-700 hover:underline"
                      >
                        <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">{row.grupo}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-slate-600">{row.totalEmpresas}</TableCell>
                    <TableCell className={cn('text-right font-semibold', metricaConfig.valueClassName)}>
                      {formatCurrency(row.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
