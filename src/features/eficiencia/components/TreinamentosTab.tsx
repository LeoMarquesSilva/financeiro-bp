import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import type { MesFiltroEficiencia } from '../constants'
import { useTreinamentos } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { AreaFilterButtons } from './AreaFilterButtons'
import { RacionalSheet } from './RacionalSheet'
import { TreinamentosPessoaCards } from './TreinamentosPessoaCards'
import type { HeatCell } from './OverviewKpiHeatRow'

function formatMinutosParaHoras(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  return `${h}:${String(m).padStart(2, '0')}h`
}

type Props = {
  ano: number
  /** Indicador anual: Resultado = ano todo (mesma regra do Overview). */
  mesFiltro: MesFiltroEficiencia
}

export function TreinamentosTab({ ano, mesFiltro }: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const { anual, porPessoa, itens, loading } = useTreinamentos(ano, area)
  const mesRacional: MesFiltroEficiencia =
    mesFiltro === 'resultado' ? null : mesFiltro

  const pct = anual?.pct_atingimento ?? null
  const abaixoMeta = pct != null && pct < 100

  return (
    <div className="space-y-5">
      <AreaFilterButtons
        value={area}
        onChange={setArea}
        allowedAreas={allowedAreas}
        allowTodas={allowTodas}
      />

      <section className="mx-auto w-full max-w-md rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <GraduationCap className="h-4 w-4" aria-hidden />
          Desenvolvimento Contínuo da Equipe
        </div>
        {loading ? (
          <div className="mt-4 h-28 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <>
            <p
              className={`mt-3 text-center text-4xl font-bold tabular-nums ${
                abaixoMeta ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {pct != null ? formatPercent(pct) : '—'}
            </p>
            <dl className="mt-4 space-y-1.5 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <dt>Horas Realizadas</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {anual ? formatMinutosParaHoras(anual.minutos_lancados) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Meta Total</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {anual ? formatMinutosParaHoras(anual.meta_minutos) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Colaboradores Ativos Área</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {anual ? anual.pessoas_ativas : '—'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-center text-xs font-medium text-emerald-700">
              Meta: 14h/colaborador
            </p>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
              Garantir a realização de pelo menos 14 horas anuais de treinamento por
              colaborador, alinhando o desenvolvimento contínuo da equipe às estratégias
              organizacionais.
            </p>
          </>
        )}
      </section>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Por colaborador</h2>
        <button
          type="button"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          onClick={() => setRacionalAberto(true)}
        >
          Racional
        </button>
      </div>

      <TreinamentosPessoaCards
        porPessoa={porPessoa}
        itens={itens}
        loading={loading}
      />

      <RacionalSheet
        indicador={racionalAberto ? 'desenvolvimento_equipe' : null}
        titulo="Desenvolvimento Equipe"
        ano={ano}
        mes={mesRacional}
        area={area}
        resultado={
          anual
            ? ({
                value: anual.pct_atingimento,
                label: formatPercent(anual.pct_atingimento),
              } satisfies HeatCell)
            : null
        }
        metaAcumulado={100}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
