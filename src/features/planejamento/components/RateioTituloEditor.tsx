import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSalvarRateioTitulos } from '../hooks/usePlanejamento'
import { AREAS_PLANEJAMENTO, areaNome } from '../utils/areasPlanejamento'
import { dividirIgual, normalizarPct, somaPct, validarRateio, valorPorArea, type LinhaRateio } from '../utils/rateioTitulo'
import { NumInput } from './NumInput'
import { moeda } from './PlanUi'

/**
 * Divide um título de receita sem área entre as áreas por %. Grava neste título ou em todos os
 * títulos do cliente; "Remover rateio" volta o título para a área do cliente (ou sem área).
 */
export function RateioTituloEditor({
  ciTitulo,
  rotuloTitulo,
  valorTitulo,
  inicial,
  temRateio,
  titulosCliente,
  onFechar,
}: {
  ciTitulo: number
  rotuloTitulo: string
  /** Recebido do título no ano (soma das parcelas). */
  valorTitulo: number
  inicial: LinhaRateio[]
  temRateio: boolean
  /** Títulos do cliente no ano (para gravar o mesmo rateio em todos). */
  titulosCliente: number[]
  onFechar: () => void
}) {
  const [linhas, setLinhas] = useState<LinhaRateio[]>(inicial.length ? inicial : [{ area_key: '', pct: 100 }])
  const salvar = useSalvarRateioTitulos()
  const soma = somaPct(linhas)
  const valid = validarRateio(linhas)
  const valores = valorPorArea(valorTitulo, linhas)
  const usadas = new Set(linhas.map((l) => l.area_key))

  const setLinha = (i: number, l: Partial<LinhaRateio>) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, ...l } : x)))
  const adicionar = () => {
    const livre = AREAS_PLANEJAMENTO.find((a) => !a.encerrada && !usadas.has(a.key))?.key ?? ''
    const falta = normalizarPct(100 - soma)
    setLinhas([...linhas, { area_key: livre, pct: falta > 0 ? falta : 0 }])
  }

  const gravar = async (titulos: number[], novas: LinhaRateio[], ok: string) => {
    try {
      await salvar.mutateAsync({ titulos, linhas: novas })
      toast.success(ok)
      onFechar()
    } catch (e) {
      toast.error(`Não foi possível salvar: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">
          Dividir o título {rotuloTitulo} entre áreas
          <span className="ml-1 font-normal text-slate-500">· recebido no ano {moeda(valorTitulo)}</span>
        </p>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            soma === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
          )}
        >
          Soma {soma.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
        </span>
      </div>

      <div className="space-y-1.5">
        {linhas.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={l.area_key}
              onChange={(e) => setLinha(i, { area_key: e.target.value })}
              className="h-7 w-52 rounded-md border border-slate-200 bg-white px-1.5 text-xs"
              aria-label={`Área da linha ${i + 1}`}
            >
              <option value="">Escolha a área</option>
              {AREAS_PLANEJAMENTO.map((a) => (
                <option key={a.key} value={a.key} disabled={a.key !== l.area_key && usadas.has(a.key)}>
                  {a.nome}
                </option>
              ))}
            </select>
            <NumInput
              value={l.pct}
              onChange={(v) => setLinha(i, { pct: normalizarPct(v) })}
              sufixo="%"
              min={0}
              max={100}
              className="w-24"
              ariaLabel={`Percentual de ${l.area_key ? areaNome(l.area_key) : `linha ${i + 1}`}`}
            />
            <span className="w-28 text-right text-xs tabular-nums text-slate-600">{moeda(valores[i] ?? 0)}</span>
            <button
              type="button"
              onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
              disabled={linhas.length === 1}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              aria-label="Tirar esta área"
              title="Tirar esta área"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={adicionar} disabled={linhas.length >= AREAS_PLANEJAMENTO.length}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Área
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={linhas.filter((l) => l.area_key).length < 2}
          onClick={() => setLinhas(dividirIgual(linhas.filter((l) => l.area_key).map((l) => l.area_key)))}
        >
          Dividir igualmente
        </Button>
        {!valid.ok && <span className="text-[11px] font-medium text-amber-800">{valid.motivo}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-indigo-100 pt-2">
        <Button type="button" size="sm" className="h-7 text-xs" disabled={!valid.ok || salvar.isPending} onClick={() => void gravar([ciTitulo], linhas, 'Rateio do título salvo')}>
          Salvar neste título
        </Button>
        {titulosCliente.length > 1 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!valid.ok || salvar.isPending}
            onClick={() => void gravar(titulosCliente, linhas, `Rateio salvo em ${titulosCliente.length} títulos`)}
            title="Grava o mesmo rateio em todos os títulos deste cliente no ano (substitui rateios anteriores)"
          >
            Salvar nos {titulosCliente.length} títulos do cliente
          </Button>
        )}
        {temRateio && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-600"
            disabled={salvar.isPending}
            onClick={() => void gravar([ciTitulo], [], 'Rateio removido: o título volta a seguir a área do cliente')}
          >
            Remover rateio
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
