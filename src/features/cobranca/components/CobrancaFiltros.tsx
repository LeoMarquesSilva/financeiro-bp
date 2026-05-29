import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, CheckCircle2, RotateCcw, CalendarClock } from 'lucide-react'
import type { FaixaAtrasoFiltro, StatusCobrancaFiltro } from '../services/cobrancaService'

const SELECT_CLASS =
  'flex h-8 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

export interface CobrancaFiltrosState {
  buscaInput: string
  mes: number | null
  ano: number | null
  planoContas: string | null
  statusCobranca: StatusCobrancaFiltro | null
  faixaAtraso: FaixaAtrasoFiltro | null
  rotinaVencidosOntem: boolean
  incluirConcluidos: boolean
  verArquivados: boolean
}

interface Props {
  filtros: CobrancaFiltrosState
  meses: Array<{ value: number; label: string }>
  anos: number[]
  planoContasOpcoes: string[]
  onBuscaChange: (value: string) => void
  onMesChange: (mes: number | null) => void
  onAnoChange: (ano: number | null) => void
  onPlanoContasChange: (value: string | null) => void
  onStatusCobrancaChange: (value: StatusCobrancaFiltro | null) => void
  onFaixaAtrasoChange: (value: FaixaAtrasoFiltro | null) => void
  onToggleRotinaVencidosOntem: () => void
  onToggleConcluidos: () => void
  onToggleArquivados: () => void
  onLimpar: () => void
}

const STATUS_COBRANCA: Array<{ value: StatusCobrancaFiltro | ''; label: string }> = [
  { value: '', label: 'Status cobrança' },
  { value: 'falta_ambos', label: 'Falta WhatsApp e e-mail' },
  { value: 'falta_whatsapp', label: 'Falta WhatsApp' },
  { value: 'falta_email', label: 'Falta e-mail' },
  { value: 'parcial', label: 'Parcial (1 canal)' },
  { value: 'concluido', label: 'Concluído (2 canais)' },
]

const FAIXA_ATRASO: Array<{ value: FaixaAtrasoFiltro | ''; label: string }> = [
  { value: '', label: 'Dias em atraso' },
  { value: '1-7', label: '1 a 7 dias' },
  { value: '8-30', label: '8 a 30 dias' },
  { value: '31+', label: '31+ dias' },
]

export function CobrancaFiltros({
  filtros,
  meses,
  anos,
  planoContasOpcoes,
  onBuscaChange,
  onMesChange,
  onAnoChange,
  onPlanoContasChange,
  onStatusCobrancaChange,
  onFaixaAtrasoChange,
  onToggleRotinaVencidosOntem,
  onToggleConcluidos,
  onToggleArquivados,
  onLimpar,
}: Props) {
  const temFiltroAtivo =
    filtros.mes ||
    filtros.ano ||
    filtros.planoContas ||
    filtros.statusCobranca ||
    filtros.faixaAtraso ||
    filtros.rotinaVencidosOntem

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={filtros.buscaInput}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar cliente ou título"
            className="h-8 w-64 pl-8"
          />
        </div>

        <select
          value={filtros.mes ?? ''}
          onChange={(e) => onMesChange(e.target.value ? Number(e.target.value) : null)}
          className={SELECT_CLASS}
          title="Mês de vencimento"
        >
          <option value="">Mês</option>
          {meses.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <select
          value={filtros.ano ?? ''}
          onChange={(e) => onAnoChange(e.target.value ? Number(e.target.value) : null)}
          className={SELECT_CLASS}
          title="Ano de vencimento"
        >
          <option value="">Ano</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={filtros.planoContas ?? ''}
          onChange={(e) => onPlanoContasChange(e.target.value || null)}
          className={`${SELECT_CLASS} min-w-[180px] max-w-[240px]`}
          title="Plano de contas"
        >
          <option value="">Plano de contas</option>
          {planoContasOpcoes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={filtros.statusCobranca ?? ''}
          onChange={(e) =>
            onStatusCobrancaChange((e.target.value || null) as StatusCobrancaFiltro | null)
          }
          className={`${SELECT_CLASS} min-w-[160px]`}
          title="Status da cobrança"
        >
          {STATUS_COBRANCA.map((s) => (
            <option key={s.value || 'todos'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={filtros.faixaAtraso ?? ''}
          onChange={(e) =>
            onFaixaAtrasoChange((e.target.value || null) as FaixaAtrasoFiltro | null)
          }
          className={SELECT_CLASS}
          title="Faixa de dias em atraso"
        >
          {FAIXA_ATRASO.map((f) => (
            <option key={f.value || 'todos'} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {temFiltroAtivo && (
          <Button variant="ghost" size="sm" onClick={onLimpar}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filtros.rotinaVencidosOntem ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleRotinaVencidosOntem}
          className="gap-2"
          title="Mostra apenas títulos vencidos ontem e ainda em aberto"
        >
          <CalendarClock className="h-4 w-4" />
          {filtros.rotinaVencidosOntem ? 'Rotina D+1 ativa' : 'Vencidos ontem (D+1)'}
        </Button>
        <Button
          variant={filtros.incluirConcluidos ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleConcluidos}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          {filtros.incluirConcluidos ? 'Mostrando concluídos' : 'Ver concluídos'}
        </Button>
        <Button
          variant={filtros.verArquivados ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleArquivados}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {filtros.verArquivados ? 'Ocultar arquivados' : 'Ver arquivados'}
        </Button>
      </div>
    </div>
  )
}
