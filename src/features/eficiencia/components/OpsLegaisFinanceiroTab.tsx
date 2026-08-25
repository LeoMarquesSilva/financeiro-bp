import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_OPS_ANTECIPACAO,
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  EFICIENCIA_META_OPS_FECHAMENTO,
  filtrarMensalPorMesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useCobrancaKpiRows } from '@/features/cobranca/hooks/useWhatsapp'
import { eficienciaService } from '../services/eficienciaService'
import type {
  OpsLegaisAntecipacaoMesRow,
  OpsLegaisFechamentoMesRow,
  RacionalIndicador,
} from '../types/eficiencia.types'
import {
  agregarEfetividade,
  filtrarPainelEfetividade,
  serieMensalEfetividade,
} from '../utils/opsEfetividadeCobranca'
import { EficienciaEficDesvioCard } from './EficienciaEficDesvioCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'
import { OverviewRacionalButton } from './OverviewKpiHeatRow'
import { RacionalSheet } from './RacionalSheet'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

const RACIONAL_TITULOS: Partial<Record<RacionalIndicador, string>> = {
  ops_legais_antecipacao_faturamento: 'Antecipação de Faturamento de Honorários',
  ops_legais_efetividade_cobranca: 'Efetividade na Cobrança',
  ops_legais_fechamento: 'Fechamento',
}

