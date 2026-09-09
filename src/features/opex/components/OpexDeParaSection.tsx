import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useOpexDashboard } from '../hooks/useOpexDashboard'
import { useOpexGrupoDePara } from '../hooks/useOpexGrupoDePara'

const SELECT_CLASS =
  'flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

type Props = {
  anoDestino: number
}

function gruposDoDashboard(grupos?: Array<{ grupo_conta: string }>): string[] {
  return [...new Set((grupos ?? []).map((g) => g.grupo_conta.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
}

export function OpexDeParaSection({ anoDestino }: Props) {
  const [expandido, setExpandido] = useState(false)
  const [anoOrigem, setAnoOrigem] = useState(anoDestino - 1)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [salvandoNome, setSalvandoNome] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setAnoOrigem(anoDestino - 1)
  }, [anoDestino])

  const anosOrigem = useMemo(
    () => [anoDestino - 1, anoDestino - 2, anoDestino - 3].filter((y) => y >= 2024),
    [anoDestino],
  )

  const origemValida = anoOrigem < anoDestino
  const { data: dashOrigem, isLoading: loadingOrigem } = useOpexDashboard(anoOrigem, [], undefined, {
    enabled: origemValida,
  })
  const { data: dashDestino, isLoading: loadingDestino } = useOpexDashboard(anoDestino, [], undefined, {
    enabled: origemValida,
  })
  const { data: mapeamentos, isLoading: loadingMap, upsert, remove } = useOpexGrupoDePara(
    anoOrigem,
    anoDestino,
  )

  const gruposOrigem = useMemo(() => gruposDoDashboard(dashOrigem?.grupos), [dashOrigem])
  const gruposDestino = useMemo(() => gruposDoDashboard(dashDestino?.grupos), [dashDestino])
  const destinoSet = useMemo(() => new Set(gruposDestino), [gruposDestino])
  const mapPorOrigem = useMemo(
    () => new Map((mapeamentos ?? []).map((m) => [m.nomeOrigem, m])),
    [mapeamentos],
  )

  const linhas = useMemo(() => {
    const nomes = new Set([...gruposOrigem, ...mapPorOrigem.keys()])
    return [...nomes]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((nomeOrigem) => {
        const map = mapPorOrigem.get(nomeOrigem)
        const existeNoDestino = destinoSet.has(nomeOrigem)
        return {
          nomeOrigem,
          mapeamento: map ?? null,
          existeNoDestino,
          precisaMapear: !existeNoDestino && !map,
        }
      })
  }, [gruposOrigem, mapPorOrigem, destinoSet])

  const pendentes = linhas.filter((l) => l.precisaMapear).length
  const linhasVisiveis = mostrarTodos
    ? linhas
    : linhas.filter((l) => l.precisaMapear || l.mapeamento)

  const gravar = async (nomeOrigem: string, nomeDestino: string) => {
    setErro(null)
    const atual = mapPorOrigem.get(nomeOrigem)
    if (!nomeDestino) {
      if (!atual) return
      setSalvandoNome(nomeOrigem)
      try {
        await remove.mutateAsync(atual.id)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao remover o De × Para.')
      } finally {
        setSalvandoNome(null)
      }
      return
    }
    if (atual?.nomeDestino === nomeDestino) return
    setSalvandoNome(nomeOrigem)
    try {
      await upsert.mutateAsync({
        id: atual?.id,
        anoOrigem,
        nomeOrigem,
        anoDestino,
        nomeDestino,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gravar o De × Para.')
    } finally {
      setSalvandoNome(null)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        className="flex w-full flex-wrap items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50/80 sm:px-5"
      >
        <div className="flex min-w-0 items-start gap-2">
          {expandido ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <ArrowRightLeft className="h-4 w-4 text-slate-600" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">De × Para — anos anteriores</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cruza o nome antigo do grupo com o de {anoDestino}, para a comparação YoY somar no lugar certo.
            </p>
            {pendentes > 0 && (
              <p className="mt-1 text-xs text-amber-800">
                {pendentes} categoria{pendentes > 1 ? 's' : ''} de {anoOrigem} sem destino em {anoDestino}.
              </p>
            )}
            {pendentes === 0 && (mapeamentos?.length ?? 0) > 0 && (
              <p className="mt-1 text-xs text-emerald-700">
                {mapeamentos?.length} mapeamento{(mapeamentos?.length ?? 0) > 1 ? 's' : ''} gravado
                {(mapeamentos?.length ?? 0) > 1 ? 's' : ''}.
              </p>
            )}
          </div>
        </div>
      </button>

      {expandido && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="opex-de-para-ano-origem" className="text-[11px] text-slate-500">
                Ano de origem (De)
              </Label>
              <select
                id="opex-de-para-ano-origem"
                value={anoOrigem}
                onChange={(e) => setAnoOrigem(Number(e.target.value))}
                className={cn(SELECT_CLASS, 'w-28')}
              >
                {anosOrigem.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <p className="pb-2 text-xs text-slate-500">
              Para = nomenclatura de <strong>{anoDestino}</strong>. Categorias com o mesmo nome nos dois anos não
              precisam de linha.
            </p>
          </div>

          {erro && (
            <p className="text-xs text-red-600" role="alert">
              {erro}
            </p>
          )}

          {(loadingOrigem || loadingDestino || loadingMap) && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Carregando categorias…
            </p>
          )}

          {!loadingOrigem && !loadingDestino && !loadingMap && linhasVisiveis.length === 0 && (
            <p className="text-xs text-slate-500">
              {linhas.length === 0
                ? `Sem grupos em ${anoOrigem} para mapear.`
                : `Todas as categorias de ${anoOrigem} já existem em ${anoDestino} com o mesmo nome.`}
            </p>
          )}

          {linhas.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMostrarTodos((v) => !v)}
                className="text-[11px] font-medium text-slate-600 underline-offset-2 hover:underline"
              >
                {mostrarTodos
                  ? 'Mostrar só o que precisa de De × Para'
                  : `Mostrar todas (${linhas.length}) para forçar um destino`}
              </button>
            </div>
          )}

          {linhasVisiveis.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3 font-medium">De ({anoOrigem})</th>
                    <th className="pb-2 pr-3 font-medium">Para ({anoDestino})</th>
                    <th className="w-10 pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {linhasVisiveis.map((linha) => (
                    <tr key={linha.nomeOrigem} className="border-b border-slate-50 align-top">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-slate-800">{linha.nomeOrigem}</span>
                        {linha.precisaMapear && (
                          <span className="mt-0.5 block text-[10px] text-amber-800">Só existe em {anoOrigem}</span>
                        )}
                        {linha.existeNoDestino && !linha.mapeamento && (
                          <span className="mt-0.5 block text-[10px] text-slate-400">Mesmo nome — opcional</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          aria-label={`Destino de ${linha.nomeOrigem}`}
                          value={linha.mapeamento?.nomeDestino ?? ''}
                          disabled={salvandoNome === linha.nomeOrigem}
                          onChange={(e) => void gravar(linha.nomeOrigem, e.target.value)}
                          className={SELECT_CLASS}
                        >
                          <option value="">
                            {linha.existeNoDestino ? 'Manter o mesmo nome' : 'Selecione o grupo atual…'}
                          </option>
                          {gruposDestino.map((grupo) => (
                            <option key={grupo} value={grupo}>
                              {grupo}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        {linha.mapeamento && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-700"
                            disabled={salvandoNome === linha.nomeOrigem}
                            onClick={() => void gravar(linha.nomeOrigem, '')}
                            aria-label={`Remover mapeamento de ${linha.nomeOrigem}`}
                          >
                            {salvandoNome === linha.nomeOrigem ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
