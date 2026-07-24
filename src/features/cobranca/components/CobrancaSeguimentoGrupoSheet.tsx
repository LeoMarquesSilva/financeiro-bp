import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import { useCobrancaSeguimentoGrupoDetalhe } from '../hooks/useCobrancaSeguimento'
import { labelCanalD1, labelTipoAcaoSeguimento } from '../utils/cobrancaSeguimentoLabels'
import { CobrancaSeguimentoNovaAcaoModal } from './CobrancaSeguimentoNovaAcaoModal'
import type {
  CobrancaSeguimentoGrupo,
  CobrancaSeguimentoHistoricoD1,
  CobrancaSeguimentoTitulo,
  CobrancaSeguimentoAcao,
} from '../types/cobrancaSeguimento.types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupo: CobrancaSeguimentoGrupo | null
}

function followUpVencido(data: string | null | undefined): boolean {
  if (!data) return false
  return data < new Date().toISOString().slice(0, 10)
}

export function CobrancaSeguimentoGrupoSheet({ open, onOpenChange, grupo }: Props) {
  const [modalAcaoOpen, setModalAcaoOpen] = useState(false)
  const { detalhe, loading, refetch } = useCobrancaSeguimentoGrupoDetalhe(
    open && grupo ? grupo.grupo_chave : null,
  )

  const followUpAtrasado = followUpVencido(grupo?.proximo_follow_up)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="pr-6">{grupo?.grupo_chave ?? 'Detalhe do grupo'}</SheetTitle>
            <SheetDescription>
              Títulos vencidos até 60 dias após cobrança D+1 ·{' '}
              {grupo ? formatCurrency(grupo.valor_total) : '—'}
            </SheetDescription>
          </SheetHeader>

          {grupo?.proximo_follow_up && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                followUpAtrasado
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700',
              )}
            >
              Follow-up previsto: {formatDate(grupo.proximo_follow_up)}
              {followUpAtrasado ? ' (vencido)' : ''}
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue="titulos" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="titulos">Títulos</TabsTrigger>
                <TabsTrigger value="d1">Cobrança D+1</TabsTrigger>
                <TabsTrigger value="seguimento">Seguimento</TabsTrigger>
              </TabsList>

              <TabsContent value="titulos" className="mt-4 flex-1 overflow-y-auto">
                {!detalhe?.titulos.length ? (
                  <p className="text-sm text-slate-400">Nenhum título em aberto.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {detalhe.titulos.map((t: CobrancaSeguimentoTitulo) => (
                      <li key={t.parcela_id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {t.pessoa_nome || t.cliente || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Título {t.nro_titulo ?? '—'} · venc. {formatDate(t.data_vencimento)}
                            </p>
                            {t.plano_contas && (
                              <p className="text-xs text-slate-400">{t.plano_contas}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(t.valor)}
                            </p>
                            <Badge variant="outline" className="mt-1 text-[10px]">
                              {t.dias_atraso}d
                            </Badge>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="d1" className="mt-4 flex-1 overflow-y-auto">
                {!detalhe?.historico_d1.length ? (
                  <p className="text-sm text-slate-400">
                    Nenhuma cobrança D+1 registrada para estes títulos.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {detalhe.historico_d1.map((h: CobrancaSeguimentoHistoricoD1) => (
                      <li
                        key={h.id}
                        className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                            {labelCanalD1(h.canal)}
                          </Badge>
                          <span className="text-[11px] text-slate-400">
                            {formatDateTime(h.created_at)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          Título {h.nro_titulo ?? '—'} · {h.cliente ?? '—'}
                        </p>
                        {h.mensagem_resumo && (
                          <p className="mt-1 text-xs text-slate-500">{h.mensagem_resumo}</p>
                        )}
                        {h.created_by && (
                          <p className="mt-1 text-[11px] text-slate-400">Por {h.created_by}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="seguimento" className="mt-4 flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex justify-end">
                  <Button size="sm" className="gap-1" onClick={() => setModalAcaoOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Registrar ação
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {!detalhe?.acoes_seguimento.length ? (
                    <p className="text-sm text-slate-400">
                      Nenhuma ação de seguimento registrada ainda.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {detalhe.acoes_seguimento.map((a: CobrancaSeguimentoAcao) => (
                        <li
                          key={a.id}
                          className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {labelTipoAcaoSeguimento(a.tipo)}
                            </span>
                            <span className="text-xs text-slate-400">{formatDate(a.data_acao)}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{a.descricao}</p>
                          {a.data_follow_up && (
                            <p
                              className={cn(
                                'mt-2 text-xs',
                                followUpVencido(a.data_follow_up)
                                  ? 'font-medium text-rose-600'
                                  : 'text-slate-400',
                              )}
                            >
                              Follow-up: {formatDate(a.data_follow_up)}
                            </p>
                          )}
                          {a.created_by && (
                            <p className="mt-1 text-[11px] text-slate-400">Por {a.created_by}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {grupo && (
        <CobrancaSeguimentoNovaAcaoModal
          open={modalAcaoOpen}
          onClose={() => setModalAcaoOpen(false)}
          grupoChave={grupo.grupo_chave}
          onSuccess={() => refetch()}
        />
      )}
    </>
  )
}