export function OpsLegaisFinanceiroTab({ ano, mesFiltro }: Props) {
  const [racionalAberto, setRacionalAberto] = useState<RacionalIndicador | null>(null)
  const { data: antecipacaoData, isLoading: loadingAntecip } = useQuery({
    queryKey: ['eficiencia', 'ops-antecipacao-mensal', ano],
    queryFn: () => eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
  })
  const { data: fechamentoData, isLoading: loadingFechamento } = useQuery({
    queryKey: ['eficiencia', 'ops-fechamento-mensal', ano],
    queryFn: () => eficienciaService.fetchOpsLegaisFechamentoMensal(ano),
  })
  const antecipacaoMensal: OpsLegaisAntecipacaoMesRow[] = antecipacaoData ?? []
  const fechamentoMensal: OpsLegaisFechamentoMesRow[] = fechamentoData ?? []

  const { rows: cobrancaRows, loading: loadingEfetividade } = useCobrancaKpiRows()

  const antecipFiltrado = useMemo(
    () => filtrarMensalPorMesFiltro(antecipacaoMensal, mesFiltro, ano),
    [antecipacaoMensal, mesFiltro, ano],
  )

  const fechamentoFiltrado = useMemo(
    () => filtrarMensalPorMesFiltro(fechamentoMensal, mesFiltro, ano),
    [fechamentoMensal, mesFiltro, ano],
  )

  const antecipTotais = useMemo(() => {
    const ok = antecipFiltrado.reduce((a, r) => a + Number(r.qtd_dentro_prazo ?? 0), 0)
    const nok = antecipFiltrado.reduce((a, r) => a + Number(r.qtd_fora_prazo ?? 0), 0)
    const total = ok + nok
    const pct = total > 0 ? (ok / total) * 100 : 0
    return { ok, nok, total, pct }
  }, [antecipFiltrado])

  const fechamentoTotais = useMemo(() => {
    const ok = fechamentoFiltrado.reduce((a, r) => a + Number(r.qtd_dentro_prazo ?? 0), 0)
    const nok = fechamentoFiltrado.reduce((a, r) => a + Number(r.qtd_fora_prazo ?? 0), 0)
    const total = ok + nok
    const pct = total > 0 ? (ok / total) * 100 : 0
    return { ok, nok, total, pct }
  }, [fechamentoFiltrado])

  const filtradas = useMemo(
    () => filtrarPainelEfetividade(cobrancaRows, ano, mesFiltro),
    [cobrancaRows, ano, mesFiltro],
  )
  const periodo = useMemo(() => agregarEfetividade(filtradas), [filtradas])

  const serieAno = useMemo(() => serieMensalEfetividade(cobrancaRows, ano), [cobrancaRows, ano])
  const chartEfetividade = useMemo(() => {
    return serieAno
      .filter((m) => mesNoFiltro(m.mes, mesFiltro, ano))
      .map((m) => ({
        mes: m.mes,
        valor: m.pct_efetividade,
        meta: EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
      }))
  }, [serieAno, mesFiltro, ano])

  const cobrados = periodo.cobrados_d1
  const foraOuSem = Math.max(0, periodo.total - periodo.cobrados_d1)

  const racionalResultado = useMemo(() => {
    if (racionalAberto === 'ops_legais_antecipacao_faturamento') {
      return {
        value: antecipTotais.total > 0 ? antecipTotais.pct : null,
        label: antecipTotais.total > 0 ? formatPercent(antecipTotais.pct) : '—',
      }
    }
    if (racionalAberto === 'ops_legais_fechamento') {
      return {
        value: fechamentoTotais.total > 0 ? fechamentoTotais.pct : null,
        label: fechamentoTotais.total > 0 ? formatPercent(fechamentoTotais.pct) : '—',
      }
    }
    return {
      value: periodo.total > 0 ? periodo.pct_efetividade : null,
      label: periodo.total > 0 ? formatPercent(periodo.pct_efetividade) : '—',
    }
  }, [racionalAberto, antecipTotais, fechamentoTotais, periodo])

  const racionalMeta =
    racionalAberto === 'ops_legais_antecipacao_faturamento'
      ? EFICIENCIA_META_OPS_ANTECIPACAO
      : racionalAberto === 'ops_legais_fechamento'
        ? EFICIENCIA_META_OPS_FECHAMENTO
        : EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Antecipação de Faturamento de Honorários
            </h3>
            <OverviewRacionalButton
              onClick={() => setRacionalAberto('ops_legais_antecipacao_faturamento')}
              className="w-auto"
            />
          </div>
          <EficienciaEficDesvioCard
            okLabel="Dentro do prazo"
            nokLabel="Fora do prazo"
            qtdOk={antecipTotais.ok}
            qtdNok={antecipTotais.nok}
            loading={loadingAntecip}
          />
          <div className="rounded-[10px] border border-[#E6E8EB] bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_2px_4px_rgba(15,23,42,0.06)]">
            <span className="font-semibold text-slate-800">
              {loadingAntecip ? '—' : formatPercent(antecipTotais.pct)}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              Meta {formatPercent(EFICIENCIA_META_OPS_ANTECIPACAO)} · tarefas REALIZAR
              FATURAMENTO concluídas no prazo (data limite)
            </span>
          </div>
          <EficienciaEvolucaoChart
            title="Antecipação de Faturamento"
            subtitle="% concluídas dentro do prazo ÷ total faturável (BI AntecipacaoHonorarios)"
            data={antecipFiltrado.map((m) => ({
              mes: m.mes,
              valor: Number(m.pct_antecipacao ?? 0),
            }))}
            color="#0284c7"
            metaFixa={EFICIENCIA_META_OPS_ANTECIPACAO}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Efetividade na Cobrança
            </h3>
            <OverviewRacionalButton
              onClick={() => setRacionalAberto('ops_legais_efetividade_cobranca')}
              className="w-auto"
            />
          </div>
          <EficienciaEficDesvioCard
            okLabel="Cobrados no D+1"
            nokLabel="Fora / sem cobrança"
            qtdOk={cobrados}
            qtdNok={foraOuSem}
            loading={loadingEfetividade}
          />
          <div className="rounded-[10px] border border-[#E6E8EB] bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_2px_4px_rgba(15,23,42,0.06)]">
            <span className="font-semibold text-slate-800">
              {loadingEfetividade || periodo.total === 0
                ? '—'
                : formatPercent(periodo.pct_efetividade)}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              Meta {formatPercent(EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA)} · WhatsApp D+1 ÷
              títulos em aberto
            </span>
          </div>
          <EficienciaEvolucaoChart
            title="Efetividade na Cobrança Inicial"
            subtitle="% títulos em aberto cobrados por WhatsApp no D+1 útil"
            data={chartEfetividade}
            color="#059669"
            metaFixa={EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fechamento
            </h3>
            <OverviewRacionalButton
              onClick={() => setRacionalAberto('ops_legais_fechamento')}
              className="w-auto"
            />
          </div>
          <EficienciaEficDesvioCard
            okLabel="No prazo"
            nokLabel="Fora / incompleto"
            qtdOk={fechamentoTotais.ok}
            qtdNok={fechamentoTotais.nok}
            loading={loadingFechamento}
          />
          <div className="rounded-[10px] border border-[#E6E8EB] bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_2px_4px_rgba(15,23,42,0.06)]">
            <span className="font-semibold text-slate-800">
              {loadingFechamento ? '—' : formatPercent(fechamentoTotais.pct)}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              Meta {formatPercent(EFICIENCIA_META_OPS_FECHAMENTO)} · KPI na baixa de{' '}
              <span className="font-medium">ENVIO FECHAMENTO COMPLETO E DL APURADA</span>
              {' '}· demais etapas no racional
            </span>
          </div>
          <EficienciaEvolucaoChart
            title="Fechamento"
            subtitle="% competências no prazo · jun–ago/26 histórico · set/26+ automático (VIOS)"
            data={fechamentoFiltrado.map((m) => ({
              mes: m.mes,
              valor: Number(m.pct_fechamento ?? 0),
            }))}
            color="#7c3aed"
            metaFixa={EFICIENCIA_META_OPS_FECHAMENTO}
          />
        </div>
      </div>

      <RacionalSheet
        indicador={racionalAberto}
        titulo={
          racionalAberto ? (RACIONAL_TITULOS[racionalAberto] ?? 'Racional') : 'Racional'
        }
        ano={ano}
        mes={mesFiltro}
        area={null}
        resultado={racionalResultado}
        metaAcumulado={racionalMeta}
        onClose={() => setRacionalAberto(null)}
      />
    </div>
  )
}
