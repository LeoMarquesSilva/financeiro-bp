import { useMemo, useState } from 'react'
import { useCobrancaKpiRows } from '../hooks/useWhatsapp'
import type { CobrancaPainelKpiRow } from '../services/cobrancaService'
import { isTituloSaldoParcial } from '../utils/titulo'
import { formatCurrency, formatPercent } from '@/shared/utils/format'
import {
  Target,
  MessageCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  CobrancaKpiDetalheSheet,
  type KpiCardTipo,
} from './CobrancaKpiDetalheSheet'

const META_PCT = 100
const TODOS = '__all__'

const SELECT_CLASS =
  'flex h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-1'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

type Kpi = {
  titulos_vencidos: number
  /** Cobrado no D+1 útil — conta no indicador. */
  titulos_cobrados: number
  /** Cobrado por WhatsApp, mas fora da data-alvo D+1. */
  titulos_fora_prazo: number
  /** Ainda sem nenhuma cobrança WhatsApp. */
  titulos_sem_cobranca: number
  com_whatsapp: number
  concluidos: number
  valor_vencido: number
  valor_cobrado: number
  valor_fora_prazo: number
  valor_sem_cobranca: number
  efetividade_pct: number
}

function cobradoIndicadorD1(r: CobrancaPainelKpiRow): boolean {
  return r.tem_whatsapp_d1
}

function cobradoForaPrazo(r: CobrancaPainelKpiRow): boolean {
  return r.tem_whatsapp && !r.tem_whatsapp_d1
}

function semCobrancaWhatsapp(r: CobrancaPainelKpiRow): boolean {
  return !r.tem_whatsapp
}

function somaValor(rows: CobrancaPainelKpiRow[]): number {
  return rows.reduce((s, r) => s + Number(r.valor || 0), 0)
}

function agregar(rows: CobrancaPainelKpiRow[]): Kpi {
  const total = rows.length
  const cobradosD1 = rows.filter(cobradoIndicadorD1)
  const foraPrazo = rows.filter(cobradoForaPrazo)
  const semCobranca = rows.filter(semCobrancaWhatsapp)
  const valorVencido = somaValor(rows)
  return {
    titulos_vencidos: total,
    titulos_cobrados: cobradosD1.length,
    titulos_fora_prazo: foraPrazo.length,
    titulos_sem_cobranca: semCobranca.length,
    com_whatsapp: rows.filter((r) => r.tem_whatsapp).length,
    concluidos: cobradosD1.length,
    valor_vencido: valorVencido,
    valor_cobrado: somaValor(cobradosD1),
    valor_fora_prazo: somaValor(foraPrazo),
    valor_sem_cobranca: somaValor(semCobranca),
    efetividade_pct: total > 0 ? (100 * cobradosD1.length) / total : 100,
  }
}

function RadialMeta({ valor }: { valor: number }) {
  const pct = Math.max(0, Math.min(100, valor))
  const raio = 70
  const circ = 2 * Math.PI * raio
  const filled = (pct / 100) * circ
  const cor = pct >= 95 ? '#059669' : pct >= 60 ? '#d97706' : '#e11d48'

  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={raio} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="80"
          cy="80"
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-slate-900">{formatPercent(pct)}</span>
        <span className="text-xs text-slate-400">meta {formatPercent(META_PCT)}</span>
      </div>
    </div>
  )
}

function StatCard({
  label,
  valor,
  sub,
  icon: Icon,
  tone = 'slate',
  onClick,
}: {
  label: string
  valor: string
  sub?: string
  icon: React.ElementType
  tone?: 'slate' | 'emerald' | 'rose' | 'amber'
  onClick?: () => void
}) {
  const tones: Record<string, string> = {
    slate: 'text-slate-600 bg-slate-100',
    emerald: 'text-emerald-600 bg-emerald-100',
    rose: 'text-rose-600 bg-rose-100',
    amber: 'text-amber-600 bg-amber-100',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors',
        onClick &&
          'cursor-pointer hover:border-slate-300 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-lg font-semibold text-slate-900 sm:text-xl">{valor}</p>
          {sub && <p className="truncate text-[11px] text-slate-400 sm:text-xs">{sub}</p>}
        </div>
        {onClick && (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        )}
      </div>
    </Comp>
  )
}

