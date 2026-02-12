import { useMemo } from 'react'
import { CLASSES } from '@/shared/constants/inadimplencia'
import { TeamMemberSelect } from '@/shared/components/TeamMemberSelect'
import type { InadimplenciaClasse } from '@/lib/database.types'
import type { FiltrosInadimplencia } from '../types/inadimplencia.types'
import type { TeamMember } from '@/lib/database.types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RotateCcw, Search } from 'lucide-react'

function getAreasFromTeam(teamMembers: TeamMember[]): string[] {
  const set = new Set(teamMembers.map((m) => m.area))
  const list = Array.from(set).sort()
  if (!list.includes('Outro')) list.push('Outro')
  return list
}

import type { OrderByInadimplencia, PrioridadeTipo } from '../types/inadimplencia.types'

const PRIORIDADE_OPTIONS: { value: PrioridadeTipo | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'controlado', label: 'Controlado' },
]

const ORDER_OPTIONS: { value: OrderByInadimplencia; label: string; defaultDesc: boolean }[] = [
  { value: 'valor_em_aberto', label: 'Valor em aberto', defaultDesc: true },
  { value: 'dias_em_aberto', label: 'Dias em atraso', defaultDesc: true },
  { value: 'razao_social', label: 'Nome', defaultDesc: false },
  { value: 'created_at', label: 'Data de cadastro', defaultDesc: true },
]

interface FiltrosInadimplenciaProps {
  filtros: FiltrosInadimplencia
  orderBy: OrderByInadimplencia
  orderDesc: boolean
  teamMembers: TeamMember[]
  onBuscaChange: (v: string) => void
  onGestorChange: (v: string) => void
  onAreaChange: (v: string) => void
  onClasseChange: (v: InadimplenciaClasse | '') => void
  onPrioridadeChange: (v: PrioridadeTipo | '') => void
  onOrderChange: (by: OrderByInadimplencia, desc?: boolean) => void
  onReset: () => void
}

export function FiltrosInadimplencia({
  filtros,
  orderBy,
  orderDesc,
  teamMembers,
  onBuscaChange,
  onGestorChange,
  onAreaChange,
  onClasseChange,
  onPrioridadeChange,
  onOrderChange,
  onReset,
}: FiltrosInadimplenciaProps) {
  const areas = useMemo(() => getAreasFromTeam(teamMembers), [teamMembers])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-[220px] flex-col gap-2">
            <Label className="text-xs font-medium text-slate-600">Buscar (nome ou CNPJ)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                value={filtros.busca}
                onChange={(e) => onBuscaChange(e.target.value)}
                placeholder="Digite nome ou CNPJ..."
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="flex min-w-[180px] flex-col gap-2">
            <Label className="text-xs font-medium text-slate-600">Ordenar por</Label>
            <select
              value={`${orderBy}:${orderDesc}`}
              onChange={(e) => {
                const [by, descStr] = e.target.value.split(':') as [OrderByInadimplencia, string]
                const opt = ORDER_OPTIONS.find((o) => o.value === by)
                onOrderChange(by, opt ? opt.defaultDesc : descStr === 'true')
              }}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              {ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={`${opt.value}:${opt.defaultDesc}`}>
                  {opt.label} ({opt.defaultDesc ? 'maior primeiro' : 'A–Z'})
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label className="text-xs font-medium text-slate-600">Gestor</Label>
            <TeamMemberSelect
              value={filtros.gestor}
              onChange={onGestorChange}
              teamMembers={teamMembers}
              placeholder="Todos"
              compact
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-slate-600">Área</Label>
            <select
              value={filtros.area}
              onChange={(e) => onAreaChange(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              <option value="">Todas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-slate-600">Classe</Label>
            <select
              value={filtros.classe}
              onChange={(e) => onClasseChange((e.target.value || '') as InadimplenciaClasse | '')}
              className="flex h-9 w-full min-w-[80px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              <option value="">Todas</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-slate-600">Urgência</Label>
            <select
              value={filtros.prioridade}
              onChange={(e) => onPrioridadeChange((e.target.value || '') as PrioridadeTipo | '')}
              className="flex h-9 w-full min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              {PRIORIDADE_OPTIONS.map((opt) => (
                <option key={opt.value || 'todas'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
