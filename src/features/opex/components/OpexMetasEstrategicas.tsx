import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Code2,
  Pencil,
  Plus,
  RefreshCw,
  Replace,
  Target,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { useOpexMetasEstrategicas } from '../hooks/useOpexMetasEstrategicas'
import { resumoPorTipo } from '../services/opexMetasService'
import { OpexIniciativaDialog } from './OpexIniciativaDialog'
import { OpexIniciativaTitulosVinculados } from './OpexIniciativaTitulosVinculados'
import {
  OPEX_INICIATIVA_STATUS_LABELS,
  OPEX_INICIATIVA_STATUS_STYLES,
  OPEX_INICIATIVA_TIPOS,
  OPEX_META_MIN_VALOR_ANUAL,
} from '../constants/metasEstrategicas'
import type { OpexIniciativa, OpexIniciativaTipo, OpexMetaTipoResumo } from '../types/opexMetas.types'

type Props = {
  ano: number
}

function MetaProgressBar({ atual, meta, ok }: { atual: number; meta: number; ok: boolean }) {
  const pct = meta > 0 ? Math.min(100, (atual / meta) * 100) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn('h-full rounded-full transition-all', ok ? 'bg-emerald-500' : 'bg-violet-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MetaTipoCard({
  cfg,
  resumo,
  iniciativas,
  onAdd,
  onEdit,
  onRemove,
}: {
  cfg: (typeof OPEX_INICIATIVA_TIPOS)[number]
  resumo: OpexMetaTipoResumo
  iniciativas: OpexIniciativa[]
  onAdd: () => void
  onEdit: (i: OpexIniciativa) => void
  onRemove: (id: string) => void
}) {
  const Icon = cfg.icon === 'code' ? Code2 : Replace

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border bg-white shadow-sm',
        resumo.meta_atingida ? 'border-emerald-200/80' : 'border-slate-200/80',
      )}
    >
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                resumo.meta_atingida ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">{cfg.titulo}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{cfg.descricao}</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
              resumo.meta_atingida
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800',
            )}
          >
            {resumo.meta_atingida ? (
              <>
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Meta atingida
              </>
            ) : (
              <>
                <CircleDashed className="h-3 w-3" aria-hidden />
                Em andamento
              </>
            )}
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Iniciativas validadas</span>
              <span className={cn('font-semibold tabular-nums', resumo.meta_iniciativas_ok ? 'text-emerald-700' : 'text-slate-800')}>
                {resumo.validadas} / {resumo.meta_iniciativas_ok ? '≥' : ''}1
              </span>
            </div>
            <MetaProgressBar atual={resumo.validadas} meta={1} ok={resumo.meta_iniciativas_ok} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                {cfg.tipo === 'substituicao_ferramenta' ? 'Economia validada' : 'Custo evitado validado'}
              </span>
              <span className={cn('font-semibold tabular-nums', resumo.meta_valor_ok ? 'text-emerald-700' : 'text-slate-800')}>
                {formatCurrency(resumo.valor_validado)} / {formatCurrency(OPEX_META_MIN_VALOR_ANUAL)}
              </span>
            </div>
            <MetaProgressBar
              atual={resumo.valor_validado}
              meta={OPEX_META_MIN_VALOR_ANUAL}
              ok={resumo.meta_valor_ok}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-600">
            {iniciativas.length === 0
              ? 'Nenhuma iniciativa cadastrada'
              : `${iniciativas.length} iniciativa${iniciativas.length > 1 ? 's' : ''}`}
          </p>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Adicionar
          </Button>
        </div>

        {iniciativas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center text-xs text-slate-500">
            Cadastre a iniciativa e vincule ao título PAGAR do VIOS que comprova a economia ou o custo evitado.
          </p>
        ) : (
          <ul className="space-y-2">
            {iniciativas.map((ini) => (
              <li
                key={ini.id}
                className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{ini.titulo}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {cfg.contextoLabel}: <span className="text-slate-700">{ini.contexto}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        OPEX_INICIATIVA_STATUS_STYLES[ini.status],
                      )}
                    >
                      {OPEX_INICIATIVA_STATUS_LABELS[ini.status]}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(ini)}
                      aria-label="Editar iniciativa"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (window.confirm('Remover esta iniciativa?')) onRemove(ini.id)
                      }}
                      aria-label="Remover iniciativa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                  <span>
                    {cfg.valorLabel.replace(' (R$)', '')}:{' '}
                    <strong className="tabular-nums text-slate-900">{formatCurrency(ini.valor_anual)}</strong>
                  </span>
                  {ini.data_conclusao && (
                    <span>
                      Conclusão: <strong>{formatDate(ini.data_conclusao)}</strong>
                    </span>
                  )}
                  {ini.status === 'validada' && ini.validado_em && (
                    <span>
                      Validado: <strong>{formatDate(ini.validado_em)}</strong>
                      {ini.validado_por ? ` · ${ini.validado_por}` : ''}
                    </span>
                  )}
                </div>
                {ini.descricao && (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{ini.descricao}</p>
                )}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <OpexIniciativaTitulosVinculados ciItens={ini.ci_itens ?? []} compact showTotal />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

