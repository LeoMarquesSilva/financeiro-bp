import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCnpj, formatCurrency, formatCurrencyInput, parseCurrencyBr } from '@/shared/utils/format'
import { TeamMemberSelect } from '@/shared/components/TeamMemberSelect'
import { ModalBase } from './ModalBase'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { clienteInadimplenciaFormSchema } from '../types/inadimplencia.types'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { useTeamMembers } from '../hooks/useTeamMembers'
import type { InadimplenciaClasse } from '@/lib/database.types'
import type { ClienteEscritorioRow } from '@/lib/database.types'
import {
  fetchClientesEscritorio,
  fetchRelatorioFinanceiroResumoPorCliente,
  GRUPO_SEM_NOME,
  normalizarNomeGrupo,
} from '@/features/escritorio/services/escritorioService'
import { toast } from 'sonner'
import { CLASSES, CLASS_LABELS } from '@/shared/constants/inadimplencia'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

/** Máximo de clientes exibidos no dropdown para não travar (sem virtualização). */
const MAX_CLIENTES_DROPDOWN = 50

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
  observacoes_gerais: '',
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

  const { data: financeiroResumo } = useQuery({
    queryKey: ['relatorio-financeiro-resumo-por-cliente'],
    queryFn: fetchRelatorioFinanceiroResumoPorCliente,
    enabled: open,
  })

  const selectedCliente: ClienteEscritorioRow | null = useMemo(() => {
    if (!form.razao_social) return null
    return clientes.find(
      (c: ClienteEscritorioRow) =>
        (c.nome ?? '') === form.razao_social &&
        (c.cpf_cnpj ?? '') === (form.cnpj ?? '')
    ) ?? null
  }, [clientes, form.razao_social, form.cnpj])

  /** Mesma lógica da página Escritório: busca por grupo, nome (razão social) ou CNPJ. Limitado para não travar o dropdown. */
  const { filteredClientes, totalFiltrado, excedeuLimite } = useMemo(() => {
    const b = clienteSearch.trim().toLowerCase()
    let lista: ClienteEscritorioRow[]
    if (!b) {
      lista = clientes.slice(0, MAX_CLIENTES_DROPDOWN)
      return {
        filteredClientes: lista,
        totalFiltrado: clientes.length,
        excedeuLimite: clientes.length > MAX_CLIENTES_DROPDOWN,
      }
    }
    const filtrado = clientes.filter((c: ClienteEscritorioRow) => {
      const nomeGrupo = (c.grupo_cliente ?? '').trim() || GRUPO_SEM_NOME
      const grupoNorm = normalizarNomeGrupo(nomeGrupo)
      const buscaNorm = normalizarNomeGrupo(b)
      const matchGrupo = grupoNorm.includes(buscaNorm) || buscaNorm.includes(grupoNorm)
      const matchNome = (c.nome ?? '').toLowerCase().includes(b)
      const cnpjDigits = (c.cpf_cnpj ?? '').replace(/\D/g, '')
      const buscaDigits = b.replace(/\D/g, '')
      const matchCnpj = buscaDigits.length >= 2 && cnpjDigits.includes(buscaDigits)
      return matchGrupo || matchNome || matchCnpj
    })
    const total = filtrado.length
    lista = filtrado.slice(0, MAX_CLIENTES_DROPDOWN)
    return {
      filteredClientes: lista,
      totalFiltrado: total,
      excedeuLimite: total > MAX_CLIENTES_DROPDOWN,
    }
  }, [clientes, clienteSearch])

  /** Agrupa clientes (já limitados) por grupo (A–Z); dentro de cada grupo, clientes ordenados A–Z por nome. */
  const clientesPorGrupo = useMemo(() => {
    const map = new Map<string, ClienteEscritorioRow[]>()
    for (const c of filteredClientes) {
      const grupo = (c.grupo_cliente ?? '').trim() || GRUPO_SEM_NOME
      if (!map.has(grupo)) map.set(grupo, [])
      map.get(grupo)!.push(c)
    }
    const grupos = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return grupos.map((grupo) => {
      const lista = (map.get(grupo) ?? []).sort((a, b) =>
        (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
      )
      return { grupo, clientes: lista }
    })
  }, [filteredClientes])

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
    const resumo = financeiroResumo?.get(c.id)
    const valorEmAtraso = resumo?.valorEmAtraso ?? 0
    const valorAbertoStr =
      valorEmAtraso > 0
        ? formatCurrencyInput(String(Math.round(valorEmAtraso * 100)))
        : ''
    setForm((f) => ({
      ...f,
      razao_social: c.nome ?? '',
      cnpj: c.cpf_cnpj ?? '',
      valor_em_aberto: valorAbertoStr,
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
      observacoes_gerais: form.observacoes_gerais || undefined,
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
      pessoa_id: selectedCliente?.id ?? null,
      gestor: data.gestor || null,
      area: data.area || null,
      status_classe: data.status_classe,
      valor_em_aberto: data.valor_em_aberto,
      observacoes_gerais: data.observacoes_gerais?.trim() || null,
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
    <ModalBase
      open={open}
      onClose={onClose}
      title="Registrar inadimplência"
      description="Formulário para registrar um novo cliente inadimplente. Busque o cliente por nome, grupo ou CNPJ."
    >
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
                <p className="font-medium text-slate-900">{selectedCliente.nome}</p>
                <p className="text-xs text-slate-500">
                  {selectedCliente.grupo_cliente && `${selectedCliente.grupo_cliente} · `}
                  {selectedCliente.cpf_cnpj ? formatCnpj(selectedCliente.cpf_cnpj) : 'Sem CNPJ'}
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
                  type="search"
                  autoComplete="off"
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value)
                    setClienteDropdownOpen(true)
                  }}
                  onFocus={() => setClienteDropdownOpen(true)}
                  placeholder="Buscar por grupo, razão social ou CNPJ..."
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
                <div
                  className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {loadingClientes ? (
                    <div className="p-4 text-center text-sm text-slate-500">Carregando clientes...</div>
                  ) : filteredClientes.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Nenhum cliente encontrado. Verifique a base em Escritório.
                    </div>
                  ) : (
                    <>
                      <ul className="py-1 list-none">
                        {clientesPorGrupo.map(({ grupo, clientes: lista }) => (
                          <li key={grupo} className="py-0">
                            <div className="sticky top-0 z-10 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                              {grupo}
                            </div>
                            <ul className="py-0 list-none">
                              {lista.map((c: ClienteEscritorioRow) => {
                                const emAtraso = financeiroResumo?.get(c.id)?.valorEmAtraso ?? 0
                                return (
                                  <li key={c.id}>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectCliente(c)}
                                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-slate-50"
                                    >
                                      <span className="font-medium text-slate-900">{c.nome}</span>
                                      <span className="text-xs text-slate-500">
                                        {c.cpf_cnpj ? formatCnpj(c.cpf_cnpj) : 'Sem CNPJ'}
                                        {emAtraso > 0 && (
                                          <span className="ml-1.5 font-medium text-red-600">
                                            · {formatCurrency(emAtraso)} em atraso
                                          </span>
                                        )}
                                      </span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          </li>
                        ))}
                      </ul>
                      {excedeuLimite && (
                        <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          Mostrando até {MAX_CLIENTES_DROPDOWN} de {totalFiltrado}. Digite para refinar a busca.
                        </p>
                      )}
                    </>
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
          <Label>Valor em atraso (R$) *</Label>
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
          <p className="text-xs text-slate-500">
            Valor das parcelas vencidas. Ao selecionar o cliente, é preenchido com o valor em atraso do relatório financeiro. Usado no cálculo de prioridade e KPIs.
          </p>
          {errors.valor_em_aberto && (
            <p className="text-xs text-red-600">{errors.valor_em_aberto}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="obs-gerais">Observações</Label>
          <Textarea
            id="obs-gerais"
            placeholder="Observações gerais sobre o cliente ou a inadimplência..."
            value={form.observacoes_gerais}
            onChange={(e) => setForm((f) => ({ ...f, observacoes_gerais: e.target.value }))}
            rows={3}
            className="resize-none"
          />
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