export function CobrancaDashboard() {
  const { rows, loading, refetch } = useCobrancaKpiRows()

  const [ano, setAno] = useState<string>(TODOS)
  const [mes, setMes] = useState<string>(TODOS)
  const [planosSelecionados, setPlanosSelecionados] = useState<string[]>([])
  const [gruposSelecionados, setGruposSelecionados] = useState<string[]>([])
  const [buscaGrupo, setBuscaGrupo] = useState('')
  const [status, setStatus] = useState<string>(TODOS)
  const [faixa, setFaixa] = useState<string>(TODOS)
  const [detalheCard, setDetalheCard] = useState<KpiCardTipo | null>(null)

  const opcoes = useMemo(() => {
    const anos = new Set<string>()
    const planos = new Set<string>()
    const grupos = new Set<string>()
    for (const r of rows) {
      if (r.data_vencimento) anos.add(r.data_vencimento.slice(0, 4))
      if (r.plano_contas) planos.add(r.plano_contas)
      if (r.grupo_cliente) grupos.add(r.grupo_cliente)
    }
    return {
      anos: [...anos].sort((a, b) => b.localeCompare(a)),
      planos: [...planos].sort((a, b) => a.localeCompare(b)),
      grupos: [...grupos].sort((a, b) => a.localeCompare(b)),
    }
  }, [rows])

  const filtradas = useMemo(() => {
    return rows.filter((r) => {
      if (isTituloSaldoParcial(r.nro_titulo)) return false
      const venc = r.data_vencimento ?? ''
      if (ano !== TODOS && venc.slice(0, 4) !== ano) return false
      if (mes !== TODOS && venc.slice(5, 7) !== mes) return false
      if (planosSelecionados.length > 0 && !planosSelecionados.includes(r.plano_contas ?? '')) return false
      if (gruposSelecionados.length > 0 && !gruposSelecionados.includes(r.grupo_cliente ?? '')) return false
      if (status !== TODOS) {
        if (status === 'cobrado' && !cobradoIndicadorD1(r)) return false
        if (status === 'fora_prazo' && !cobradoForaPrazo(r)) return false
        if (status === 'pendente' && !semCobrancaWhatsapp(r)) return false
      }
      if (faixa !== TODOS) {
        const d = Number(r.dias_atraso ?? 0)
        if (faixa === '1-7' && !(d >= 1 && d <= 7)) return false
        if (faixa === '8-30' && !(d >= 8 && d <= 30)) return false
        if (faixa === '31+' && !(d >= 31)) return false
      }
      return true
    })
  }, [rows, ano, mes, planosSelecionados, gruposSelecionados, status, faixa])

  const gruposFiltrados = useMemo(() => {
    const termo = buscaGrupo.trim().toLowerCase()
    if (!termo) return opcoes.grupos
    return opcoes.grupos.filter((g) => g.toLowerCase().includes(termo))
  }, [opcoes.grupos, buscaGrupo])

  const kpi = useMemo(() => agregar(filtradas), [filtradas])

  const rowsPorCard = useMemo(
    () => ({
      vencidos: filtradas,
      d1: filtradas.filter(cobradoIndicadorD1),
      fora_prazo: filtradas.filter(cobradoForaPrazo),
      sem_cobranca: filtradas.filter(semCobrancaWhatsapp),
      com_whatsapp: filtradas.filter((r) => r.tem_whatsapp),
    }),
    [filtradas],
  )

  const algumFiltro =
    ano !== TODOS ||
    mes !== TODOS ||
    planosSelecionados.length > 0 ||
    gruposSelecionados.length > 0 ||
    status !== TODOS ||
    faixa !== TODOS
  const limpar = () => {
    setAno(TODOS)
    setMes(TODOS)
    setPlanosSelecionados([])
    setGruposSelecionados([])
    setBuscaGrupo('')
    setStatus(TODOS)
    setFaixa(TODOS)
  }

  const toggleGrupo = (grupo: string) => {
    setGruposSelecionados((atual) =>
      atual.includes(grupo) ? atual.filter((item) => item !== grupo) : [...atual, grupo]
    )
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />
  }

  const efet = kpi.efetividade_pct
  const pctD1 =
    kpi.titulos_vencidos > 0 ? (kpi.titulos_cobrados / kpi.titulos_vencidos) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </span>

        <select
          value={ano}
          onChange={(e) => setAno(e.target.value)}
          className={SELECT_CLASS}
          title="Ano de vencimento"
        >
          <option value={TODOS}>Todos os anos</option>
          {opcoes.anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className={SELECT_CLASS}
          title="Mês de vencimento"
        >
          <option value={TODOS}>Todos os meses</option>
          {MESES.map((nome, i) => (
            <option key={nome} value={String(i + 1).padStart(2, '0')}>
              {nome}
            </option>
          ))}
        </select>

        <select
          multiple
          size={1}
          value={planosSelecionados.length > 0 ? planosSelecionados : [TODOS]}
          onChange={(e) => {
            const selecionados = Array.from(e.target.selectedOptions).map((option) => option.value)
            const semTodos = selecionados.filter((value) => value !== TODOS)
            if (semTodos.length === 0) {
              setPlanosSelecionados([])
              return
            }
            setPlanosSelecionados(semTodos)
          }}
          className={`${SELECT_CLASS} min-h-[32px] min-w-[160px] max-w-[220px] py-1`}
          title="Plano de contas (Ctrl/Cmd para múltiplos)"
        >
          <option value={TODOS}>Todos os planos</option>
          {opcoes.planos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${SELECT_CLASS} min-w-[160px] max-w-[220px] justify-between gap-2`}
              title="Grupo de cliente"
            >
              <span className="truncate">
                {gruposSelecionados.length === 0
                  ? 'Todos os grupos'
                  : gruposSelecionados.length === 1
                    ? gruposSelecionados[0]
                    : `${gruposSelecionados.length} grupos selecionados`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-2">
            <input
              type="text"
              value={buscaGrupo}
              onChange={(e) => setBuscaGrupo(e.target.value)}
              placeholder="Pesquisar grupo..."
              className="mb-2 flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-1"
            />
            <div className="max-h-56 space-y-1 overflow-auto pr-1">
              <button
                type="button"
                onClick={() => setGruposSelecionados([])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    gruposSelecionados.length === 0
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300'
                  )}
                >
                  {gruposSelecionados.length === 0 && <Check className="h-3 w-3" />}
                </span>
                Todos os grupos
              </button>

              {gruposFiltrados.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-slate-500">Nenhum grupo encontrado.</p>
              ) : (
                gruposFiltrados.map((g) => {
                  const selecionado = gruposSelecionados.includes(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGrupo(g)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded border',
                          selecionado ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'
                        )}
                      >
                        {selecionado && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate">{g}</span>
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={SELECT_CLASS}
          title="Status da cobrança"
        >
          <option value={TODOS}>Todos os status</option>
          <option value="cobrado">No D+1 (indicador)</option>
          <option value="fora_prazo">Fora do prazo D+1</option>
          <option value="pendente">Sem cobrança</option>
        </select>

        <select
          value={faixa}
          onChange={(e) => setFaixa(e.target.value)}
          className={SELECT_CLASS}
          title="Faixa de dias em atraso"
        >
          <option value={TODOS}>Qualquer atraso</option>
          <option value="1-7">1 a 7 dias</option>
          <option value="8-30">8 a 30 dias</option>
          <option value="31+">31+ dias</option>
        </select>

        {algumFiltro && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={limpar}>
            Limpar
          </Button>
        )}

        <Button variant="ghost" size="sm" className="ml-auto h-8 gap-2 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Card da meta */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <RadialMeta valor={efet} />

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <Target className="h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Efetividade na Cobrança Inicial (D+1)
              </h2>
            </div>
            <p className="max-w-2xl text-sm text-slate-500">
              Assegurar que <strong>100% dos títulos em aberto</strong> sejam cobrados por WhatsApp no{' '}
              <strong>D+1 útil</strong>. Vencimento em fim de semana é prorrogado para a segunda-feira
              seguinte (ex.: venc. 31/05 → efetivo 01/06 → cobrança 02/06).               Cobranças fora da data-alvo não entram no indicador, mas aparecem como{' '}
              <strong>fora do prazo</strong> (não como pendente).
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {kpi.titulos_cobrados} no D+1
              </span>
              {kpi.titulos_fora_prazo > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {kpi.titulos_fora_prazo} fora do prazo
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {kpi.titulos_sem_cobranca} sem cobrança
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de apoio — clique para ver composição */}
      <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-4">
        <StatCard
          label="Títulos vencidos"
          valor={String(kpi.titulos_vencidos)}
          sub={formatCurrency(kpi.valor_vencido)}
          icon={AlertTriangle}
          tone="slate"
          onClick={() => setDetalheCard('vencidos')}
        />
        <StatCard
          label="No D+1 (indicador)"
          valor={String(kpi.titulos_cobrados)}
          sub={`${formatPercent(pctD1)} do total · ${formatCurrency(kpi.valor_cobrado)}`}
          icon={CheckCircle2}
          tone="emerald"
          onClick={() => setDetalheCard('d1')}
        />
        <StatCard
          label="Fora do prazo D+1"
          valor={String(kpi.titulos_fora_prazo)}
          sub={`Cobrado após o D+1 · ${formatCurrency(kpi.valor_fora_prazo)}`}
          icon={MessageCircle}
          tone="amber"
          onClick={() => setDetalheCard('fora_prazo')}
        />
        <StatCard
          label="Sem cobrança"
          valor={String(kpi.titulos_sem_cobranca)}
          sub={`Ainda sem WhatsApp · ${formatCurrency(kpi.valor_sem_cobranca)}`}
          icon={AlertTriangle}
          tone="rose"
          onClick={() => setDetalheCard('sem_cobranca')}
        />
        <StatCard
          label="Com WhatsApp (total)"
          valor={String(kpi.com_whatsapp)}
          sub={`de ${kpi.titulos_vencidos} título(s)`}
          icon={MessageCircle}
          tone="slate"
          onClick={() => setDetalheCard('com_whatsapp')}
        />
      </div>

      <p className="text-xs text-slate-500">
        Cada título vencido cai em uma única categoria:{' '}
        <strong className="font-medium text-emerald-700">{kpi.titulos_cobrados} no D+1</strong>
        {' + '}
        <strong className="font-medium text-amber-700">{kpi.titulos_fora_prazo} fora do prazo</strong>
        {' + '}
        <strong className="font-medium text-rose-600">{kpi.titulos_sem_cobranca} sem cobrança</strong>
        {' = '}
        <strong className="font-medium text-slate-700">{kpi.titulos_vencidos} títulos</strong>. O indicador
        ({formatPercent(efet)}) é apenas <strong>no D+1 ÷ total</strong> — títulos sem cobrança reduzem a meta,
        mas não entram em &quot;fora do prazo&quot;.
      </p>

      <CobrancaKpiDetalheSheet
        open={detalheCard !== null}
        onOpenChange={(open) => {
          if (!open) setDetalheCard(null)
        }}
        tipo={detalheCard}
        rows={detalheCard ? rowsPorCard[detalheCard] : []}
      />

      {/* Pendência de valor */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Valor no indicador (D+1)</span>
          <span className="text-slate-500">
            {formatCurrency(kpi.valor_cobrado)} de {formatCurrency(kpi.valor_vencido)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{
              width: `${
                kpi.valor_vencido > 0
                  ? Math.min(100, (kpi.valor_cobrado / kpi.valor_vencido) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          {kpi.concluidos} no D+1 · {kpi.titulos_fora_prazo} cobrado(s) fora do prazo ·{' '}
          {kpi.titulos_sem_cobranca} sem cobrança WhatsApp.
        </p>
      </div>
    </div>
  )
}
