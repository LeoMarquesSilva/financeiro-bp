import { useEffect, useMemo, useState } from 'react'
import { HandCoins, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { MESES_NOME } from '@/features/receita/constants'
import { ReceitaResultadoCaixaSection } from '@/features/receita/components/ReceitaResultadoCaixaSection'
import { useDlAreas, useDlGestorMensal, useDlGestores, useDlResultado } from '../hooks/useDl'
import { DlDemonstrativoTable } from '../components/DlDemonstrativoTable'
import { DlResumoAreas } from '../components/DlResumoAreas'
import { DlParametros } from '../components/DlParametros'
import type { DlArea, DlGestor, DlMesRow } from '../types/dl.types'
import { DL_REFERENCIA_GERAL, calcularDemonstrativo, dlGestorPorArea, intervaloMeses, mesAtualDl } from '../utils/dlCalc'

const ANOS = [2026, 2027]

function MesSelect({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (m: number) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
      >
        {MESES_NOME.slice(0, max).map((nome, i) => (
          <option key={nome} value={i + 1}>
            {nome}
          </option>
        ))}
      </select>
    </label>
  )
}

export function DlPage() {
  const [ano, setAno] = useState(Math.max(new Date().getFullYear(), ANOS[0]!))
  const mesAtual = mesAtualDl(ano)
  const [de, setDe] = useState(1)
  const [ate, setAte] = useState(mesAtual)
  const [aba, setAba] = useState('geral')
  const [areaSel, setAreaSel] = useState('civel')

  useEffect(() => {
    setDe(1)
    setAte(mesAtualDl(ano))
  }, [ano])

  const { data: areasData, error: erroAreas } = useDlAreas()
  const { data: rowsData, isLoading, error, refetch, isFetching } = useDlResultado(ano)
  const { data: gestoresData } = useDlGestores(ano)
  const { data: gestorMesData, error: erroGestor } = useDlGestorMensal(ano)
  const areas: DlArea[] = useMemo(() => areasData ?? [], [areasData])
  const rows: DlMesRow[] = useMemo(() => rowsData ?? [], [rowsData])
  const gestores: DlGestor[] = useMemo(() => gestoresData ?? [], [gestoresData])
  const dlGestor = useMemo(() => dlGestorPorArea(gestores, gestorMesData ?? []), [gestores, gestorMesData])

  const meses = useMemo(() => intervaloMeses(de, ate), [de, ate])
  const mesParcial = ano === new Date().getFullYear() ? mesAtual : null
  const areaInfo = areas.find((a) => a.area_key === areaSel)

  const geral = useMemo(
    () => calcularDemonstrativo(rows, areas.map((a) => a.area_key), meses, dlGestor),
    [rows, areas, meses, dlGestor],
  )
  const porArea = useMemo(
    () => calcularDemonstrativo(rows, [areaSel], meses, dlGestor),
    [rows, areaSel, meses, dlGestor],
  )

  const erro = error ?? erroAreas ?? erroGestor

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <HandCoins className="h-6 w-6 shrink-0 text-amber-700" aria-hidden />
            DL — Distribuição de Lucros
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Fechamento por área calculado direto do SIOE (VIOS), base caixa: receita, despesas, rateios e DL dos gestores.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              {ANOS.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setAno(y)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    ano === y ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
              Atualizar
            </Button>
          </div>
          {aba !== 'caixa' && aba !== 'parametros' && (
            <div className="flex flex-wrap items-center gap-3">
              <MesSelect label="De" value={de} max={mesAtual} onChange={setDe} />
              <MesSelect label="Até" value={ate} max={mesAtual} onChange={setAte} />
            </div>
          )}
        </div>
      </header>

      {erro && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Erro ao carregar o DL: {erro instanceof Error ? erro.message : 'verifique a função dl_resultado_mensal no Supabase'}.
        </p>
      )}

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="inline-flex h-auto flex-row flex-wrap items-stretch gap-0.5 p-1">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="area">Por área</TabsTrigger>
          <TabsTrigger value="caixa">Resultado de caixa</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <>
              <DlResumoAreas
                areas={areas}
                rows={rows}
                meses={meses}
                dlGestor={dlGestor}
                onSelecionarArea={(k) => {
                  setAreaSel(k)
                  setAba('area')
                }}
              />
              <DlDemonstrativoTable
                titulo="DL mensal — escritório"
                subtitulo="Soma das áreas jurídicas. Despesas de sócios (Gustavo e Ricardo) e repasses ficam fora."
                meses={geral}
                referencia={DL_REFERENCIA_GERAL}
                mesParcial={mesParcial}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="area" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => (
              <button
                key={a.area_key}
                type="button"
                onClick={() => setAreaSel(a.area_key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  areaSel === a.area_key
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                {a.nome}
              </button>
            ))}
          </div>
          {isLoading ? (
            <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <DlDemonstrativoTable
              titulo={`DL mensal — ${areaInfo?.nome ?? areaSel}`}
              subtitulo={
                gestores.filter((g) => g.area_key === areaSel).length > 0
                  ? `Gestores: ${gestores
                      .filter((g) => g.area_key === areaSel)
                      .map((g) => `${g.nome} ${g.pct.toLocaleString('pt-BR')}%`)
                      .join(' · ')}`
                  : 'Sem gestor com DL cadastrado'
              }
              meses={porArea}
              referencia={areaInfo?.referencia_mercado ?? null}
              mesParcial={mesParcial}
            />
          )}
        </TabsContent>

        <TabsContent value="caixa" className="mt-4">
          <ReceitaResultadoCaixaSection ano={ano} />
        </TabsContent>

        <TabsContent value="parametros" className="mt-4">
          {areas.length > 0 && <DlParametros ano={ano} areas={areas} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
