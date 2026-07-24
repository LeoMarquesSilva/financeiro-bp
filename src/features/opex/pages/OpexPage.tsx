import { useEffect, useState } from 'react'
import { RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOpexDashboard } from '../hooks/useOpexDashboard'
import { OpexKpis } from '../components/OpexKpis'
import { OpexPrevistoRealizadoChart } from '../components/OpexPrevistoRealizadoChart'
import { OpexProjecaoFixas } from '../components/OpexProjecaoFixas'
import { OpexGruposTable } from '../components/OpexGruposTable'
import { OpexDepartamentosChart } from '../components/OpexDepartamentosChart'
import { OpexMetasEstrategicas } from '../components/OpexMetasEstrategicas'
import { OpexOrcamentoSection } from '../components/OpexOrcamentoSection'
import { OpexPeriodoSelector } from '../components/OpexPeriodoSelector'
import { OpexPlanoContasFiltro } from '../components/OpexPlanoContasFiltro'
import { formatPeriodoOpex, temFiltroMeses } from '../utils/opexPeriodo'
import { loadOpexPlanoFiltro, type OpexPlanoFiltroState } from '../utils/opexPlanoFiltro'

const ANOS = [2025, 2026, 2027]

export function OpexPage() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mesesFiltro, setMesesFiltro] = useState<number[]>([])
  const [soFixas, setSoFixas] = useState(false)
  const [planoFiltro, setPlanoFiltro] = useState<OpexPlanoFiltroState>(() => loadOpexPlanoFiltro(ano))
  const [sortGruposVariacaoTrigger, setSortGruposVariacaoTrigger] = useState(0)
  const { data, isLoading, error, refetch, isFetching } = useOpexDashboard(ano, mesesFiltro, planoFiltro)

  useEffect(() => {
    setPlanoFiltro(loadOpexPlanoFiltro(ano))
  }, [ano])

  const handleOrdenarGruposPorVariacao = () => {
    setSortGruposVariacaoTrigger((n) => n + 1)
    document.getElementById('opex-grupos-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleAnoChange = (y: number) => {
    setAno(y)
    setMesesFiltro([])
  }

  const mesAtual = data?.mes_atual ?? (new Date().getFullYear() === ano ? new Date().getMonth() + 1 : 12)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Wallet className="h-6 w-6 shrink-0 text-rose-700" aria-hidden />
            OPEX
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Despesas operacionais — orçamento congelado x realizado (VIOS) e projeção de fixas.
          </p>
          <OpexPlanoContasFiltro ano={ano} filtro={planoFiltro} onChange={setPlanoFiltro} />
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              {ANOS.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleAnoChange(y)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    ano === y ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
              Atualizar
            </Button>
          </div>
          <OpexPeriodoSelector
            mesesFiltro={mesesFiltro}
            mesAtual={data?.mes_atual ?? mesAtual}
            onChange={setMesesFiltro}
          />
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar OPEX. Verifique se a função{' '}
          <code className="rounded bg-red-100/80 px-1 text-xs">opex_dashboard</code> está aplicada no Supabase.
        </p>
      )}

      <OpexOrcamentoSection ano={ano} />

      <OpexKpis
        kpis={data?.kpis ?? {
          realizado_ytd: 0,
          previsto_ytd: 0,
          previsto_vios_ytd: 0,
          previsto_ano: 0,
          previsto_vios_ano: 0,
          projetado_ano: 0,
          media_mensal_fixas: 0,
          variancia_ytd_pct: 0,
        }}
        ano={ano}
        mesAtual={data?.mes_atual ?? 0}
        mesesFiltro={mesesFiltro}
        orcamentoImportado={data?.orcamento_importado}
        loading={isLoading}
      />

      {data && (
        <>
          <OpexPrevistoRealizadoChart
            rows={data.evolucao}
            mesAtual={data.mes_atual}
            ano={data.ano}
            mesesFiltro={mesesFiltro}
            orcamentoImportado={data.orcamento_importado}
            onOrdenarPorVariacao={handleOrdenarGruposPorVariacao}
            planoFiltro={planoFiltro}
          />

          {!temFiltroMeses(mesesFiltro) && (
            <OpexProjecaoFixas grupos={data.grupos} kpis={data.kpis} mesAtual={data.mes_atual} />
          )}

          <OpexGruposTable
            grupos={data.grupos}
            ano={data.ano}
            mesesFiltro={mesesFiltro}
            soFixas={soFixas}
            orcamentoImportado={data.orcamento_importado}
            onSoFixasChange={setSoFixas}
            sortByVariacaoTrigger={sortGruposVariacaoTrigger}
            planoFiltro={planoFiltro}
            chartSlot={
              <OpexDepartamentosChart
                ano={data.ano}
                mesesFiltro={mesesFiltro}
                somenteFixas={soFixas}
                mesAtual={data.mes_atual}
                orcamentoImportado={data.orcamento_importado}
              />
            }
          />
        </>
      )}

      <OpexMetasEstrategicas ano={ano} />

      {isLoading && (
        <div className="space-y-6">
          <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        <strong>Orçamento:</strong> previsão orçamentária congelada (importada ou editada no painel acima).{' '}
        <strong>Previsto VIOS:</strong> títulos lançados por vencimento — comparativo operacional.{' '}
        <strong>Realizado:</strong> pagamentos efetuados.{' '}
        {temFiltroMeses(mesesFiltro) ? (
          <>
            Exibindo período <strong>{formatPeriodoOpex(mesesFiltro, data?.mes_atual ?? 0, ano)}</strong>. Clique em
            um mês no gráfico para detalhar por grupo de conta.
          </>
        ) : (
          <>
            <strong>Projeção fixas:</strong> média mensal das categorias fixas aplicada aos meses restantes, somada ao
            já comprometido em aberto.
          </>
        )}{' '}
        Exclui distribuição de lucros, sócios e investimentos.
      </p>
    </div>
  )
}
