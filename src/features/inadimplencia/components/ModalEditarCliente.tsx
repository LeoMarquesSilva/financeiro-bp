import { useState, useEffect, useMemo, useRef } from 'react'
import { formatCnpj } from '@/shared/utils/format'
import { TeamMemberMultiSelect } from '@/shared/components/TeamMemberMultiSelect'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

function getAreasFromTeam(teamMembers: { area: string }[]): string[] {
  const set = new Set(teamMembers.map((m) => m.area))
  const list = Array.from(set).sort()
  if (!list.includes('Outro')) list.push('Outro')
  return list
}
import type { ClientInadimplenciaRow, InadimplenciaClasse } from '@/lib/database.types'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { resolveTeamMember } from '@/lib/teamMembersService'
import { toast } from 'sonner'
import { CLASSES, CLASS_LABELS } from '@/shared/constants/inadimplencia'

interface ModalEditarClienteProps {
  open: boolean
  onClose: () => void
  client: ClientInadimplenciaRow
  onSuccess: () => void
}

export function ModalEditarCliente({ open, onClose, client, onSuccess }: ModalEditarClienteProps) {
  const { updateCliente } = useInadimplenciaMutations()
  const { teamMembers } = useTeamMembers()
  const areas = useMemo(() => getAreasFromTeam(teamMembers), [teamMembers])
  const [razaoSocial, setRazaoSocial] = useState(client.razao_social)
  const [cnpj, setCnpj] = useState(client.cnpj ?? '')
  const [contato, setContato] = useState(client.contato ?? '')
  const [gestores, setGestores] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [areasDropdownOpen, setAreasDropdownOpen] = useState(false)
  const areasRef = useRef<HTMLDivElement>(null)
  const [statusClasse, setStatusClasse] = useState<InadimplenciaClasse>(client.status_classe)
  const [valorEmAberto, setValorEmAberto] = useState(String(client.valor_em_aberto ?? 0))
  const [dataVencimento, setDataVencimento] = useState(
    client.data_vencimento ? client.data_vencimento.slice(0, 10) : ''
  )
  const [observacoesGerais, setObservacoesGerais] = useState(client.observacoes_gerais ?? '')
  const [ultimaProvidencia, setUltimaProvidencia] = useState(client.ultima_providencia ?? '')
  const [dataProvidencia, setDataProvidencia] = useState(
    client.data_providencia ? client.data_providencia.slice(0, 10) : ''
  )
  const [followUp, setFollowUp] = useState(client.follow_up ?? '')
  const [dataFollowUp, setDataFollowUp] = useState(
    client.data_follow_up ? client.data_follow_up.slice(0, 10) : ''
  )
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (areasRef.current && !areasRef.current.contains(e.target as Node)) {
        setAreasDropdownOpen(false)
      }
    }
    if (areasDropdownOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [areasDropdownOpen])

  useEffect(() => {
    if (open) {
      setRazaoSocial(client.razao_social)
      setCnpj(client.cnpj ?? '')
      setContato(client.contato ?? '')
      const gestorArr: string[] = Array.isArray(client.gestor) ? client.gestor : client.gestor ? [client.gestor] : []
      const resolvedGestors = gestorArr.map((g) => {
        const resolved = resolveTeamMember(g, teamMembers)
        return resolved?.email ?? g
      })
      setGestores(resolvedGestors)
      const areaArr: string[] = Array.isArray(client.area) ? client.area : client.area ? [client.area] : []
      setSelectedAreas(areaArr)
      setStatusClasse(client.status_classe)
      setValorEmAberto(String(client.valor_em_aberto ?? 0))
      setDataVencimento(client.data_vencimento ? client.data_vencimento.slice(0, 10) : '')
      setObservacoesGerais(client.observacoes_gerais ?? '')
      setUltimaProvidencia(client.ultima_providencia ?? '')
      setDataProvidencia(client.data_providencia ? client.data_providencia.slice(0, 10) : '')
      setFollowUp(client.follow_up ?? '')
      setDataFollowUp(client.data_follow_up ? client.data_follow_up.slice(0, 10) : '')
    }
  }, [open, client, teamMembers])

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const removeArea = (area: string) => {
    setSelectedAreas((prev) => prev.filter((a) => a !== area))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const { error } = await updateCliente.mutateAsync({
      id: client.id,
      input: {
        razao_social: razaoSocial,
        cnpj: cnpj.replace(/\D/g, '').length === 14 ? cnpj.replace(/\D/g, '') : null,
        contato: contato || null,
        gestor: gestores.length > 0 ? gestores : null,
        area: selectedAreas.length > 0 ? selectedAreas : null,
        status_classe: statusClasse,
        valor_em_aberto: Number(valorEmAberto) || 0,
        data_vencimento: dataVencimento || undefined,
        observacoes_gerais: observacoesGerais || undefined,
        ultima_providencia: ultimaProvidencia || undefined,
        data_providencia: dataProvidencia || undefined,
        follow_up: followUp || undefined,
        data_follow_up: dataFollowUp || undefined,
      },
    })
    if (error) {
      setSubmitError(error.message)
      toast.error('Erro ao salvar')
      return
    }
    toast.success('Cliente atualizado')
    onClose()
    onSuccess()
  }

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
    setCnpj(raw)
  }

  return (
    <ModalBase open={open} onClose={onClose} title="Editar cliente">
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}
        <div className="space-y-2">
          <Label>Razão Social *</Label>
          <Input
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input
            value={cnpj ? formatCnpj(cnpj) : ''}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="space-y-2">
          <Label>Contato</Label>
          <Input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Gestores</Label>
          <TeamMemberMultiSelect
            value={gestores}
            onChange={setGestores}
            teamMembers={teamMembers}
            placeholder="Selecione os gestores"
          />
        </div>
        <div className="space-y-2" ref={areasRef}>
          <Label>Áreas</Label>
          <button
            type="button"
            onClick={() => setAreasDropdownOpen((o) => !o)}
            className={cn(
              inputSelectClass,
              'flex min-h-9 flex-wrap items-center gap-1.5 py-1.5'
            )}
          >
            {selectedAreas.length > 0 ? (
              selectedAreas.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium"
                >
                  {a}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-slate-200"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeArea(a)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-slate-500">Selecione as áreas</span>
            )}
            <span className="ml-auto shrink-0 pl-1 text-slate-400" aria-hidden>
              {areasDropdownOpen ? '▲' : '▼'}
            </span>
          </button>
          {areasDropdownOpen && (
            <ul className="z-50 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg list-none">
              {areas.map((a) => {
                const isSelected = selectedAreas.includes(a)
                return (
                  <li
                    key={a}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100',
                      isSelected && 'bg-slate-50'
                    )}
                    onClick={() => toggleArea(a)}
                  >
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    {a}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <Label>Classificação (Grau)</Label>
          <select
            value={statusClasse}
            onChange={(e) => setStatusClasse(e.target.value as InadimplenciaClasse)}
            className={inputSelectClass}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {CLASS_LABELS[c]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">Definida na reunião, conforme histórico do cliente.</p>
        </div>
        <div className="space-y-2">
          <Label>Valor em aberto</Label>
          <Input
            type="number"
            step={0.01}
            min={0}
            value={valorEmAberto}
            onChange={(e) => setValorEmAberto(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Data de vencimento</Label>
          <Input
            type="date"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Observações gerais</Label>
          <Textarea
            value={observacoesGerais}
            onChange={(e) => setObservacoesGerais(e.target.value)}
            placeholder="Observações gerais do registro"
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Última providência</Label>
          <Textarea
            value={ultimaProvidencia}
            onChange={(e) => setUltimaProvidencia(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Data providência</Label>
          <Input
            type="date"
            value={dataProvidencia}
            onChange={(e) => setDataProvidencia(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Follow-up</Label>
          <Textarea
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label>Data follow-up</Label>
          <Input
            type="date"
            value={dataFollowUp}
            onChange={(e) => setDataFollowUp(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={updateCliente.isPending}>
            {updateCliente.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
