import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Scale, XCircle, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime, formatCurrencyInput, formatNumberToCurrencyInput, parseCurrencyBr } from '@/shared/utils/format'
import { toast } from 'sonner'
import { useAuth } from '@/lib/AuthContext'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { GrupoDevedorCombobox } from './GrupoDevedorCombobox'
import { ProcessoViosCombobox } from './ProcessoViosCombobox'
import { useJudicializadaMutations, useValorAutoGrupo } from '../hooks/useJudicializada'
import { judicializadaService } from '../services/judicializadaService'
import { normalizarNomeGrupo } from '@/features/escritorio/services/escritorioService'
import type {
  InadimplenciaJudicializadaAndamentoRow,
  InadimplenciaJudicializadaRow,
  ProcessoViosRow,
} from '../types/judicializada.types'

type Props = {
  row: InadimplenciaJudicializadaRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
  /** Rola até a seção de andamentos ao abrir (ex.: clique no botão da tabela). */
  focusAndamentos?: boolean
}

export function JudicializadaDetailSheet({
  row,
  open,
  onOpenChange,
  onUpdated,
  focusAndamentos = false,
}: Props) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const { update, recalcular, encerrar, reabrir } = useJudicializadaMutations()

  const [valorAjuste, setValorAjuste] = useState('')
  const [dataJudicializacao, setDataJudicializacao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [grupoEdit, setGrupoEdit] = useState('')
  const [cnjRelinkLoading, setCnjRelinkLoading] = useState(false)
  const [confirmEncerrar, setConfirmEncerrar] = useState(false)
  const [saving, setSaving] = useState(false)
  const andamentosSectionRef = useRef<HTMLElement>(null)

  const rowId = row?.id
  const grupoVios = (grupoEdit.trim() || row?.grupo_cliente || '').trim()

  const { data: valorViosLive, isLoading: loadingValorVios } = useValorAutoGrupo(
    grupoVios,
    open && !!row && Boolean(grupoVios),
  )
  const valorLancamentoVios = valorViosLive ?? row?.valor_em_aberto_auto ?? 0

  const {
    data: andamentos = [],
    isLoading: loadingAndamentos,
    isError: andamentosErro,
  } = useQuery({
    queryKey: ['inadimplencia', 'judicializada', 'andamentos', rowId],
    queryFn: () => judicializadaService.fetchAndamentosJudicializada(rowId!),
    enabled: open && !!rowId,
  })

  useEffect(() => {
    if (!row) return
    setValorAjuste(
      row.valor_em_aberto_ajuste != null
        ? formatNumberToCurrencyInput(row.valor_em_aberto_ajuste)
        : '',
    )
    setDataJudicializacao(row.data_judicializacao ?? '')
    setObservacoes(row.observacoes ?? '')
    setGrupoEdit(row.grupo_cliente)
  }, [row])

  useEffect(() => {
    if (!open || !focusAndamentos || !row) return
    const timer = window.setTimeout(() => {
      andamentosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [open, focusAndamentos, row])

  const encerrado = Boolean(row?.encerrado_at)
  const resumoPlanilha =
    row?.andamentos_resumo?.trim() &&
    !andamentos.some(
      (a: InadimplenciaJudicializadaAndamentoRow) =>
        a.descricao.trim() === row.andamentos_resumo?.trim(),
    )
      ? row.andamentos_resumo
      : null

  const handleSave = async () => {
    if (!row || !canEdit) {
      toast.error('Sem permissão para editar.')
      return
    }

    const ajusteParsed =
      valorAjuste.trim() === '' ? null : parseCurrencyBr(valorAjuste)

    if (valorAjuste.trim() !== '' && ajusteParsed != null && ajusteParsed < 0) {
      toast.error('Valor de ajuste inválido.')
      return
    }

    setSaving(true)
    try {
      await update.mutateAsync({
        id: row.id,
        input: {
          grupo_cliente:
            grupoEdit.trim() !== row.grupo_cliente ? grupoEdit.trim() : undefined,
          valor_em_aberto_ajuste: ajusteParsed,
          data_judicializacao: dataJudicializacao || null,
          observacoes: observacoes.trim() || null,
        },
      })
      toast.success('Alterações salvas.')
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleRecalcular = async () => {
    if (!row || !canEdit) return
    try {
      await recalcular.mutateAsync(row.id)
      toast.success('Saldo automático recalculado.')
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao recalcular.')
    }
  }

  const handleEncerrar = async () => {
    if (!row || !canEdit) return
    try {
      await encerrar.mutateAsync(row.id)
      toast.success('Caso encerrado.')
      setConfirmEncerrar(false)
      onUpdated()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao encerrar.')
    }
  }

  const handleReabrir = async () => {
    if (!row || !canEdit) return
    try {
      await reabrir.mutateAsync(row.id)
      toast.success('Caso reaberto.')
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reabrir.')
    }
  }

  const handleVincularProcesso = async (processo: ProcessoViosRow) => {
    if (!row || !canEdit) return
    setCnjRelinkLoading(true)
    try {
      await update.mutateAsync({
        id: row.id,
        input: { processo_id: processo.id },
      })
      toast.success('Processo VIOS atualizado.')
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular processo.')
    } finally {
      setCnjRelinkLoading(false)
    }
  }

  const grupoViosDiverge =
    row?.processo_grupo_vios != null &&
    row.processo_grupo_vios.trim() !== '' &&
    normalizarNomeGrupo(row.processo_grupo_vios) !== normalizarNomeGrupo(row.grupo_cliente)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {!row ? (
            <div className="flex flex-1 items-center justify-center py-16 text-sm text-slate-500">
              Carregando caso…
            </div>
          ) : (
            <>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-slate-600" />
              {row.grupo_cliente}
            </SheetTitle>
            <SheetDescription>
              Inadimplência judicializada · processo VIOS vinculado
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {encerrado && (
              <Badge variant="secondary" className="w-fit">
                Encerrado em {formatDateTime(row.encerrado_at!)}
              </Badge>
            )}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-medium uppercase text-slate-400">Ajuizamento</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {row.valor_causa != null && row.valor_causa > 0
                    ? formatCurrency(row.valor_causa)
                    : '—'}
                </p>
                <p className="text-[10px] text-slate-400">Valor da causa</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-medium uppercase text-slate-400">Lançamento VIOS</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {loadingValorVios ? '…' : formatCurrency(valorLancamentoVios)}
                </p>
                <p className="text-[10px] text-slate-400">Títulos em aberto (financeiro)</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-medium uppercase text-slate-400">Corrigido</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(row.valor_em_aberto)}
                </p>
                <p className="text-[10px] text-slate-400">INPC + juros TJSP</p>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vínculo grupo ↔ processo
              </h3>
              <div className="mt-3 space-y-3 text-sm">
                {canEdit && !encerrado ? (
                  <div className="space-y-1">
                    <Label htmlFor="grupo-devedor">Grupo devedor</Label>
                    <GrupoDevedorCombobox
                      id="grupo-devedor"
                      value={grupoEdit}
                      onChange={setGrupoEdit}
                      enabled={open && !!row}
                    />
                  </div>
                ) : (
                  <div>
                    <dt className="text-slate-500">Grupo devedor</dt>
                    <dd className="font-medium text-slate-900">{row.grupo_cliente}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-slate-500">Grupo no processo (VIOS)</dt>
                  <dd>{row.processo_grupo_vios || '—'}</dd>
                </div>
                {grupoViosDiverge && (
                  <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    O grupo do processo no VIOS difere do grupo devedor vinculado — comum em ações
                    de cobrança.
                  </p>
                )}
                {canEdit && !encerrado && (
                  <div className="space-y-1">
                    <Label htmlFor="cnj-relink">Trocar processo por CNJ</Label>
                    <ProcessoViosCombobox
                      id="cnj-relink"
                      grupoCliente={grupoEdit.trim() || row.grupo_cliente}
                      enabled={open && !!row}
                      loading={cnjRelinkLoading}
                      onSelect={handleVincularProcesso}
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Processo VIOS
              </h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">CNJ</dt>
                  <dd className="font-mono font-medium text-slate-900">{row.nro_cnj || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Ação</dt>
                  <dd className="text-slate-800">{row.acao || '—'}</dd>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-slate-500">Área</dt>
                    <dd>{row.area || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Situação</dt>
                    <dd>{row.situacao_processo || '—'}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-slate-500">Advogado</dt>
                  <dd>{row.advogado_responsavel || '—'}</dd>
                </div>
                {row.fase_processual && (
                  <div>
                    <dt className="text-slate-500">Fase processual</dt>
                    <dd>{row.fase_processual}</dd>
                  </div>
                )}
                {row.parte_passiva && (
                  <div>
                    <dt className="text-slate-500">Parte passiva (planilha)</dt>
                    <dd>{row.parte_passiva}</dd>
                  </div>
                )}
                {row.valor_causa != null && row.valor_causa > 0 && (
                  <div>
                    <dt className="text-slate-500">Valor da causa</dt>
                    <dd>{formatCurrency(row.valor_causa)}</dd>
                  </div>
                )}
                {row.status_planilha && (
                  <div>
                    <dt className="text-slate-500">Status (planilha)</dt>
                    <dd>{row.status_planilha}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section ref={andamentosSectionRef} className="space-y-3 scroll-mt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Andamentos
                </h3>
                {row.andamentos_fonte && (
                  <Badge variant="outline" className="text-[10px]">
                    Fonte: {row.andamentos_fonte}
                    {row.andamentos_sync_em ? ` · VIOS ${formatDateTime(row.andamentos_sync_em)}` : ' · sync VIOS em breve'}
                  </Badge>
                )}
              </div>

              {loadingAndamentos ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando andamentos…
                </div>
              ) : andamentosErro ? (
                <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  Não foi possível carregar os andamentos.
                </p>
              ) : andamentos.length > 0 ? (
                <ul className="space-y-2">
                  {andamentos.map((a: InadimplenciaJudicializadaAndamentoRow) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {a.fonte}
                          </Badge>
                          {a.data_andamento && (
                            <span className="text-[11px] font-medium text-slate-500">
                              {formatDate(a.data_andamento)}
                            </span>
                          )}
                        </div>
                        {a.vios_evento_id && (
                          <span className="font-mono text-[10px] text-slate-400">
                            vios:{a.vios_evento_id}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                        {a.descricao}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : resumoPlanilha ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="mb-1 text-[10px] font-medium uppercase text-slate-400">
                    Resumo (planilha)
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {resumoPlanilha}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  Nenhum andamento registrado. Importe pela planilha ou aguarde a sincronização com o
                  VIOS.
                </p>
              )}

            </section>

            {row.providencias_planilha && (
              <section className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Providências (planilha)
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">
                  {row.providencias_planilha}
                </p>
              </section>
            )}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Valor em aberto
              </h3>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-2xl font-bold text-slate-900">
                  {formatCurrency(row.valor_em_aberto)}
                </p>
                {row.meses_atualizacao > 0 && row.data_judicializacao ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <p>
                      Nominal na judicialização ({formatDate(row.data_judicializacao)}):{' '}
                      <span className="font-medium">{formatCurrency(row.valor_em_aberto_nominal)}</span>
                    </p>
                    <p>
                      Correção INPC ({row.meses_atualizacao} mês(es)):{' '}
                      <span className="font-medium text-emerald-700">
                        +{formatCurrency(row.valor_correcao_inpc)}
                      </span>
                    </p>
                    <p>
                      Juros moratórios TJSP (1% a.m.):{' '}
                      <span className="font-medium text-emerald-700">
                        +{formatCurrency(row.valor_juros_mora)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    {row.data_judicializacao
                      ? 'Sem valor nominal para atualizar.'
                      : 'Informe a data de judicialização para aplicar INPC + TJSP.'}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Automático (VIOS): {formatCurrency(valorLancamentoVios)}
                  {row.valor_em_aberto_ajuste != null && (
                    <> · Ajuste manual: {formatCurrency(row.valor_em_aberto_ajuste)}</>
                  )}
                </p>
                {canEdit && !encerrado && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleRecalcular}
                    disabled={recalcular.isPending}
                  >
                    {recalcular.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Recalcular saldo automático
                  </Button>
                )}
              </div>

              {canEdit && !encerrado && (
                <div className="space-y-2">
                  <Label htmlFor="ajuste-sheet">Ajuste manual (opcional)</Label>
                  <Input
                    id="ajuste-sheet"
                    inputMode="decimal"
                    value={valorAjuste}
                    onChange={(e) => setValorAjuste(formatCurrencyInput(e.target.value))}
                    placeholder="Deixe vazio para usar o valor automático"
                  />
                </div>
              )}
            </section>

            {canEdit && !encerrado && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="data-sheet">Data de judicialização</Label>
                  <Input
                    id="data-sheet"
                    type="date"
                    value={dataJudicializacao}
                    onChange={(e) => setDataJudicializacao(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="obs-sheet">Observações</Label>
                  <Textarea
                    id="obs-sheet"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar alterações
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmEncerrar(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Encerrar caso
                  </Button>
                </div>
              </>
            )}

            {canEdit && encerrado && (
              <Button type="button" variant="outline" onClick={handleReabrir}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reabrir caso
              </Button>
            )}

            <p className="text-xs text-slate-400">
              Incluído em {formatDateTime(row.created_at)}
              {row.created_by ? ` por ${row.created_by}` : ''}
            </p>
          </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ModalConfirmacao
        open={confirmEncerrar}
        onClose={() => setConfirmEncerrar(false)}
        title="Encerrar caso judicializado?"
        description="O registro sairá da lista de casos ativos, mas permanecerá no histórico."
        confirmLabel="Encerrar"
        variant="destructive"
        onConfirm={handleEncerrar}
      />
    </>
  )
}
