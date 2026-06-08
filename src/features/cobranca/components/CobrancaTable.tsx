import { Fragment, useMemo, useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Pencil, Archive, Phone, AtSign, ChevronDown, ChevronRight } from 'lucide-react'
import { formatPhoneMasked } from '../utils/phoneMask'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { CobrancaPainelRow } from '@/lib/database.types'

interface Props {
  rows: CobrancaPainelRow[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onCobrarGrupo: (rows: CobrancaPainelRow[]) => void
  onEditContato: (row: CobrancaPainelRow) => void
  onArquivar: (row: CobrancaPainelRow) => void
  /** Admin e financeiro podem remover título do painel. */
  canArquivar?: boolean
}

function CanalChip({ ok, label, Icon }: { ok: boolean; label: string; Icon: React.ElementType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400',
      )}
      title={`${label}: ${ok ? 'cobrado' : 'pendente'}`}
    >
      <Icon className="h-3 w-3" />
      {ok ? '✓' : '–'}
    </span>
  )
}

export function CobrancaTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onCobrarGrupo,
  onEditContato,
  onArquivar,
  canArquivar = false,
}: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const groupedRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        cliente: string
        pessoaNome: string
        grupoCliente: string
        rows: CobrancaPainelRow[]
        valorTotal: number
        maxAtraso: number
        comWhatsapp: number
        comTelefone: number
        comEmailContato: number
      }
    >()

    for (const row of rows) {
      const clienteNome = row.pessoa_nome || row.cliente || 'Cliente sem nome'
      const grupoNome = row.grupo_cliente || 'Sem grupo'
      const key = `${clienteNome}__${grupoNome}`
      const valor = Number(row.valor ?? 0)

      if (!map.has(key)) {
        map.set(key, {
          key,
          cliente: row.cliente || clienteNome,
          pessoaNome: clienteNome,
          grupoCliente: grupoNome,
          rows: [],
          valorTotal: 0,
          maxAtraso: 0,
          comWhatsapp: 0,
          comTelefone: 0,
          comEmailContato: 0,
        })
      }

      const group = map.get(key)!
      group.rows.push(row)
      group.valorTotal += valor
      group.maxAtraso = Math.max(group.maxAtraso, Number(row.dias_atraso ?? 0))
      if (row.tem_whatsapp) group.comWhatsapp += 1
      if (row.pessoa_telefone) group.comTelefone += 1
      if (row.pessoa_email) group.comEmailContato += 1
    }

    return Array.from(map.values())
  }, [rows])

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.parcela_id))
  const someSelected = rows.some((r) => selectedIds.has(r.parcela_id))

  const toggleGroupExpanded = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const setGroupChecked = (groupRows: CobrancaPainelRow[], checked: boolean) => {
    groupRows.forEach((row) => {
      const isSelected = selectedIds.has(row.parcela_id)
      if (checked && !isSelected) onToggle(row.parcela_id)
      if (!checked && isSelected) onToggle(row.parcela_id)
    })
  }

  const renderDetalheRow = (r: CobrancaPainelRow) => {
    const selected = selectedIds.has(r.parcela_id)
    return (
      <TableRow key={r.parcela_id} data-state={selected ? 'selected' : undefined}>
        <TableCell>
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(r.parcela_id)}
            aria-label={`Selecionar ${r.cliente}`}
          />
        </TableCell>
        <TableCell>
          <div className="font-medium text-slate-900">{r.pessoa_nome || r.cliente}</div>
          {r.grupo_cliente && <div className="text-xs text-slate-400">{r.grupo_cliente}</div>}
        </TableCell>
        <TableCell className="whitespace-nowrap text-slate-600">
          {r.nro_titulo || '-'}
          {r.parcela && r.parcelas && (
            <span className="ml-1 text-xs text-slate-400">
              ({r.parcela}/{r.parcelas})
            </span>
          )}
        </TableCell>
        <TableCell className="max-w-[160px] truncate text-slate-600" title={r.plano_contas ?? ''}>
          {r.plano_contas || '-'}
        </TableCell>
        <TableCell className="max-w-[200px] truncate text-slate-600" title={r.descricao ?? ''}>
          {r.descricao || '-'}
        </TableCell>
        <TableCell className="whitespace-nowrap text-slate-600">{formatDate(r.data_vencimento)}</TableCell>
        <TableCell className="text-right">
          <Badge variant={r.dias_atraso > 30 ? 'urgente' : r.dias_atraso > 7 ? 'atencao' : 'secondary'}>
            {r.dias_atraso}d
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap text-right font-medium text-slate-900">
          {formatCurrency(Number(r.valor ?? 0))}
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5 text-xs">
            <span className={cn('flex items-center gap-1', r.pessoa_telefone ? 'text-slate-600' : 'text-red-400')}>
              <Phone className="h-3 w-3" />
              {r.pessoa_telefone ? formatPhoneMasked(r.pessoa_telefone) : 'sem telefone'}
            </span>
            <span className={cn('flex items-center gap-1', r.pessoa_email ? 'text-slate-600' : 'text-red-400')}>
              <AtSign className="h-3 w-3" />
              {r.pessoa_email || 'sem e-mail'}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center">
            <CanalChip ok={r.tem_whatsapp} label="WhatsApp" Icon={MessageCircle} />
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              title="Cobrar este título"
              onClick={() => onCobrarGrupo([r])}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Cobrar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Editar contato"
              onClick={() => onEditContato(r)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {canArquivar && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-500 hover:text-red-600"
                title="Remover do painel"
                onClick={() => onArquivar(r)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={onToggleAll}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="max-w-[160px]">Plano de contas</TableHead>
            <TableHead className="max-w-[200px]">Descrição</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Atraso</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="text-center">Cobrança</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedRows.map((group) => {
            if (group.rows.length === 1) {
              return renderDetalheRow(group.rows[0])
            }

            const groupSelected = group.rows.every((r) => selectedIds.has(r.parcela_id))
            const groupSomeSelected = group.rows.some((r) => selectedIds.has(r.parcela_id))
            const expanded = expandedGroups.has(group.key)

            return (
              <Fragment key={group.key}>
                <TableRow
                  className="cursor-pointer bg-slate-50/60 hover:bg-slate-100/70"
                  data-state={groupSelected ? 'selected' : undefined}
                  onClick={() => toggleGroupExpanded(group.key)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={groupSelected}
                        indeterminate={!groupSelected && groupSomeSelected}
                        onCheckedChange={(value) => setGroupChecked(group.rows, value === true)}
                        aria-label={`Selecionar grupo ${group.pessoaNome}`}
                      />
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{group.pessoaNome}</div>
                    <div className="text-xs text-slate-400">{group.grupoCliente}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    <Badge variant="secondary">{group.rows.length} título(s)</Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-slate-500">—</TableCell>
                  <TableCell className="max-w-[200px] truncate text-slate-500">
                    Clique para ver títulos e detalhes
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">—</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        group.maxAtraso > 30 ? 'urgente' : group.maxAtraso > 7 ? 'atencao' : 'secondary'
                      }
                    >
                      {group.maxAtraso}d
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-semibold text-slate-900">
                    {formatCurrency(group.valorTotal)}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-500">
                      Tel: {group.comTelefone}/{group.rows.length}
                      <br />
                      E-mail: {group.comEmailContato}/{group.rows.length}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-500">
                      WhatsApp: {group.comWhatsapp}/{group.rows.length}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-400">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCobrarGrupo(group.rows)
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Cobrar grupo
                      </Button>
                      <span>{expanded ? 'Ocultar' : 'Expandir'}</span>
                    </div>
                  </TableCell>
                </TableRow>

                {expanded &&
                  group.rows.map((r) => renderDetalheRow(r))}
              </Fragment>
            )
          })}

          {groupedRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="py-8 text-center text-sm text-slate-500">
                Nenhum título encontrado para os filtros aplicados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
