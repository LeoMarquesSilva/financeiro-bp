import { useRef, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { ElementCopyButton } from '@/shared/components/ElementCopyButton'
import {
  EFICIENCIA_META_TREINAMENTO_MINUTOS,
  type MesFiltroEficiencia,
} from '../constants'
import { useTreinamentos } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { filtrarPorResponsavel } from '../utils/responsavelMatch'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
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
  responsavel?: string | null
  onResponsavelChange?: (nome: string | null) => void
  responsavelEnabled?: boolean
  responsavelHintDisabled?: string
}

export function TreinamentosTab({
  ano,
  mesFiltro,
  responsavel = null,
  onResponsavelChange,
  responsavelEnabled,
  responsavelHintDisabled,
}: Props) {
  const { area, setArea, allowedAreas, allowTodas } = useEficienciaAreaFilter()
  const [racionalAberto, setRacionalAberto] = useState(false)
  const resumoRef = useRef<HTMLElement>(null)
  const porColaboradorRef = useRef<HTMLDivElement>(null)
  const { anual, porPessoa, itens, loading } = useTreinamentos(ano, area)
  const porPessoaFiltrado = filtrarPorResponsavel(porPessoa, (p) => p.colaborador, responsavel)
  const itensFiltrados = filtrarPorResponsavel(itens, (i) => i.colaborador, responsavel)
  const mesRacional: MesFiltroEficiencia =
    mesFiltro === 'resultado' ? null : mesFiltro

  const pessoaUnica =
    responsavel && porPessoaFiltrado.length === 1 ? porPessoaFiltrado[0] : null
  const minutosLancados = pessoaUnica
    ? pessoaUnica.minutos_lancados
    : (anual?.minutos_lancados ?? null)
  const metaMinutos = pessoaUnica
    ? Number(pessoaUnica.meta_minutos ?? EFICIENCIA_META_TREINAMENTO_MINUTOS)
    : (anual?.meta_minutos ?? null)
  const pessoasAtivas = pessoaUnica ? 1 : (anual?.pessoas_ativas ?? null)
  const pct =
    minutosLancados != null && metaMinutos != null && metaMinutos > 0
      ? (minutosLancados / metaMinutos) * 100
      : pessoaUnica
        ? 0
        : (anual?.pct_atingimento ?? null)
  const abaixoMeta = pct != null && pct < 100

  return (
    <div className="space-y-5">
      <EficienciaDetailFilters
        ano={ano}
        mesFiltro={mesFiltro}
        area={area}
        onAreaChange={setArea}
        allowedAreas={allowedAreas}
        allowTodas={allowTodas}
        responsavel={responsavel}
        onResponsavelChange={onResponsavelChange ?? (() => undefined)}
        responsavelEnabled={responsavelEnabled}
        responsavelHintDisabled={responsavelHintDisabled}
      />

      <div className="mx-auto w-full max-w-md space-y-2">
        <div className="flex justify-end">
          <ElementCopyButton
            containerRef={resumoRef}
            label="Copiar gráfico"
            preserveBackground
          />
        </div>
        <section
          ref={resumoRef}
          className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm"
        >
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
                    {minutosLancados != null
                      ? formatMinutosParaHoras(minutosLancados)
                      : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Meta Total</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {metaMinutos != null ? formatMinutosParaHoras(metaMinutos) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Colaboradores Ativos Área</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {pessoasAtivas != null ? pessoasAtivas : '—'}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-center text-xs font-medium text-emerald-700">
                Meta proporcional à admissão
              </p>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
                Garantir a realização de pelo menos 14 horas anuais de treinamento por
                colaborador, alinhando o desenvolvimento contínuo da equipe às estratégias
                organizacionais.
              </p>
            </>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Por colaborador</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ElementCopyButton
            containerRef={porColaboradorRef}
            label="Copiar gráfico"
            preserveBackground
          />
          <button
            type="button"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            onClick={() => setRacionalAberto(true)}
          >
            Racional
          </button>
        </div>
      </div>

      <div
        ref={porColaboradorRef}
        data-chart-export-stack-cards
        data-chart-export-bg="#ffffff"
        className="rounded-xl bg-white"
      >
        <TreinamentosPessoaCards
          porPessoa={porPessoaFiltrado}
          itens={itensFiltrados}
          loading={loading}
        />
      </div>

      <RacionalSheet
        indicador={racionalAberto ? 'desenvolvimento_equipe' : null}
        titulo="Desenvolvimento Equipe"
        ano={ano}
        mes={mesRacional}
        area={area}
        responsavel={responsavel}
        resultado={
          pct != null
            ? ({
                value: pct,
                label: formatPercent(pct),
              } satisfies HeatCell)
            : null
        }
        metaAcumulado={100}
        onClose={() => setRacionalAberto(false)}
      />
    </div>
  )
}
