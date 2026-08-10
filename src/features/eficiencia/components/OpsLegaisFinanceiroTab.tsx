import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatPercent } from '@/shared/utils/format'
import {
  EFICIENCIA_META_OPS_ANTECIPACAO,
  EFICIENCIA_META_OPS_EFETIVIDADE_COBRANCA,
  filtrarMensalPorMesFiltro,
  mesNoFiltro,
  type MesFiltroEficiencia,
} from '../constants'
import { useCobrancaKpiRows } from '@/features/cobranca/hooks/useWhatsapp'
import { eficienciaService } from '../services/eficienciaService'
import type { OpsLegaisAntecipacaoMesRow } from '../types/eficiencia.types'
import {
  agregarEfetividade,
  filtrarPainelEfetividade,
  serieMensalEfetividade,
} from '../utils/opsEfetividadeCobranca'
import { EficienciaEficDesvioCard } from './EficienciaEficDesvioCard'
import { EficienciaEvolucaoChart } from './EficienciaEvolucaoChart'

type Props = {
  ano: number
  mesFiltro: MesFiltroEficiencia
}

export function OpsLegaisFinanceiroTab({ ano, mesFiltro }: Props) {
  const { data: antecipacaoData, isLoading: loadingAntecip } = useQuery({
    queryKey: ['eficiencia', 'ops-antecipacao-mensal', ano],
    queryFn: () => eficienciaService.fetchOpsLegaisAntecipacaoMensal(ano),
  })
  const antecipacaoMensal: OpsLegaisAntecipacaoMesRow[] = antecipacaoData ?? []

  const { rows: cobrancaRows, loading: loadingEfetividade } = useCobrancaKpiRows()

  const antecipFiltrado = useMemo(
    () => filtrarMensalPorMesFiltro(antecipacaoMensal, mesFiltro, ano),
    [antecipacaoMensal, mesFiltro, ano],
  )

  const antecipTotais = useMemo(() => {
    const ok = antecipFiltrado.reduce((a, r) => a + Number(r.qtd_dentro_prazo ?? 0), 0)
    const nok = antecipFiltrado.reduce((a, r) => a + Number(r.qtd_fora_prazo ?? 0), 0)
    const total = ok + nok
    const pct = total > 0 ? (ok / total) * 100 : 0
    return { ok, nok, total, pct }
  }, [antecipFiltrado])

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Antecipação de Faturamento de Honorários
          </h3>
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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Efetividade na Cobrança
          </h3>
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
      </div>
    </div>
  )
}
