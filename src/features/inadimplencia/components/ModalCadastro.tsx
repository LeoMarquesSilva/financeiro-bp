import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCnpj, formatCurrencyInput, parseCurrencyBr } from '@/shared/utils/format'
import { TeamMemberSelect } from '@/shared/components/TeamMemberSelect'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { clienteInadimplenciaFormSchema } from '../types/inadimplencia.types'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { useTeamMembers } from '../hooks/useTeamMembers'
import type { InadimplenciaClasse } from '@/lib/database.types'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import { fetchClientesEscritorio } from '@/features/escritorio/services/escritorioService'
import { toast } from 'sonner'
import { CLASSES, CLASS_LABELS } from '@/shared/constants/inadimplencia'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  gestor: '',
  area: '',
  status_classe: 'A' as InadimplenciaClasse,
  valor_em_aberto: '',
}

export function ModalCadastro({ open, onClose, onSuccess }: ModalCadastroProps) {
  const { createCliente } = useInadimplenciaMutations()
  const { teamMembers } = useTeamMembers()
  const areas = useMemo(() => getAreasFromTeam(teamMembers), [teamMembers])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false)
  const clienteListRef = useRef<HTMLDivElement>(null)

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes-escritorio'],
    queryFn: fetchClientesEscritorio,
    enabled: open,
  })

  const selectedCliente: ClienteEscritorioRow | null = useMemo(() => {
    if (!form.razao_social) return null
    return clientes.find(
      (c) =>
        c.razao_social === form.razao_social &&
        (c.cnpj ?? '') === (form.cnpj ?? '')
    ) ?? null
  }, [clientes, form.razao_social, form.cnpj])

  const filteredClientes = useMemo(() => {
    const q = clienteSearch.trim().toLowerCase()
    if (!q) return clientes.slice(0, 50)
    return clientes
      .filter(
        (c) =>
          c.razao_social.toLowerCase().includes(q) ||
          (c.grupo_cliente?.toLowerCase().includes(q)) ||
          (c.cnpj?.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
      )
      .slice(0, 50)
  }, [clientes, clienteSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clienteListRef.current && !clienteListRef.current.contains(e.target as Node)) {
        setClienteDropdownOpen(false)
      }
    }
    if (clienteDropdownOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [clienteDropdownOpen])

  const handleSelectCliente = (c: ClienteEscritorioRow) => {
    setForm((f) => ({
      ...f,
      razao_social: c.razao_social,
      cnpj: c.cnpj ?? '',
    }))
    setClienteSearch('')
    setClienteDropdownOpen(false)
  }

  const handleClearCliente = () => {
    setForm((f) => ({ ...f, razao_social: '', cnpj: '' }))
    setClienteSearch('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setErrors({})
    const valorNumerico = parseCurrencyBr(form.valor_em_aberto)
    const parsed = clienteInadimplenciaFormSchema.safeParse({
      ...form,
      valor_em_aberto: valorNumerico,
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
      cliente_escritorio_id: selectedCliente?.id ?? null,
      gestor: data.gestor || null,
      area: data.area || null,
      status_classe: data.status_classe,
      valor_em_aberto: data.valor_em_aberto,
    })
    if (error) {
      setSubmitError(error.message)
      toast.error('Erro ao registrar inadimplência')
      return
    }
    setForm(initialForm)
    toast.success('Inadimplência registrada')
    onClose()
    onSuccess()
  }

  return (
    <ModalBase open={open} onClose={onClose} title="Registrar inadimplência">
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        {/* Seletor de cliente (base escritório) */}
        <div className="space-y-2" ref={clienteListRef}>
          <Label>Cliente *</Label>
          {selectedCliente ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{selectedCliente.razao_social}</p>
                <p className="text-xs text-slate-500">
                  {selectedCliente.grupo_cliente && `${selectedCliente.grupo_cliente} · `}
                  {selectedCliente.cnpj ? formatCnpj(selectedCliente.cnpj) : 'Sem CNPJ'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearCliente}
                className="h-8 w-8 shrink-0 p-0"
                aria-label="Trocar cliente"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value)
                    setClienteDropdownOpen(true)
                  }}
                  onFocus={() => setClienteDropdownOpen(true)}
                  placeholder="Buscar por razão social, grupo ou CNPJ..."
                  className="pl-9 pr-9"
                />
                <ChevronDown
                  className={cn(
                    'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform',
                    clienteDropdownOpen && 'rotate-180'
                  )}
                />
              </div>
              {clienteDropdownOpen && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {loadingClientes ? (
                    <div className="p-4 text-center text-sm text-slate-500">Carregando clientes...</div>
                  ) : filteredClientes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Nenhum cliente encontrado. Verifique a base em Escritório.
                    </div>
                  ) : (
                    <ul className="py-1">
                      {filteredClientes.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectCliente(c)}
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-900">{c.razao_social}</span>
                            <span className="text-xs text-slate-500">
                              {c.grupo_cliente && `${c.grupo_cliente} · `}
                              {c.cnpj ? formatCnpj(c.cnpj) : 'Sem CNPJ'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
          {errors.razao_social && (
            <p className="text-xs text-red-600">{errors.razao_social}</p>
          )}
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
          <Label>Valor em aberto (R$) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor_em_aberto}
              onChange={(e) => {
                const formatted = formatCurrencyInput(e.target.value)
                setForm((f) => ({ ...f, valor_em_aberto: formatted }))
              }}
              className="pl-9"
            />
          </div>
          {errors.valor_em_aberto && (
            <p className="text-xs text-red-600">{errors.valor_em_aberto}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createCliente.isPending}>
            {createCliente.isPending ? 'Salvando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
