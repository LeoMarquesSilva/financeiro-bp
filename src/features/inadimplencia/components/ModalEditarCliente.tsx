import { useState, useEffect, useMemo } from 'react'
import { formatCnpj } from '@/shared/utils/format'
import { TeamMemberSelect } from '@/shared/components/TeamMemberSelect'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

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
  const [gestor, setGestor] = useState(client.gestor ?? '')
  const [area, setArea] = useState(client.area ?? '')
  const [statusClasse, setStatusClasse] = useState<InadimplenciaClasse>(client.status_classe)
  const [valorEmAberto, setValorEmAberto] = useState(String(client.valor_em_aberto ?? 0))
  const [dataVencimento, setDataVencimento] = useState(
    client.data_vencimento ? client.data_vencimento.slice(0, 10) : ''
  )
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
    if (open) {
      setRazaoSocial(client.razao_social)
      setCnpj(client.cnpj ?? '')
      setContato(client.contato ?? '')
      const resolved = resolveTeamMember(client.gestor ?? '', teamMembers)
      setGestor(resolved?.email ?? client.gestor ?? '')
      setArea(client.area ?? '')
      setStatusClasse(client.status_classe)
      setValorEmAberto(String(client.valor_em_aberto ?? 0))
      setDataVencimento(client.data_vencimento ? client.data_vencimento.slice(0, 10) : '')
      setUltimaProvidencia(client.ultima_providencia ?? '')
      setDataProvidencia(client.data_providencia ? client.data_providencia.slice(0, 10) : '')
      setFollowUp(client.follow_up ?? '')
      setDataFollowUp(client.data_follow_up ? client.data_follow_up.slice(0, 10) : '')
    }
  }, [open, client, teamMembers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const { error } = await updateCliente.mutateAsync({
      id: client.id,
      input: {
        razao_social: razaoSocial,
        cnpj: cnpj.replace(/\D/g, '').length === 14 ? cnpj.replace(/\D/g, '') : null,
        contato: contato || null,
        gestor: gestor || null,
        area: area || null,
        status_classe: statusClasse,
        valor_em_aberto: Number(valorEmAberto) || 0,
        data_vencimento: dataVencimento || undefined,
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
          <Label>Gestor</Label>
          <TeamMemberSelect
            value={gestor}
            onChange={setGestor}
            teamMembers={teamMembers}
            placeholder="Selecione"
          />
        </div>
        <div className="space-y-2">
          <Label>Área</Label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={inputSelectClass}
          >
            <option value="">Selecione</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
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
