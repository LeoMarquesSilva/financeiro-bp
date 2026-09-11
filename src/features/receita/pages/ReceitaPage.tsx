import { useEffect, useState } from 'react'
import { RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReceitaMetas } from '../hooks/useReceitaMetas'
import { useReceitaDepartamentoCores } from '../hooks/useReceitaDepartamentoCores'
import { useReceitaDashboard } from '../hooks/useReceitaDashboard'
import { ReceitaConfiguracoesSheet } from '../components/ReceitaConfiguracoesSheet'
import { ReceitaConsultaRateioDialog } from '../components/ReceitaConsultaRateioDialog'
import { ReceitaRelatorioGerencialDialog } from '../components/ReceitaRelatorioGerencialDialog'
import { ReceitaComparativoChart } from '../components/ReceitaComparativoChart'
import { ReceitaComparativoColunasChart } from '../components/ReceitaComparativoColunasChart'
import { ReceitaAcumuladoChart } from '../components/ReceitaAcumuladoChart'
import { ReceitaKpis } from '../components/ReceitaKpis'
import { ReceitaGestaoAVistaSection } from '../components/ReceitaGestaoAVistaSection'
import { ReceitaInadimplenciaSection } from '../components/ReceitaInadimplenciaSection'
import { ReceitaPageMenu } from '../components/ReceitaPageMenu'
import { PLANOS_CONTAS_INCLUIDOS_COTA, RECEITA_DEPARTAMENTO_CORES } from '../constants'
import {
  RECEITA_SECTION_IDS,
  scrollToReceitaSection,
  type ReceitaSectionId,
} from '../utils/receitaNav'

export function ReceitaPage() {
  const [configOpen, setConfigOpen] = useState(false)
  const [rateioOpen, setRateioOpen] = useState(false)
  const [relatorioOpen, setRelatorioOpen] = useState(false)
  const [abrirDetalhamento, setAbrirDetalhamento] = useState(false)
  const [pendingScrollId, setPendingScrollId] = useState<ReceitaSectionId | null>(null)
  const { metas, isLoading: metasLoading, error: metasError, refetch: refetchMetas, updateMetas, isUpdating } =
    useReceitaMetas()
  const {
    cores: departamentoCores,
    updateCores,
    isUpdating: coresUpdating,
  } = useReceitaDepartamentoCores()
  const { data, isLoading: dashLoading, error } = useReceitaDashboard(metas)

  const coresParaGrafico = departamentoCores ?? RECEITA_DEPARTAMENTO_CORES

  useEffect(() => {
    if (!pendingScrollId) return
    const ok = scrollToReceitaSection(pendingScrollId)
    if (ok) setPendingScrollId(null)
  }, [pendingScrollId, dashLoading, data, abrirDetalhamento])

  if (metasLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
      </div>
    )
  }

  if (metasError || !metas) {
    const msg =
      metasError instanceof Error
        ? metasError.message
        : 'Não foi possível carregar as metas de receita do Supabase.'
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Receita</h1>
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p className="font-medium">Metas indisponíveis</p>
          <p className="mt-1">{msg}</p>
          <p className="mt-2 text-xs text-red-700/90">
            As metas ficam em <code className="rounded bg-red-100/80 px-1">app_settings.receita_metas</code> (configuração
            global, não no navegador). Confira migrations e conexão com o Supabase.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-2" onClick={() => void refetchMetas()}>
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="sticky top-14 z-20 -mx-6 -mt-6 flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/95 px-6 py-2.5 backdrop-blur-sm lg:-mx-8 lg:px-8">
        <ReceitaPageMenu
          onNavigateSection={(id) => {
            if (id === RECEITA_SECTION_IDS.detalhamento) setAbrirDetalhamento(true)
            setPendingScrollId(id)
          }}
          onRelatorio={() => setRelatorioOpen(true)}
          onRateio={() => setRateioOpen(true)}
        />
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="group h-8 w-8 shrink-0 gap-0 overflow-hidden px-0 transition-[width,padding,gap] duration-200 hover:w-auto hover:gap-2 hover:px-3 focus-visible:w-auto focus-visible:gap-2 focus-visible:px-3"
            onClick={() => setConfigOpen(true)}
            aria-label="Configurações"
            title="Configurações"
          >
            <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[9rem] group-hover:opacity-100 group-focus-visible:max-w-[9rem] group-focus-visible:opacity-100">
              Configurações
            </span>
          </Button>
      </header>

      <ReceitaConfiguracoesSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        metas={metas}
        onSaveMetas={updateMetas}
        isSavingMetas={isUpdating}
        cores={coresParaGrafico}
        onSaveCores={updateCores}
        isSavingCores={coresUpdating}
      />
      <ReceitaConsultaRateioDialog
        open={rateioOpen}
        onOpenChange={setRateioOpen}
        ano={metas.ano}
        departamentoCores={coresParaGrafico}
      />
      <ReceitaRelatorioGerencialDialog
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        ano={metas.ano}
        departamentoCores={coresParaGrafico}
      />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar dados de receita. Verifique se a função{' '}
          <code className="rounded bg-red-100/80 px-1 text-xs">receita_totais_mensais</code> está aplicada no Supabase.
        </p>
      )}

      <div id={RECEITA_SECTION_IDS.resumo} className="scroll-mt-36">
        <ReceitaKpis rows={data?.rows ?? []} ano={data?.ano ?? metas.ano} loading={dashLoading} />
      </div>

      <div id={RECEITA_SECTION_IDS.gestaoAVista} className="scroll-mt-36">
        <ReceitaGestaoAVistaSection
          ano={metas.ano}
          rows={data?.rows ?? []}
          departamentoCores={coresParaGrafico}
          loading={dashLoading}
        />
      </div>

      <div id={RECEITA_SECTION_IDS.inadimplencia} className="scroll-mt-36">
        <ReceitaInadimplenciaSection ano={metas.ano} />
      </div>

      {dashLoading && (
        <div className="space-y-6">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
          <div className="h-96 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
        </div>
      )}

      {data && !dashLoading && (
        <>
          <div id={RECEITA_SECTION_IDS.comparativo} className="scroll-mt-36">
            <ReceitaComparativoChart
              rows={data.rows}
              ano={data.ano}
              departamentoCores={coresParaGrafico}
              abrirDetalhamento={abrirDetalhamento}
            />
          </div>
          <ReceitaComparativoColunasChart
            rows={data.rows}
            ano={data.ano}
            departamentoCores={coresParaGrafico}
          />
          <div id={RECEITA_SECTION_IDS.acumulado} className="scroll-mt-36">
            <ReceitaAcumuladoChart
              rows={data.rows}
              ano={data.ano}
              departamentoCores={coresParaGrafico}
            />
          </div>
        </>
      )}

      <details className="rounded-xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
        <summary className="cursor-pointer font-medium text-slate-700">
          Planos de contas considerados na cota
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {PLANOS_CONTAS_INCLUIDOS_COTA.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Fora da cota: parcerias, reembolsos, outras receitas, adiantamentos etc.
        </p>
      </details>
    </div>
  )
}