export function OpexMetasEstrategicas({ ano }: Props) {
  const { config, isLoading, error, refetch, upsertIniciativa, removeIniciativa, isSaving } =
    useOpexMetasEstrategicas()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTipo, setDialogTipo] = useState<OpexIniciativaTipo>('substituicao_ferramenta')
  const [editando, setEditando] = useState<OpexIniciativa | null>(null)
  const [expandido, setExpandido] = useState(false)

  useEffect(() => {
    setExpandido(false)
  }, [ano])

  const abrirNova = (tipo: OpexIniciativaTipo) => {
    setEditando(null)
    setDialogTipo(tipo)
    setDialogOpen(true)
  }

  const abrirEditar = (ini: OpexIniciativa) => {
    setEditando(ini)
    setDialogTipo(ini.tipo)
    setDialogOpen(true)
  }

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
  }

  if (error || !config) {
    return (
      <section className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-800">
        <p className="font-medium">Metas estratégicas indisponíveis</p>
        <p className="mt-1 text-xs">
          Verifique <code className="rounded bg-red-100/80 px-1">app_settings.opex_metas_estrategicas</code> no
          Supabase.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3 gap-2" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </section>
    )
  }

  const ambasAtingidas = OPEX_INICIATIVA_TIPOS.every(
    (t) => resumoPorTipo(config, ano, t.tipo).meta_atingida,
  )

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/80 sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-2">
          {expandido ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
            <Target className="h-4 w-4 text-violet-700" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Metas estratégicas OPEX · {ano}</h2>
            <p className="text-xs text-slate-500">
              Acompanhamento das iniciativas anuais vinculadas a títulos PAGAR do VIOS (mín. R$ 5.000/ano cada,
              validadas).
            </p>
          </div>
        </div>
        {ambasAtingidas && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Todas as metas do ano atingidas
          </span>
        )}
      </button>

      {expandido && (
        <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {OPEX_INICIATIVA_TIPOS.map((cfg) => {
              const resumo = resumoPorTipo(config, ano, cfg.tipo)
              const iniciativas = config.iniciativas
                .filter((i: OpexIniciativa) => i.ano === ano && i.tipo === cfg.tipo)
                .sort((a: OpexIniciativa, b: OpexIniciativa) => {
                  const ordem: Record<OpexIniciativa['status'], number> = {
                    validada: 0,
                    concluida: 1,
                    em_andamento: 2,
                    planejada: 3,
                  }
                  return ordem[a.status] - ordem[b.status]
                })

              return (
                <MetaTipoCard
                  key={cfg.tipo}
                  cfg={cfg}
                  resumo={resumo}
                  iniciativas={iniciativas}
                  onAdd={() => abrirNova(cfg.tipo)}
                  onEdit={abrirEditar}
                  onRemove={(id) => void removeIniciativa(id)}
                />
              )
            })}
          </div>
        </div>
      )}

      <OpexIniciativaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ano={ano}
        tipo={dialogTipo}
        iniciativa={editando}
        onSave={upsertIniciativa}
        isSaving={isSaving}
      />
    </section>
  )
}
