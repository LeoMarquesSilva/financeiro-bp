import { useState } from 'react'
import { TrendingUp, Cloud, RefreshCw, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useReceitaMetas } from '../hooks/useReceitaMetas'
import { useReceitaDepartamentoCores } from '../hooks/useReceitaDepartamentoCores'
import { useReceitaDashboard } from '../hooks/useReceitaDashboard'
import { ReceitaConfiguracoesSheet } from '../components/ReceitaConfiguracoesSheet'
import { ReceitaComparativoChart } from '../components/ReceitaComparativoChart'
import { ReceitaComparativoColunasChart } from '../components/ReceitaComparativoColunasChart'
import { ReceitaAcumuladoChart } from '../components/ReceitaAcumuladoChart'
import { ReceitaKpis } from '../components/ReceitaKpis'
import { ReceitaInadimplenciaSection } from '../components/ReceitaInadimplenciaSection'
import {
  PLANOS_CONTAS_INCLUIDOS_COTA,
  RECEITA_COLORS,
  RECEITA_DEPARTAMENTO_CORES,
} from '../constants'

export function ReceitaPage() {
  const [configOpen, setConfigOpen] = useState(false)
  const { metas, isLoading: metasLoading, error: metasError, refetch: refetchMetas, updateMetas, isUpdating } =
    useReceitaMetas()
  const {
    cores: departamentoCores,
    updateCores,
    isUpdating: coresUpdating,
  } = useReceitaDepartamentoCores()
  const { data, isLoading: dashLoading, error } = useReceitaDashboard(metas)

  const coresParaGrafico = departamentoCores ?? RECEITA_DEPARTAMENTO_CORES

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <TrendingUp className={cn('h-6 w-6 shrink-0', RECEITA_COLORS.meta.text)} aria-hidden />
            Receita
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Metas, projeções e realizados por mês (itens financeiros — cota de honorários).
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Metas e cores das áreas salvas globalmente no Supabase — todos os usuários veem a mesma configuração.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 self-start"
          onClick={() => setConfigOpen(true)}
        >
          <Settings2 className="h-4 w-4" aria-hidden />
          Configurações
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

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar dados de receita. Verifique se a função{' '}
          <code className="rounded bg-red-100/80 px-1 text-xs">receita_totais_mensais</code> está aplicada no Supabase.
        </p>
      )}

      <ReceitaKpis rows={data?.rows ?? []} ano={data?.ano ?? metas.ano} loading={dashLoading} />

      <ReceitaInadimplenciaSection ano={metas.ano} />

      {dashLoading && (
        <div className="space-y-6">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
          <div className="h-96 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
        </div>
      )}

      {data && !dashLoading && (
        <>
          <ReceitaComparativoChart rows={data.rows} ano={data.ano} />
          <ReceitaComparativoColunasChart
            rows={data.rows}
            ano={data.ano}
            departamentoCores={coresParaGrafico}
          />
          <ReceitaAcumuladoChart
            rows={data.rows}
            ano={data.ano}
            departamentoCores={coresParaGrafico}
          />
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
