import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useReceitaMetas } from '../hooks/useReceitaMetas'
import { useReceitaDashboard } from '../hooks/useReceitaDashboard'
import {
  useReceitaMeAcesso,
  useReceitaMeDados,
  useReceitaMeMutations,
  useReceitaMeResponsaveis,
} from '../hooks/useReceitaMe'
import { calcularAreaMe, montarMesAMes, type ReceitaMeAreaCalc } from '../utils/receitaMeCalc'
import { RECEITA_ME_AREAS, RECEITA_ME_OUTRAS_KEY, receitaMeAreaLabel } from '../utils/receitaMeLabels'
import { ReceitaMeAreaPanel } from '../components/ReceitaMeAreaPanel'
import { ReceitaMeEscritorioPanel } from '../components/ReceitaMeEscritorioPanel'
import { ReceitaMeHistoricoPanel } from '../components/ReceitaMeHistoricoPanel'

type Aba = 'area' | 'escritorio' | 'historico'

export function ReceitaMelhorEstimativaPage() {
  const { metas, isLoading: metasLoading } = useReceitaMetas()
  const { data: dashboard } = useReceitaDashboard(metas)
  const acesso = useReceitaMeAcesso()
  const ano = metas?.ano
  const dados = useReceitaMeDados(ano)
  const responsaveis = useReceitaMeResponsaveis()
  const mutations = useReceitaMeMutations(ano ?? 0)

  const [aba, setAba] = useState<Aba>('area')
  const [areaKey, setAreaKey] = useState<string | null>(null)

  useEffect(() => {
    if (areaKey || acesso.isLoading) return
    setAreaKey(acesso.minhasAreas[0] ?? RECEITA_ME_AREAS[0].key)
  }, [areaKey, acesso.isLoading, acesso.minhasAreas])

  /** Áreas visíveis: escritório vê todas; gerente sem perfil da Receita vê só as suas. */
  const areasVisiveis = useMemo(
    () =>
      acesso.podeVerEscritorio
        ? RECEITA_ME_AREAS.map((a) => a.key)
        : RECEITA_ME_AREAS.map((a) => a.key).filter((k) => acesso.minhasAreas.includes(k)),
    [acesso.podeVerEscritorio, acesso.minhasAreas],
  )

  const calcs = useMemo(() => {
    const out: Record<string, ReceitaMeAreaCalc> = {}
    if (!dados.base) return out
    for (const key of [...RECEITA_ME_AREAS.map((a) => a.key), RECEITA_ME_OUTRAS_KEY]) {
      out[key] = calcularAreaMe({
        areaKey: key,
        meses: dados.meses,
        mesCorrente: dados.mesCorrente,
        previstos: dados.base.previstos,
        recebidos: dados.base.recebidos,
        ajustes: dados.ajustes,
        novasReceitas: dados.novasReceitas,
        vistos: dados.vistos,
        confirmada: Boolean(dados.status.find((s) => s.area_key === key)?.confirmada_em),
      })
    }
    return out
  }, [dados.base, dados.meses, dados.mesCorrente, dados.ajustes, dados.novasReceitas, dados.vistos, dados.status])

  /**
   * Metas do SIOE por mês (Jun–Dez), como na Gestão à vista: `variavel` é a meta do mês
   * rebalanceada (o que faltou nos meses fechados vai para os seguintes); `base` é a
   * meta anual fixa, usada no acumulado e no gap.
   */
  const { metaBasePorMes, metaVariavelPorMes } = useMemo(() => {
    const base: Record<number, number> = {}
    const variavel: Record<number, number> = {}
    for (const r of dashboard?.rows ?? []) {
      if (r.metaBase <= 0) continue
      base[r.mes] = r.metaBase
      variavel[r.mes] = r.meta > 0 ? r.meta : r.metaBase
    }
    return { metaBasePorMes: base, metaVariavelPorMes: variavel }
  }, [dashboard?.rows])
  const mesesMeta = useMemo(
    () => Object.keys(metaBasePorMes).map(Number).sort((a, b) => a - b),
    [metaBasePorMes],
  )

  const mesAMesArea = useMemo(() => {
    if (!areaKey || !calcs[areaKey]) return []
    const pct = RECEITA_ME_AREAS.find((a) => a.key === areaKey)?.pct ?? 0
    const daArea = (porMes: Record<number, number>) =>
      Object.fromEntries(mesesMeta.map((m) => [m, ((porMes[m] ?? 0) * pct) / 100]))
    return montarMesAMes({
      mesesMeta,
      metaPorMes: daArea(metaVariavelPorMes),
      metaBasePorMes: daArea(metaBasePorMes),
      realizadoPorMes: dados.realizadoPorArea?.[areaKey] ?? {},
      mePorMes: calcs[areaKey].mePorMes,
      mesesHorizonte: dados.meses,
    })
  }, [areaKey, calcs, mesesMeta, metaBasePorMes, metaVariavelPorMes, dados.realizadoPorArea, dados.meses])

  if (metasLoading || !ano) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
  }

  const calcArea = areaKey ? calcs[areaKey] : undefined
  const novidadesPorArea = (key: string) => calcs[key]?.novidades.length ?? 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {acesso.podeVerEscritorio && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/financeiro/receita">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Receita
              </Link>
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">Melhor estimativa</h1>
            <p className="text-sm text-slate-500">
              Receita que cada área espera até dezembro: carteira do VIOS, ajustes do gerente e novas receitas.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => void dados.refetchBase()}
          title="Recarregar carteira e caixa do VIOS"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Atualizar
        </Button>
      </header>

      {dados.error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar a melhor estimativa.{' '}
          {dados.error instanceof Error ? dados.error.message : ''}
        </p>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="space-y-5">
        {acesso.podeVerEscritorio && (
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="area">Por área</TabsTrigger>
              <TabsTrigger value="escritorio">Escritório</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
          </div>
        )}

        <TabsContent value="area" className="space-y-5">
          {areasVisiveis.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Área">
              {areasVisiveis.map((key) => {
                const n = novidadesPorArea(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAreaKey(key)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      areaKey === key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {receitaMeAreaLabel(key)}
                    {acesso.minhasAreas.includes(key) && (
                      <span className={cn('text-[10px] uppercase tracking-wide', areaKey === key ? 'text-slate-300' : 'text-slate-400')}>
                        sua
                      </span>
                    )}
                    {n > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white">
                        {n}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {dados.isLoading || !calcArea || !areaKey ? (
            <div className="space-y-4">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <ReceitaMeAreaPanel
              ano={ano}
              calc={calcArea}
              status={dados.status.find((s) => s.area_key === areaKey)}
              responsaveis={(responsaveis.data ?? []).filter((r) => r.area_key === areaKey)}
              novasReceitas={dados.novasReceitas}
              mesAMes={mesAMesArea}
              podeEditar={acesso.podeEditar(areaKey)}
              mutations={mutations}
            />
          )}
        </TabsContent>

        {acesso.podeVerEscritorio && (
          <TabsContent value="escritorio">
            {dados.isLoading || !dashboard || Object.keys(calcs).length === 0 ? (
              <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <ReceitaMeEscritorioPanel
                ano={ano}
                calcs={calcs}
                meses={dados.meses}
                mesCorrente={dados.mesCorrente}
                mesesMeta={mesesMeta}
                metaBasePorMes={metaBasePorMes}
                metaVariavelPorMes={metaVariavelPorMes}
                dashboardRows={dashboard.rows}
                realizadoPorArea={dados.realizadoPorArea ?? {}}
                status={dados.status}
                responsaveis={responsaveis.data ?? []}
                onAbrirArea={(key) => {
                  setAreaKey(key)
                  setAba('area')
                }}
              />
            )}
          </TabsContent>
        )}

        {acesso.podeVerEscritorio && (
          <TabsContent value="historico">
            <ReceitaMeHistoricoPanel ano={ano} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
