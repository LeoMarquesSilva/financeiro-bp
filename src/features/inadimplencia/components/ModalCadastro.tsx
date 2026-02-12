import { useState, useMemo } from 'react'
import { formatCnpj } from '@/shared/utils/format'
import { TeamMemberSelect } from '@/shared/components/TeamMemberSelect'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { clienteInadimplenciaFormSchema } from '../types/inadimplencia.types'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { useTeamMembers } from '../hooks/useTeamMembers'
import type { InadimplenciaClasse } from '@/lib/database.types'
import { toast } from 'sonner'
import { CLASSES, CLASS_LABELS } from '@/shared/constants/inadimplencia'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

function getAreasFromTeam(teamMembers: { area: string }[]): string[] {
  const set = new Set(teamMembers.map((m) => m.area))
  const list = Array.from(set).sort()
  if (!list.includes('Outro')) list.push('Outro')
  return list
}

interface ModalCadastroProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const initialForm = {
  razao_social: '',
  cnpj: '',
  contato: '',
  gestor: '',
  area: '',
  status_classe: 'A' as InadimplenciaClasse,
  valor_em_aberto: '',
  data_vencimento: '',
}

export function ModalCadastro({ open, onClose, onSuccess }: ModalCadastroProps) {
  const { createCliente } = useInadimplenciaMutations()
  const { teamMembers } = useTeamMembers()
  const areas = useMemo(() => getAreasFromTeam(teamMembers), [teamMembers])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setErrors({})
    const parsed = clienteInadimplenciaFormSchema.safeParse({
      ...form,
      valor_em_aberto: form.valor_em_aberto === '' ? 0 : Number(form.valor_em_aberto),
      status_classe: form.status_classe,
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.errors.forEach((err) => {
        const path = err.path[0] as string
        if (path && err.message) fieldErrors[path] = err.message
      })
      setErrors(fieldErrors)
      return
    }
    const data = parsed.data
    const { error } = await createCliente.mutateAsync({
      razao_social: data.razao_social,
      cnpj: data.cnpj && data.cnpj.length === 14 ? data.cnpj : null,
      contato: data.contato || null,
      gestor: data.gestor || null,
      area: data.area || null,
      status_classe: data.status_classe,
      valor_em_aberto: data.valor_em_aberto,
      data_vencimento: data.data_vencimento,
    })
    if (error) {
      setSubmitError(error.message)
      toast.error('Erro ao salvar cliente')
      return
    }
    setForm(initialForm)
    toast.success('Cliente salvo')
    onClose()
    onSuccess()
  }

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14)
    setForm((f) => ({ ...f, cnpj: raw }))
  }

  return (
    <ModalBase open={open} onClose={onClose} title="Novo Cliente Inadimplente">
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}
        <div className="space-y-2">
          <Label>Razão Social *</Label>
          <Input
            value={form.razao_social}
            onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
          />
          {errors.razao_social && (
            <p className="text-xs text-red-600">{errors.razao_social}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>CNPJ</Label>
          <Input
            value={form.cnpj ? formatCnpj(form.cnpj) : ''}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="space-y-2">
          <Label>Contato</Label>
          <Input
            value={form.contato}
            onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Gestor</Label>
          <TeamMemberSelect
            value={form.gestor}
            onChange={(email) => setForm((f) => ({ ...f, gestor: email }))}
            teamMembers={teamMembers}
            placeholder="Selecione"
          />
        </div>
        <div className="space-y-2">
          <Label>Área</Label>
          <select
            value={form.area}
            onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
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
            value={form.status_classe}
            onChange={(e) => setForm((f) => ({ ...f, status_classe: e.target.value as InadimplenciaClasse }))}
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
          <Label>Valor em aberto *</Label>
          <Input
            type="number"
            step={0.01}
            min={0}
            value={form.valor_em_aberto}
            onChange={(e) => setForm((f) => ({ ...f, valor_em_aberto: e.target.value }))}
          />
          {errors.valor_em_aberto && (
            <p className="text-xs text-red-600">{errors.valor_em_aberto}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Data de vencimento *</Label>
          <Input
            type="date"
            value={form.data_vencimento}
            onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
          />
          {errors.data_vencimento && (
            <p className="text-xs text-red-600">{errors.data_vencimento}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createCliente.isPending}>
            {createCliente.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
