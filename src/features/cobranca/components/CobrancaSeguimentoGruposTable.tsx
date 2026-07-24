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
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { InadimplenciaGrupoBadges } from '@/features/escritorio/components/InadimplenciaGrupoBadges'
import {
  getInadimplenciaStatusForGrupoChave,
  type InadimplenciaGruposIndex,
} from '@/features/escritorio/services/inadimplenciaGruposIndex'
import { labelCanalD1, labelTipoAcaoSeguimento, formatDepartamentosLinha } from '../utils/cobrancaSeguimentoLabels'
import type { CobrancaSeguimentoGrupo } from '../types/cobrancaSeguimento.types'

type SortKey =
  | 'grupo_chave'
  | 'valor_total'
  | 'qtd_titulos'
  | 'max_dias_atraso'
  | 'cobranca_d1'
  | 'ultimo_seguimento'

type SortDir = 'asc' | 'desc'

interface Props {
  grupos: CobrancaSeguimentoGrupo[]
  loading?: boolean
  inadimplenciaIndex?: InadimplenciaGruposIndex | null
  onOpenGrupo: (grupo: CobrancaSeguimentoGrupo) => void
}

function followUpVencido(data: string | null | undefined): boolean {
  if (!data) return false
  return data < new Date().toISOString().slice(0, 10)
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

function compareGrupos(a: CobrancaSeguimentoGrupo, b: CobrancaSeguimentoGrupo, key: SortKey): number {
  switch (key) {
    case 'grupo_chave':
      return a.grupo_chave.localeCompare(b.grupo_chave, 'pt-BR')
    case 'valor_total':
      return a.valor_total - b.valor_total
    case 'qtd_titulos':
      return a.qtd_titulos - b.qtd_titulos
    case 'max_dias_atraso':
      return a.max_dias_atraso - b.max_dias_atraso
    case 'cobranca_d1': {
      const diff = Number(a.cobranca_d1_realizada) - Number(b.cobranca_d1_realizada)
      if (diff !== 0) return diff
      return compareNullableDate(a.ultima_cobranca_d1_at, b.ultima_cobranca_d1_at)
    }
    case 'ultimo_seguimento':
      return compareNullableDate(a.ultima_acao_seguimento_at, b.ultima_acao_seguimento_at)
    default:
      return 0
  }
}

function SortableTableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'center' | 'right'
}) {
  const active = activeKey === sortKey
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

  return (
    <TableHead
      className={cn(
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-slate-800',
          align === 'right' && 'ml-auto',
          align === 'center' && 'mx-auto',
          active ? 'text-slate-800' : 'text-slate-500',
        )}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-40')} />
      </button>
    </TableHead>
  )
}

export function CobrancaSeguimentoGruposTable({
  grupos,
  loading,
  inadimplenciaIndex,
  onOpenGrupo,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('valor_total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'grupo_chave' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const list = [...grupos]
    const sign = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => sign * compareGrupos(a, b, sortKey))
    return list
  }, [grupos, sortKey, sortDir])

  const maxValor = useMemo(
    () => (grupos.length > 0 ? Math.max(...grupos.map((g) => g.valor_total)) : 1),
    [grupos],
  )

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white py-16 text-slate-400">
        <p className="text-sm">Nenhum grupo com títulos vencidos até 60 dias após D+1.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            <SortableTableHead
              label="Grupo / Cliente"
              sortKey="grupo_chave"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Valor em aberto"
              sortKey="valor_total"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              align="right"
            />
            <SortableTableHead
              label="Títulos"
              sortKey="qtd_titulos"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              align="center"
            />
            <SortableTableHead
              label="Atraso máx."
              sortKey="max_dias_atraso"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              align="center"
            />
            <SortableTableHead
              label="Cobrança D+1"
              sortKey="cobranca_d1"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortableTableHead
              label="Último seguimento"
              sortKey="ultimo_seguimento"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
            />
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((grupo, index) => {
            const pct = maxValor > 0 ? Math.max(4, (grupo.valor_total / maxValor) * 100) : 0
            const inadimplencia = inadimplenciaIndex
              ? getInadimplenciaStatusForGrupoChave(grupo.grupo_chave, inadimplenciaIndex)
              : { ativa: null, resolvida: null }
            const followUpAtrasado = followUpVencido(grupo.proximo_follow_up)
            const deptLinha = formatDepartamentosLinha(grupo.departamentos ?? [])

            return (
              <TableRow key={grupo.grupo_chave} className="hover:bg-slate-50/80">
                <TableCell className="text-center align-top">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {index + 1}
                  </span>
                </TableCell>
                <TableCell className="min-w-[220px] align-top">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onOpenGrupo(grupo)}
                        className="truncate text-left text-sm font-medium text-slate-900 hover:underline"
                      >
                        {grupo.grupo_chave}
                      </button>
                      {inadimplenciaIndex && (
                        <InadimplenciaGrupoBadges
                          ativa={inadimplencia.ativa}
                          resolvida={inadimplencia.resolvida}
                          grupoNome={grupo.grupo_chave}
                          size="sm"
                        />
                      )}
                    </div>
                    {grupo.qtd_razoes > 1 && (
                      <p className="text-xs text-slate-400">{grupo.qtd_razoes} razões sociais</p>
                    )}
                    <div className="h-1.5 max-w-[200px] overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-500/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {deptLinha && (
                      <p className="max-w-[320px] text-[11px] leading-snug text-slate-500">
                        {deptLinha}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right align-top font-semibold text-slate-900">
                  {formatCurrency(grupo.valor_total)}
                </TableCell>
                <TableCell className="text-center align-top text-slate-600">
                  {grupo.qtd_titulos}
                </TableCell>
                <TableCell className="text-center align-top">
                  <Badge
                    variant="outline"
                    className={cn(
                      grupo.max_dias_atraso > 30
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600',
                    )}
                  >
                    {grupo.max_dias_atraso}d
                  </Badge>
                </TableCell>
                <TableCell className="align-top">
                  {grupo.cobranca_d1_realizada ? (
                    <div className="text-xs text-slate-600">
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Realizada
                      </Badge>
                      {grupo.ultima_cobranca_d1_at && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatDateTime(grupo.ultima_cobranca_d1_at)} ·{' '}
                          {labelCanalD1(grupo.ultima_cobranca_d1_canal)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                      Sem D+1
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {grupo.ultima_acao_seguimento_at ? (
                    <div className="text-xs text-slate-600">
                      <span>{labelTipoAcaoSeguimento(grupo.ultima_acao_seguimento_tipo)}</span>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(grupo.ultima_acao_seguimento_at)}
                      </p>
                      {grupo.proximo_follow_up && (
                        <p
                          className={cn(
                            'text-[11px]',
                            followUpAtrasado ? 'font-medium text-rose-600' : 'text-slate-400',
                          )}
                        >
                          Follow-up: {formatDate(grupo.proximo_follow_up)}
                          {followUpAtrasado ? ' (vencido)' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Sem ação</span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => onOpenGrupo(grupo)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    Detalhe
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
