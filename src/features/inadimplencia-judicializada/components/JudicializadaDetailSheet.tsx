import { useEffect, useState } from 'react'
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
import { formatCurrency, formatDateTime } from '@/shared/utils/format'
import { toast } from 'sonner'
import { useAuth } from '@/lib/AuthContext'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { useJudicializadaMutations } from '../hooks/useJudicializada'
import { judicializadaService } from '../services/judicializadaService'
import type {
  InadimplenciaJudicializadaAndamentoRow,
  InadimplenciaJudicializadaRow,
} from '../types/judicializada.types'

type Props = {
  row: InadimplenciaJudicializadaRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function JudicializadaDetailSheet({ row, open, onOpenChange, onUpdated }: Props) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'
  const { update, recalcular, encerrar, reabrir } = useJudicializadaMutations()

  const [valorAjuste, setValorAjuste] = useState('')
  const [dataJudicializacao, setDataJudicializacao] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [confirmEncerrar, setConfirmEncerrar] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!row) return
    setValorAjuste(
      row.valor_em_aberto_ajuste != null ? String(row.valor_em_aberto_ajuste) : '',
    )
    setDataJudicializacao(row.data_judicializacao ?? '')
    setObservacoes(row.observacoes ?? '')
  }, [row])

  if (!row) return null

  const encerrado = Boolean(row.encerrado_at)

  const { data: andamentos = [] } = useQuery({
    queryKey: ['inadimplencia', 'judicializada', 'andamentos', row.id],
    queryFn: () => judicializadaService.fetchAndamentosJudicializada(row.id),
    enabled: open,
  })

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Sem permissão para editar.')
      return
    }

    const ajusteParsed =
      valorAjuste.trim() === '' ? null : Number(valorAjuste.replace(/\./g, '').replace(',', '.'))

    if (valorAjuste.trim() !== '' && (Number.isNaN(ajusteParsed) || ajusteParsed! < 0)) {
      toast.error('Valor de ajuste inválido.')
      return
    }

    setSaving(true)
    try {
      await update.mutateAsync({
        id: row.id,
        input: {
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
    if (!canEdit) return
    try {
      await recalcular.mutateAsync(row.id)
      toast.success('Saldo automático recalculado.')
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao recalcular.')
    }
  }

  const handleEncerrar = async () => {
    if (!canEdit) return
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
    if (!canEdit) return
    try {
      await reabrir.mutateAsync(row.id)
      toast.success('Caso reaberto.')
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reabrir.')
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
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

            {(row.andamentos_resumo || andamentos.length > 0) && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Andamentos
                  </h3>
                  {row.andamentos_fonte && (
                    <Badge variant="outline" className="text-[10px]">
                      Fonte: {row.andamentos_fonte}
                      {row.andamentos_sync_em ? ' · sync VIOS pendente' : ''}
                    </Badge>
                  )}
                </div>
                {row.andamentos_resumo && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase text-slate-400">
                      Resumo (planilha)
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {row.andamentos_resumo}
                    </p>
                  </div>
                )}
                {andamentos.length > 0 && (
                  <ul className="space-y-2">
                    {andamentos.map((a: InadimplenciaJudicializadaAndamentoRow) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {a.fonte}
                          </Badge>
                          {a.vios_evento_id && (
                            <span className="font-mono text-[10px] text-slate-400">
                              vios:{a.vios_evento_id}
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-slate-700">{a.descricao}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-400">
                  Andamentos futuros do VIOS serão sincronizados nesta lista (campo{' '}
                  <code className="text-[10px]">vios_evento_id</code>).
                </p>
              </section>
            )}

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
                <p className="mt-1 text-xs text-slate-500">
                  Automático: {formatCurrency(row.valor_em_aberto_auto)}
                  {row.valor_em_aberto_ajuste != null && (
                    <> · Ajuste manual aplicado</>
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
                    value={valorAjuste}
                    onChange={(e) => setValorAjuste(e.target.value)}
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
