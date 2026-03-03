import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/shared/utils/format'
import { TeamMemberMultiSelect } from '@/shared/components/TeamMemberMultiSelect'
import { ModalBase } from './ModalBase'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { clienteInadimplenciaFormSchema } from '../types/inadimplencia.types'
import { useInadimplenciaMutations } from '../hooks/useInadimplenciaMutations'
import { inadimplenciaService } from '../services/inadimplenciaService'
import { useAuth } from '@/lib/AuthContext'
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
import { Search, ChevronDown, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

const MAX_GRUPOS_DROPDOWN = 50

interface GrupoInfo {
  nome: string
  pessoas: ClienteEscritorioRow[]
  totalEmpresas: number
  valorEmAtraso: number
  pessoaIdPrincipal: string | null
}

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

interface FormState {
  grupo: string
  pessoaIdPrincipal: string | null
  gestores: string[]
  areas: string[]
  status_classe: InadimplenciaClasse
  valorEmAtraso: number
  observacoes_gerais: string
}

const initialForm: FormState = {
  grupo: '',
  pessoaIdPrincipal: null,
  gestores: [],
  areas: [],
  status_classe: 'A',
  valorEmAtraso: 0,
  observacoes_gerais: '',
}

export function ModalCadastro({ open, onClose, onSuccess }: ModalCadastroProps) {
  const { fullName } = useAuth()
  const { createCliente, reabrirCliente } = useInadimplenciaMutations()
  const { teamMembers } = useTeamMembers()
  const areas = useMemo(() => getAreasFromTeam(teamMembers), [teamMembers])
  const [form, setForm] = useState<FormState>(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [grupoSearch, setGrupoSearch] = useState('')
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false)
  const [areasDropdownOpen, setAreasDropdownOpen] = useState(false)
  const grupoListRef = useRef<HTMLDivElement>(null)
  const areasRef = useRef<HTMLDivElement>(null)

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

  const grupos: GrupoInfo[] = useMemo(() => {
    const map = new Map<string, ClienteEscritorioRow[]>()
    for (const c of clientes) {
      const grupo = (c.grupo_cliente ?? '').trim() || GRUPO_SEM_NOME
      if (!map.has(grupo)) map.set(grupo, [])
      map.get(grupo)!.push(c)
    }
    return Array.from(map.entries())
      .map(([nome, pessoas]) => {
        const valorEmAtraso = pessoas.reduce((sum, p) => {
          const resumo = financeiroResumo?.get(p.id)
          return sum + (resumo?.valorEmAtraso ?? 0)
        }, 0)
        return {
          nome,
          pessoas,
          totalEmpresas: pessoas.length,
          valorEmAtraso,
          pessoaIdPrincipal: pessoas[0]?.id ?? null,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [clientes, financeiroResumo])

  const { filteredGrupos, totalFiltrado, excedeuLimite } = useMemo(() => {
    const b = grupoSearch.trim().toLowerCase()
    let lista: GrupoInfo[]
    if (!b) {
      lista = grupos.slice(0, MAX_GRUPOS_DROPDOWN)
      return { filteredGrupos: lista, totalFiltrado: grupos.length, excedeuLimite: grupos.length > MAX_GRUPOS_DROPDOWN }
    }
    const buscaNorm = normalizarNomeGrupo(b)
    const filtrado = grupos.filter((g) => {
      const grupoNorm = normalizarNomeGrupo(g.nome)
      return grupoNorm.includes(buscaNorm) || buscaNorm.includes(grupoNorm)
    })
    const total = filtrado.length
    lista = filtrado.slice(0, MAX_GRUPOS_DROPDOWN)
    return { filteredGrupos: lista, totalFiltrado: total, excedeuLimite: total > MAX_GRUPOS_DROPDOWN }
  }, [grupos, grupoSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (grupoListRef.current && !grupoListRef.current.contains(e.target as Node)) {
        setGrupoDropdownOpen(false)
      }
    }
    if (grupoDropdownOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [grupoDropdownOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (areasRef.current && !areasRef.current.contains(e.target as Node)) {
        setAreasDropdownOpen(false)
      }
    }
    if (areasDropdownOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [areasDropdownOpen])

  const handleSelectGrupo = (g: GrupoInfo) => {
    setForm((f) => ({
      ...f,
      grupo: g.nome,
      pessoaIdPrincipal: g.pessoaIdPrincipal,
      valorEmAtraso: g.valorEmAtraso,
    }))
    setGrupoSearch('')
    setGrupoDropdownOpen(false)
  }

  const handleClearGrupo = () => {
    setForm((f) => ({ ...f, grupo: '', pessoaIdPrincipal: null, valorEmAtraso: 0 }))
    setGrupoSearch('')
  }

  const toggleArea = (area: string) => {
    setForm((f) => {
      const current = f.areas
      if (current.includes(area)) {
        return { ...f, areas: current.filter((a) => a !== area) }
      }
      return { ...f, areas: [...current, area] }
    })
  }

  const removeArea = (area: string) => {
    setForm((f) => ({ ...f, areas: f.areas.filter((a) => a !== area) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setErrors({})

    const parsed = clienteInadimplenciaFormSchema.safeParse({
      razao_social: form.grupo,
      gestores: form.gestores.length > 0 ? form.gestores : undefined,
      areas: form.areas.length > 0 ? form.areas : undefined,
      status_classe: form.status_classe,
      valor_em_aberto: form.valorEmAtraso,
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

    const existenteResolvido = await inadimplenciaService.findResolvidoByGrupo(data.razao_social)

    if (existenteResolvido) {
      const updateFields: Record<string, unknown> = {}
      if (data.gestores && data.gestores.length > 0) updateFields.gestor = data.gestores
      if (data.areas && data.areas.length > 0) updateFields.area = data.areas
      updateFields.status_classe = data.status_classe
      updateFields.valor_em_aberto = data.valor_em_aberto
      if (data.observacoes_gerais?.trim()) updateFields.observacoes_gerais = data.observacoes_gerais.trim()

      if (Object.keys(updateFields).length > 0) {
        await inadimplenciaService.update(existenteResolvido.id, updateFields)
      }

      const result = await reabrirCliente.mutateAsync({ id: existenteResolvido.id, createdBy: fullName })
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const errMsg = typeof result.error === 'object' && result.error !== null && 'message' in result.error ? (result.error as { message: string }).message : 'Erro ao reabrir'
        setSubmitError(errMsg)
        toast.error('Erro ao reabrir inadimplente')
        return
      }
      setForm(initialForm)
      toast.success('Inadimplente reaberto no comitê (histórico mantido)')
      onClose()
      onSuccess()
      return
    }

    const { error } = await createCliente.mutateAsync({
      razao_social: data.razao_social,
      cnpj: null,
      pessoa_id: form.pessoaIdPrincipal,
      gestor: data.gestores && data.gestores.length > 0 ? data.gestores : null,
      area: data.areas && data.areas.length > 0 ? data.areas : null,
      status_classe: data.status_classe,
      valor_em_aberto: data.valor_em_aberto,
      observacoes_gerais: data.observacoes_gerais?.trim() || null,
    })
    if (error) {
      setSubmitError(error.message)
      toast.error('Erro ao incluir inadimplente')
      return
    }
    setForm(initialForm)
    toast.success('Inadimplente incluído no comitê')
    onClose()
    onSuccess()
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="Incluir Inadimplente no Comitê"
      description="Busque o grupo do cliente para incluí-lo no comitê de inadimplência."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        {/* Seletor de GRUPO */}
        <div className="space-y-2" ref={grupoListRef}>
          <Label>Grupo *</Label>
          {form.grupo ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{form.grupo}</p>
                <p className="text-xs text-slate-500">
                  {grupos.find((g) => g.nome === form.grupo)?.totalEmpresas ?? 0} empresa(s)
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearGrupo}
                className="h-8 w-8 shrink-0 p-0"
                aria-label="Trocar grupo"
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
                  value={grupoSearch}
                  onChange={(e) => {
                    setGrupoSearch(e.target.value)
                    setGrupoDropdownOpen(true)
                  }}
                  onFocus={() => setGrupoDropdownOpen(true)}
                  placeholder="Buscar por nome do grupo..."
                  className="pl-9 pr-9"
                />
                <ChevronDown
                  className={cn(
                    'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform',
                    grupoDropdownOpen && 'rotate-180'
                  )}
                />
              </div>
              {grupoDropdownOpen && (
                <div
                  className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {loadingClientes ? (
                    <div className="p-4 text-center text-sm text-slate-500">Carregando grupos...</div>
                  ) : filteredGrupos.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      Nenhum grupo encontrado.
                    </div>
                  ) : (
                    <>
                      <ul className="py-1 list-none">
                        {filteredGrupos.map((g) => (
                          <li key={g.nome}>
                            <button
                              type="button"
                              onClick={() => handleSelectGrupo(g)}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <span className="font-medium text-slate-900">{g.nome}</span>
                                <span className="ml-2 text-xs text-slate-500">
                                  {g.totalEmpresas} empresa{g.totalEmpresas !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {g.valorEmAtraso > 0 && (
                                <span className="shrink-0 text-xs font-medium text-red-600">
                                  {formatCurrency(g.valorEmAtraso)}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {excedeuLimite && (
                        <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          Mostrando até {MAX_GRUPOS_DROPDOWN} de {totalFiltrado}. Digite para refinar a busca.
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

        {/* Multi-select de Gestores */}
        <div className="space-y-2">
          <Label>Gestores</Label>
          <TeamMemberMultiSelect
            value={form.gestores}
            onChange={(emails) => setForm((f) => ({ ...f, gestores: emails }))}
            teamMembers={teamMembers}
            placeholder="Selecione os gestores responsáveis"
          />
        </div>

        {/* Multi-select de Áreas */}
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
            {form.areas.length > 0 ? (
              form.areas.map((a) => (
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
                const isSelected = form.areas.includes(a)
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

        {/* Classificação (Grau) - single select */}
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

        {/* Valor em atraso - somente leitura */}
        <div className="space-y-2">
          <Label>Valor em atraso (R$)</Label>
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className={cn(
              'text-sm font-medium',
              form.valorEmAtraso > 0 ? 'text-red-600' : 'text-slate-400'
            )}>
              {form.grupo ? formatCurrency(form.valorEmAtraso) : '--'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Calculado automaticamente a partir das parcelas em atraso do grupo selecionado.
          </p>
        </div>

        {/* Observações */}
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

        {/* Botões */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createCliente.isPending}>
            {createCliente.isPending ? 'Salvando...' : 'Incluir'}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
