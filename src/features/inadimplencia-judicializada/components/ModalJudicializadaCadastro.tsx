import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, ChevronDown, X, Check } from 'lucide-react'
import { ModalBase } from '@/features/inadimplencia/components/ModalBase'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/AuthContext'
import { formatCurrency, formatCurrencyInput, parseCurrencyBr } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  fetchGruposResumo,
  GRUPO_SEM_NOME,
  normalizarNomeGrupo,
  type GrupoResumoRow,
} from '@/features/escritorio/services/escritorioService'
import {
  useJudicializadaMutations,
  useProcessosDoGrupo,
  useValorAutoGrupo,
} from '../hooks/useJudicializada'
import { judicializadaService } from '../services/judicializadaService'
import type { ProcessoViosRow } from '../types/judicializada.types'

const inputSelectClass =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

const MAX_GRUPOS_DROPDOWN = 50

interface GrupoInfo {
  nome: string
  totalEmpresas: number
  valorEmAtraso: number
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Pré-preenche a busca de grupo (ex.: termo digitado na página). */
  initialGrupoSearch?: string
}

export function ModalJudicializadaCadastro({
  open,
  onClose,
  onSuccess,
  initialGrupoSearch = '',
}: Props) {
  const { fullName, role } = useAuth()
  const { create } = useJudicializadaMutations()
  const canEdit = role === 'admin' || role === 'financeiro'

  const [grupo, setGrupo] = useState('')
  const [grupoSearch, setGrupoSearch] = useState('')
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false)
  const [processoId, setProcessoId] = useState('')
  const [processoSearch, setProcessoSearch] = useState('')
  const [processoDropdownOpen, setProcessoDropdownOpen] = useState(false)
  const [dataJudicializacao, setDataJudicializacao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [valorAjuste, setValorAjuste] = useState('')
  const [cnjBusca, setCnjBusca] = useState('')
  const [cnjLoading, setCnjLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const grupoListRef = useRef<HTMLDivElement>(null)
  const processoListRef = useRef<HTMLDivElement>(null)

  const { data: gruposResumo = [], isLoading: loadingGrupos } = useQuery({
    queryKey: ['escritorio-grupos-resumo'],
    queryFn: fetchGruposResumo,
    enabled: open,
    staleTime: 60_000,
  })

  const grupos: GrupoInfo[] = useMemo(() => {
    return gruposResumo
      .map((r: GrupoResumoRow) => ({
        nome: r.grupo_cliente.trim() || GRUPO_SEM_NOME,
        totalEmpresas: r.total_empresas,
        valorEmAtraso: r.valor_em_atraso_ativos || r.valor_em_atraso,
      }))
      .filter((g: GrupoInfo) => g.nome !== GRUPO_SEM_NOME)
      .sort((a: GrupoInfo, b: GrupoInfo) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [gruposResumo])

  const { filteredGrupos, totalFiltrado, excedeuLimite } = useMemo(() => {
    const b = grupoSearch.trim().toLowerCase()
    if (!b) {
      const lista = grupos.slice(0, MAX_GRUPOS_DROPDOWN)
      return {
        filteredGrupos: lista,
        totalFiltrado: grupos.length,
        excedeuLimite: grupos.length > MAX_GRUPOS_DROPDOWN,
      }
    }
    const buscaNorm = normalizarNomeGrupo(b)
    const filtrado = grupos.filter((g) => {
      const grupoNorm = normalizarNomeGrupo(g.nome)
      return grupoNorm.includes(buscaNorm) || buscaNorm.includes(grupoNorm)
    })
    const total = filtrado.length
    const lista = filtrado.slice(0, MAX_GRUPOS_DROPDOWN)
    return { filteredGrupos: lista, totalFiltrado: total, excedeuLimite: total > MAX_GRUPOS_DROPDOWN }
  }, [grupos, grupoSearch])

  const { data: processos = [], isLoading: loadingProcessos } = useProcessosDoGrupo(
    grupo,
    processoSearch,
    open && Boolean(grupo),
  )

  const { data: valorAuto = 0, isLoading: loadingValorAuto } = useValorAutoGrupo(
    grupo,
    open && Boolean(grupo),
  )

  const processoSelecionado = useMemo(
    () => processos.find((p: ProcessoViosRow) => p.id === processoId) ?? null,
    [processos, processoId],
  )

  useEffect(() => {
    if (!open) {
      setGrupo('')
      setGrupoSearch('')
      setGrupoDropdownOpen(false)
      setProcessoId('')
      setProcessoSearch('')
      setProcessoDropdownOpen(false)
      setDataJudicializacao('')
      setObservacoes('')
      setValorAjuste('')
      setCnjBusca('')
      return
    }
    if (initialGrupoSearch.trim()) {
      setGrupoSearch(initialGrupoSearch.trim())
      setGrupoDropdownOpen(true)
    }
  }, [open, initialGrupoSearch])

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
      if (processoListRef.current && !processoListRef.current.contains(e.target as Node)) {
        setProcessoDropdownOpen(false)
      }
    }
    if (processoDropdownOpen) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [processoDropdownOpen])

  const handleSelectGrupo = (g: GrupoInfo) => {
    setGrupo(g.nome)
    setGrupoSearch('')
    setGrupoDropdownOpen(false)
    setProcessoId('')
    setProcessoSearch('')
  }

  const handleClearGrupo = () => {
    setGrupo('')
    setProcessoId('')
    setProcessoSearch('')
    setGrupoDropdownOpen(true)
  }

  const handleSelectProcesso = (p: ProcessoViosRow) => {
    setProcessoId(p.id)
    setProcessoSearch('')
    setProcessoDropdownOpen(false)
  }

  const handleLookupCnj = async () => {
    const cnj = cnjBusca.trim()
    if (!cnj) {
      toast.error('Informe o CNJ do processo.')
      return
    }
    setCnjLoading(true)
    try {
      const processosCnj = await judicializadaService.lookupProcessosPorCnj(cnj)
      if (processosCnj.length === 0) {
        toast.error('CNJ não encontrado na base VIOS.')
        return
      }
      const processo = processosCnj[0]
      setProcessoId(processo.id)
      setProcessoSearch('')
      const grupoSugerido = await judicializadaService.resolveGrupoFromPartePassiva(null, processo)
      if (grupoSugerido) {
        setGrupo(grupoSugerido)
        setGrupoSearch('')
      }
      if (processosCnj.length > 1) {
        toast.message(`${processosCnj.length} processos com este CNJ — selecionado o primeiro.`)
      } else {
        toast.success('Processo VIOS encontrado.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar CNJ.')
    } finally {
      setCnjLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      toast.error('Sem permissão para incluir casos judicializados.')
      return
    }
    if (!grupo.trim()) {
      toast.error('Selecione um grupo.')
      return
    }
    if (!processoId) {
      toast.error('Selecione um processo VIOS.')
      return
    }

    const ajusteParsed =
      valorAjuste.trim() === '' ? null : parseCurrencyBr(valorAjuste)

    if (valorAjuste.trim() !== '' && ajusteParsed != null && ajusteParsed < 0) {
      toast.error('Valor de ajuste inválido.')
      return
    }

    setSubmitting(true)
    try {
      await create.mutateAsync({
        grupo_cliente: grupo,
        processo_id: processoId,
        data_judicializacao: dataJudicializacao || null,
        observacoes: observacoes.trim() || null,
        valor_em_aberto_ajuste: ajusteParsed,
        created_by: fullName ?? null,
      })
      toast.success('Caso judicializado incluído.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao incluir caso.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalBase
      open={open}
      onClose={onClose}
      title="Incluir caso judicializado"
      description="Vincule um grupo de cliente ao processo VIOS correspondente."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
          <Label htmlFor="cnj-busca">Buscar processo por CNJ (VIOS)</Label>
          <div className="flex gap-2">
            <Input
              id="cnj-busca"
              value={cnjBusca}
              onChange={(e) => setCnjBusca(e.target.value)}
              placeholder="Ex.: 0000000-00.0000.0.00.0000"
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleLookupCnj}
              disabled={cnjLoading}
            >
              {cnjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            Localiza o processo no VIOS e sugere o grupo devedor. Depois confirme ou ajuste o vínculo
            abaixo.
          </p>
        </div>

        <div className="space-y-2" ref={grupoListRef}>
          <Label>Grupo do cliente</Label>
          {grupo ? (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="font-medium text-slate-900">{grupo}</p>
                {loadingValorAuto ? (
                  <p className="text-xs text-slate-500">Calculando saldo…</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Saldo em atraso (auto): {formatCurrency(valorAuto)}
                  </p>
                )}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={handleClearGrupo}>
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
                  placeholder="Buscar por nome do grupo…"
                  className="pl-9 pr-9"
                  disabled={loadingGrupos}
                />
                <ChevronDown
                  className={cn(
                    'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform',
                    grupoDropdownOpen && 'rotate-180',
                  )}
                />
              </div>
              {grupoDropdownOpen && (
                <div
                  className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {loadingGrupos ? (
                    <p className="p-4 text-center text-sm text-slate-500">Carregando grupos…</p>
                  ) : filteredGrupos.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-500">Nenhum grupo encontrado.</p>
                  ) : (
                    <>
                      <ul className="list-none py-1">
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
                          Mostrando até {MAX_GRUPOS_DROPDOWN} de {totalFiltrado}. Digite para refinar.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {grupo && (
          <div className="space-y-2" ref={processoListRef}>
            <Label>Processo VIOS</Label>
            {processoSelecionado ? (
              <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-slate-900">
                    {processoSelecionado.nro_cnj || processoSelecionado.ci || 'Sem CNJ'}
                  </p>
                  <p className="truncate text-xs text-slate-600">{processoSelecionado.acao || '—'}</p>
                  <p className="text-xs text-slate-500">
                    {[processoSelecionado.area, processoSelecionado.situacao_processo]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setProcessoId('')}
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
                    value={processoSearch}
                    onChange={(e) => {
                      setProcessoSearch(e.target.value)
                      setProcessoDropdownOpen(true)
                    }}
                    onFocus={() => setProcessoDropdownOpen(true)}
                    placeholder="Buscar por CNJ, ação ou área…"
                    className="pl-9"
                  />
                </div>
                {processoDropdownOpen && (
                  <div
                    className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {loadingProcessos ? (
                      <p className="p-4 text-center text-sm text-slate-500">Carregando processos…</p>
                    ) : processos.length === 0 ? (
                      <p className="p-4 text-center text-sm text-slate-500">
                        Nenhum processo encontrado para este grupo.
                      </p>
                    ) : (
                      <ul className="list-none py-1">
                        {processos.map((p: ProcessoViosRow) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col px-3 py-2.5 text-left hover:bg-slate-50"
                              onClick={() => handleSelectProcesso(p)}
                            >
                              <span className="font-mono text-sm font-medium text-slate-800">
                                {p.nro_cnj || p.ci || 'Sem CNJ'}
                              </span>
                              <span className="truncate text-xs text-slate-600">{p.acao || '—'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="valor-auto">Valor automático</Label>
            <Input
              id="valor-auto"
              readOnly
              value={grupo ? (loadingValorAuto ? '…' : formatCurrency(valorAuto)) : '—'}
              className="bg-slate-50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor-ajuste">Ajuste manual (opcional)</Label>
            <Input
              id="valor-ajuste"
              inputMode="decimal"
              value={valorAjuste}
              onChange={(e) => setValorAjuste(formatCurrencyInput(e.target.value))}
              placeholder="Ex.: 15.000,00"
              disabled={!canEdit || !grupo}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="data-jud">Data de judicialização</Label>
          <Input
            id="data-jud"
            type="date"
            value={dataJudicializacao}
            onChange={(e) => setDataJudicializacao(e.target.value)}
            className={inputSelectClass}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs">Observações</Label>
          <Textarea
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            disabled={!canEdit}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !canEdit}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Incluir
              </>
            )}
          </Button>
        </div>
      </form>
    </ModalBase>
  )
}
