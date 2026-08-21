import {
  ClipboardList,
  Clock3,
  FileSearch,
  FolderKanban,
  Loader2,
  Newspaper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatHorasDuracao, formatDate } from '@/shared/utils/format'
import { cn } from '@/lib/utils'
import type { LevantamentoBloco, LevantamentoResumo } from '../services/escritorioLevantamentoService'

type Props = {
  resumo: LevantamentoResumo | undefined
  loading?: boolean
  onRacional: (bloco: LevantamentoBloco) => void
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  accentClass,
  onRacional,
  loading,
}: {
  title: string
  value: string
  hint?: string
  icon: typeof Newspaper
  accentClass: string
  onRacional: () => void
  loading?: boolean
}) {
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className={cn('rounded-lg p-2', accentClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={loading}
          onClick={onRacional}
        >
          <FileSearch className="h-3.5 w-3.5" />
          Racional
        </Button>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-500">{title}</p>
      {loading ? (
        <div className="mt-1 flex h-8 items-center">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : (
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      )}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </section>
  )
}

export function LevantamentoKpiCards({ resumo, loading, onRacional }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Publicações"
        value={(resumo?.publicacoes_total ?? 0).toLocaleString('pt-BR')}
        hint="No intervalo de datas"
        icon={Newspaper}
        accentClass="bg-sky-100 text-sky-700"
        loading={loading}
        onRacional={() => onRacional('publicacoes')}
      />
      <KpiCard
        title="Timesheet"
        value={formatHorasDuracao(resumo?.timesheet_horas ?? 0)}
        hint={
          (resumo?.timesheet_apontamentos ?? 0) === 0 && resumo?.timesheet_data_max
            ? `Sem apontamentos no período · base até ${formatDate(resumo.timesheet_data_max)}`
            : `${(resumo?.timesheet_apontamentos ?? 0).toLocaleString('pt-BR')} apontamentos`
        }
        icon={Clock3}
        accentClass="bg-violet-100 text-violet-700"
        loading={loading}
        onRacional={() => onRacional('timesheet')}
      />
      <KpiCard
        title="Processos"
        value={(resumo?.processos_total ?? 0).toLocaleString('pt-BR')}
        hint="Estoque atual (ignora data)"
        icon={FolderKanban}
        accentClass="bg-amber-100 text-amber-800"
        loading={loading}
        onRacional={() => onRacional('processos')}
      />
      <KpiCard
        title="Tarefas VIOS"
        value={(resumo?.tarefas_total ?? 0).toLocaleString('pt-BR')}
        hint="Concluídas no período"
        icon={ClipboardList}
        accentClass="bg-rose-100 text-rose-700"
        loading={loading}
        onRacional={() => onRacional('tarefas')}
      />
    </div>
  )
}
