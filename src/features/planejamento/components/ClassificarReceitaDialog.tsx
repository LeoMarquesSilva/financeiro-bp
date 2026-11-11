import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/shared/utils/format'
import { useClassificarCliente, usePlanReceitaSemArea } from '../hooks/usePlanejamento'
import { AREAS_PLANEJAMENTO, areaNome } from '../utils/areasPlanejamento'
import { moeda } from './PlanUi'
import { ClienteTitulosDetalhe } from './ClienteTitulosDetalhe'

/**
 * Receita sem área (departamento VIOS fora das áreas, ex.: Facilities, Financeiro, BP em 2025):
 * a pessoa escolhe a área de cada cliente. Vale para todos os títulos do cliente fora das áreas.
 */
export function ClassificarReceitaDialog({ ano, open, onOpenChange }: { ano: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, isLoading, error } = usePlanReceitaSemArea(ano, open)
  const classificar = useClassificarCliente()
  const [salvando, setSalvando] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const linhas = useMemo(() => data ?? [], [data])
  const total = linhas.reduce((s, l) => s + l.total, 0)
  const pendente = linhas.filter((l) => !l.area_key).reduce((s, l) => s + l.total, 0)

  const escolher = async (cliente: string, areaKey: string | null) => {
    setSalvando(cliente)
    try {
      await classificar.mutateAsync({ cliente, areaKey })
    } catch (e) {
      toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSalvando(null)
    }
  }

  const aplicarSugestoes = async () => {
    const alvo = linhas.filter((l) => !l.area_key && l.sugestao_area_key)
    for (const l of alvo) {
      // Sequencial: poucas linhas e cada uma registra quem classificou.
      await escolher(l.cliente, l.sugestao_area_key)
    }
    toast.success(`${alvo.length} cliente(s) classificados pela sugestão`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Classificar receita sem área — {ano}</DialogTitle>
          <DialogDescription>
            Títulos de honorários recebidos em departamentos que não são área (Facilities, Financeiro, BP…). Escolha a área de cada
            cliente; a escolha vale para todos os títulos dele fora das áreas e muda a receita, a margem e o crescimento por área.
            A sugestão é a área onde o mesmo cliente mais pagou de 2025 em diante. Clique no cliente para ver os títulos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Total sem área no VIOS: <strong>{moeda(total)}</strong> · ainda sem classificação: <strong>{moeda(pendente)}</strong>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={classificar.isPending || !linhas.some((l) => !l.area_key && l.sugestao_area_key)}
            onClick={() => void aplicarSugestoes()}
          >
            Aplicar sugestões nos pendentes
          </Button>
        </div>
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
          {isLoading ? (
            <div className="h-40 animate-pulse bg-slate-50" />
          ) : error ? (
            <p className="p-4 text-sm text-red-700">{error instanceof Error ? error.message : 'Erro ao carregar'}</p>
          ) : linhas.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Nenhuma receita sem área em {ano}.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Cliente</th>
                  <th className="px-2 py-1.5 text-left font-medium">Departamento no VIOS</th>
                  <th className="px-2 py-1.5 text-right font-medium">Recebido</th>
                  <th className="px-2 py-1.5 text-left font-medium">Sugestão</th>
                  <th className="px-2 py-1.5 text-left font-medium">Área escolhida</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Fragment key={l.cliente}>
                  <tr className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-800">
                      <button
                        type="button"
                        onClick={() => setAberto(aberto === l.cliente ? null : l.cliente)}
                        className="inline-flex items-start gap-1 text-left hover:text-indigo-700"
                        aria-expanded={aberto === l.cliente}
                        title="Ver os títulos deste cliente"
                      >
                        {aberto === l.cliente ? (
                          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        <span>
                          {l.cliente}
                          <span className="ml-1 text-slate-400">({l.titulos})</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">{l.departamentos_vios}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{moeda(l.total)}</td>
                    <td className="px-2 py-1.5 text-slate-500">{l.sugestao_area_key ? areaNome(l.sugestao_area_key) : '—'}</td>
                    <td className="px-2 py-1.5">
                      <select
                        value={l.area_key ?? ''}
                        disabled={salvando === l.cliente}
                        onChange={(e) => void escolher(l.cliente, e.target.value || null)}
                        className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs"
                        title={
                          l.classificado_por_email
                            ? `Classificado por ${l.classificado_por_email} em ${formatDateTime(l.classificado_em)}`
                            : undefined
                        }
                      >
                        <option value="">Sem área</option>
                        {AREAS_PLANEJAMENTO.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {aberto === l.cliente && (
                    <tr>
                      {/* max-w-0: a tabela de títulos rola dentro da célula sem alargar a tabela de clientes. */}
                      <td colSpan={5} className="max-w-0 p-0">
                        <ClienteTitulosDetalhe ano={ano} cliente={l.cliente} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
