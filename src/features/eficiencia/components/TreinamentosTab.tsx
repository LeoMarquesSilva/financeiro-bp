import { useRef, useState } from 'react'
import { GraduationCap, Timer, Users } from 'lucide-react'
import { formatPercent } from '@/shared/utils/format'
import { ElementCopyButton } from '@/shared/components/ElementCopyButton'
import {
  EFICIENCIA_META_TREINAMENTO_MINUTOS,
  type MesFiltroEficiencia,
} from '../constants'
import { useTreinamentos } from '../hooks/useEficiencia'
import { useEficienciaAreaFilter } from '../hooks/useEficienciaAreaFilter'
import { filtrarPorResponsavel } from '../utils/responsavelMatch'
import { formatMinutosHeatLabel } from '../utils/desenvolvimentoEquipeHeatCell'
import { EficienciaDetailFilters } from './EficienciaDetailFilters'
import { EficienciaKpiCard } from './EficienciaKpiCard'
import { RacionalSheet } from './RacionalSheet'
import { TreinamentosCursoCards } from './TreinamentosCursoCards'
import { TreinamentosPessoaCards } from './TreinamentosPessoaCards'
import {
  TreinamentosVisaoToggle,
  type TreinamentosVisao,
} from './TreinamentosVisaoToggle'
import { OverviewRacionalButton, type HeatCell } from './OverviewKpiHeatRow'

function formatHorasKpi(minutos: number): string {
  return `${formatMinutosHeatLabel(minutos)}h`
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
  const [visao, setVisao] = useState<TreinamentosVisao>('equipe')
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
  const pctEquipe = anual?.pct_atingimento ?? null

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

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
        <EficienciaKpiCard
          title="Desenvolvimento Contínuo da Equipe"
          value={pct != null ? formatPercent(pct) : '—'}
          hint="Horas realizadas ÷ meta · ano inteiro"
          meta="100,00%"
          atingiuMeta={pct != null ? !abaixoMeta : null}
          icon={GraduationCap}
          accentClass="bg-emerald-100 text-emerald-700"
          loading={loading}
          pessoaNome={responsavel}
          currentPct={pessoaUnica ? pct : null}
          vsEquipePct={pessoaUnica ? pctEquipe : null}
        />
        <EficienciaKpiCard
          title="Horas Realizadas"
          value={
            minutosLancados != null ? formatHorasKpi(minutosLancados) : '—'
          }
          hint="Total de treinamento no período"
          meta={metaMinutos != null ? formatHorasKpi(metaMinutos) : undefined}
          atingiuMeta={
            minutosLancados != null && metaMinutos != null && metaMinutos > 0
              ? minutosLancados >= metaMinutos
              : null
          }
          icon={Timer}
          accentClass="bg-sky-100 text-sky-700"
          loading={loading}
          pessoaNome={responsavel}
        />
        <EficienciaKpiCard
          title="Colaboradores Ativos"
          value={pessoasAtivas != null ? String(pessoasAtivas) : '—'}
          hint="Meta proporcional à admissão · mín. 14h/ano"
          icon={Users}
          accentClass="bg-violet-100 text-violet-700"
          loading={loading}
          pessoaNome={responsavel}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TreinamentosVisaoToggle value={visao} onChange={setVisao} />
        <div className="flex flex-wrap items-center gap-2">
          <OverviewRacionalButton
            onClick={() => setRacionalAberto(true)}
            className="w-auto"
          />
          <ElementCopyButton
            containerRef={porColaboradorRef}
            label="Copiar gráfico"
            preserveBackground
          />
        </div>
      </div>

      <div
        ref={porColaboradorRef}
        data-chart-export-stack-cards
        data-chart-export-bg="#ffffff"
        className="rounded-xl bg-white"
      >
        {visao === 'equipe' ? (
          <TreinamentosPessoaCards
            porPessoa={porPessoaFiltrado}
            itens={itensFiltrados}
            loading={loading}
          />
        ) : (
          <TreinamentosCursoCards
            porPessoa={porPessoaFiltrado}
            itens={itensFiltrados}
            loading={loading}
          />
        )}
      </div>

      <RacionalSheet
        indicador={racionalAberto ? 'desenvolvimento_equipe' : null}
        titulo="Desenvolvimento — Treinamentos"
        ano={ano}
        mes={mesRacional}
        area={area}
        escopo="desenvolvimento_treinamentos"
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
