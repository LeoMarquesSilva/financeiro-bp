import { TrendingUp, Cloud, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReceitaMetas } from '../hooks/useReceitaMetas'
import { useReceitaDashboard } from '../hooks/useReceitaDashboard'
import { ReceitaMetasConfig } from '../components/ReceitaMetasConfig'
import { ReceitaComparativoChart } from '../components/ReceitaComparativoChart'
import { ReceitaKpis } from '../components/ReceitaKpis'
import { PLANOS_CONTAS_INCLUIDOS_COTA } from '../constants'

export function ReceitaPage() {
  const { metas, isLoading: metasLoading, error: metasError, refetch: refetchMetas, updateMetas, isUpdating } =
    useReceitaMetas()
  const { data, isLoading: dashLoading, error } = useReceitaDashboard(metas)

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
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <TrendingUp className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
          Receita
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Metas, projeções e realizados por mês (itens financeiros — cota de honorários).
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Metas salvas globalmente no Supabase — todos os usuários veem a mesma configuração.
        </p>
      </header>

      <ReceitaMetasConfig metas={metas} onSave={updateMetas} isSaving={isUpdating} />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar dados de receita. Verifique se a função{' '}
          <code className="rounded bg-red-100/80 px-1 text-xs">receita_totais_mensais</code> está aplicada no Supabase.
        </p>
      )}

      <ReceitaKpis rows={data?.rows ?? []} ano={data?.ano ?? metas.ano} loading={dashLoading} />

      {dashLoading && (
        <div className="h-80 animate-pulse rounded-xl border border-slate-200/60 bg-slate-100" />
      )}

      {data && !dashLoading && (
        <ReceitaComparativoChart rows={data.rows} ano={data.ano} />
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
