import { useMemo, useState, type ReactNode } from 'react'
import { Clock3, Layers, Timer, Users, UsersRound } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'
import { AreaFilterButtons } from '@/features/eficiencia/components/AreaFilterButtons'
import { MesFilterButtons } from '@/features/eficiencia/components/MesFilterButtons'
import { ResponsavelFilter } from '@/features/eficiencia/components/ResponsavelFilter'
import { isMesesFiltro, MESES_EFICIENCIA, type MesFiltroEficiencia } from '@/features/eficiencia/constants'
import { normalizeResponsavelChave } from '@/features/eficiencia/utils/responsavelMatch'
import type { ResponsavelOption } from '@/features/eficiencia/hooks/useResponsaveisOptions'
import { TIMESHEET_AREAS_JURIDICO_VIOS, timesheetAreasDaPessoa } from '../constants'
import { useTimesheetVisao } from '../hooks/useTimesheetVisao'
import { resolveTimesheetAccess } from '../utils/timesheetAccess'
import { formatTimesheetHoras } from '../utils/formatTimesheetHoras'
import { TimesheetMesChart } from '../components/TimesheetMesChart'
import { TimesheetRanking } from '../components/TimesheetRanking'

const ANO_PADRAO = 2026
const ANOS = [2026, 2025] as const

const BTN =
  'inline-flex h-8 items-center justify-center rounded-full border px-3 text-xs font-semibold transition-all'
const BTN_ON = 'border-slate-800 bg-slate-800 text-white shadow-sm'
const BTN_OFF = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Timer
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-[#C6A361]" aria-hidden />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
      )}
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function RankingBloco({
  titulo,
  className,
  children,
}: {
  titulo: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm', className)}>
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{titulo}</h2>
      {children}
    </section>
  )
}

export function TimesheetPage() {
  const { role, area, nivelHierarquico, colaboradorArea } = useAuth()
  const access = useMemo(
    () =>
      resolveTimesheetAccess({
        role,
        teamMemberArea: area,
        nivelHierarquico,
        colaboradorArea,
      }),
    [role, area, nivelHierarquico, colaboradorArea],
  )
  const [ano, setAno] = useState(ANO_PADRAO)
  const [areaFiltro, setAreaFiltro] = useState<string | null>(null)
  const [mesFiltro, setMesFiltro] = useState<MesFiltroEficiencia>(null)
  const [responsavel, setResponsavel] = useState<string | null>(null)

  const semVinculo = !access.canFilterAreas && access.lockedAreas?.length === 0
  const mesesConsulta = isMesesFiltro(mesFiltro) ? mesFiltro : null
  const areasConsulta = access.canFilterAreas
    ? (timesheetAreasDaPessoa(areaFiltro) ?? [...TIMESHEET_AREAS_JURIDICO_VIOS])
    : access.lockedAreas

  const { data, isLoading, isError } = useTimesheetVisao(
    ano,
    areasConsulta,
    mesesConsulta,
    responsavel,
    !semVinculo,
  )
  const loading = isLoading && !semVinculo
  const totalMinutos = data?.minutos ?? 0

  const recorteLabel = access.canFilterAreas ? (areaFiltro ?? 'Todas as áreas') : access.areaLabel
  const mesesLabel =
    mesesConsulta == null
      ? null
      : mesesConsulta.map((mes) => MESES_EFICIENCIA[mes - 1] ?? String(mes)).join(', ')
  const responsavelOptions = useMemo<ResponsavelOption[]>(
    () =>
      (data?.responsaveis ?? []).map((nome) => ({
        nome,
        area: null,
        nomeChave: normalizeResponsavelChave(nome),
      })),
    [data?.responsaveis],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Timer className="h-6 w-6 text-slate-600" />
            Timesheet
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Horas apontadas no VIOS
            {recorteLabel ? ` · ${recorteLabel}` : ''}
            {mesesLabel ? ` · ${mesesLabel}` : ''}
            {responsavel ? ` · ${responsavel}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Ano">
          {ANOS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setAno(item)}
              className={cn(BTN, 'min-w-[4.5rem]', ano === item ? BTN_ON : BTN_OFF)}
              aria-pressed={ano === item}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {access.canFilterAreas ? (
        <AreaFilterButtons value={areaFiltro} onChange={setAreaFiltro} />
      ) : null}

      <MesFilterButtons
        value={mesFiltro}
        onChange={setMesFiltro}
        showSemanas={false}
        showResultado={false}
        showDiaPicker={false}
        ano={ano}
      />

      <ResponsavelFilter
        ano={ano}
        area={access.canFilterAreas ? areaFiltro : access.areaLabel}
        value={responsavel}
        onChange={setResponsavel}
        enabled={!semVinculo}
        options={responsavelOptions}
        optionsLoading={isLoading && responsavelOptions.length === 0}
      />

      {semVinculo ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          Sua área não está vinculada ao cadastro. Peça ao admin para associar o colaborador antes de ver o timesheet.
        </div>
      ) : (
        <>
          {isError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Não foi possível carregar o timesheet. Tente de novo em instantes.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Horas"
              value={formatTimesheetHoras(data?.minutos)}
              hint="Soma dos minutos de cada lançamento"
              icon={Timer}
              loading={loading}
            />
            <Kpi
              label="Lançamentos"
              value={(data?.lancamentos ?? 0).toLocaleString('pt-BR')}
              hint={mesesConsulta ? 'Apontamentos nos meses escolhidos' : 'Apontamentos no ano'}
              icon={Layers}
              loading={loading}
            />
            <Kpi
              label="Responsáveis"
              value={(data?.colaboradores ?? 0).toLocaleString('pt-BR')}
              hint="Colaboradores com hora lançada"
              icon={Users}
              loading={loading}
            />
            <Kpi
              label="Grupos"
              value={(data?.grupos ?? 0).toLocaleString('pt-BR')}
              hint="Grupos de cliente com hora"
              icon={UsersRound}
              loading={loading}
            />
          </div>

          <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Clock3 className="h-4 w-4 text-slate-500" />
              Horas por mês
            </h2>
            <TimesheetMesChart meses={data?.por_mes ?? []} loading={loading} />
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {MESES_EFICIENCIA[0]} a {MESES_EFICIENCIA[11]} · eixo em horas
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RankingBloco titulo="Por responsável" className="xl:col-span-2">
              <TimesheetRanking
                rows={data?.por_colaborador ?? []}
                totalMinutos={totalMinutos}
                loading={loading}
                comFoto
              />
            </RankingBloco>
            <RankingBloco titulo="Por tipo de tarefa">
              <TimesheetRanking
                rows={data?.por_tipo_tarefa ?? []}
                totalMinutos={totalMinutos}
                loading={loading}
              />
            </RankingBloco>
            <RankingBloco titulo="Por grupo">
              <TimesheetRanking
                rows={data?.por_grupo ?? []}
                totalMinutos={totalMinutos}
                loading={loading}
              />
            </RankingBloco>
            <RankingBloco titulo="Por tipo">
              <TimesheetRanking
                rows={data?.por_tipo_apontamento ?? []}
                totalMinutos={totalMinutos}
                loading={loading}
              />
            </RankingBloco>
            {access.canFilterAreas ? (
              <RankingBloco titulo="Por área">
                <TimesheetRanking
                  rows={data?.por_area ?? []}
                  totalMinutos={totalMinutos}
                  loading={loading}
                  vazio="Nenhuma área neste recorte."
                />
              </RankingBloco>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
