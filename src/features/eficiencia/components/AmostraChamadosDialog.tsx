import { useEffect, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MESES_EFICIENCIA } from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import type { AmostraChamadoItem } from '../utils/amostraChamados'
import { formatPercent } from '@/shared/utils/format'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  onMesChange: (mes: number) => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function AmostraChamadosDialog({
  open,
  onOpenChange,
  ano,
  mes,
  onMesChange,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [itens, setItens] = useState<AmostraChamadoItem[]>([])
  const [populacao, setPopulacao] = useState(0)
  const [selecionado, setSelecionado] = useState<AmostraChamadoItem | null>(null)
  const [copiadoCi, setCopiadoCi] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSelecionado(null)
    void eficienciaService
      .fetchIndicadoresResultadoMes(ano, mes)
      .then((data) => {
        if (cancelled) return
        setItens(data.amostraChamados)
        setPopulacao(data.detalhesExcludentes.length)
        setSelecionado(data.amostraChamados[0] ?? null)
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Erro ao carregar amostra')
          setItens([])
          setPopulacao(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes])

  const handleCopy = async (item: AmostraChamadoItem) => {
    const ok = await copyText(item.textoChamado)
    if (ok) {
      setCopiadoCi(item.ci)
      toast.success(`Texto do CI ${item.ci} copiado`)
      window.setTimeout(() => setCopiadoCi((c) => (c === item.ci ? null : c)), 1500)
    } else {
      toast.error('Não foi possível copiar')
    }
  }

  const handleCopyAll = async () => {
    const bloco = itens.map((i) => i.textoChamado).join('\n\n---\n\n')
    const ok = await copyText(bloco)
    if (ok) toast.success(`${itens.length} textos copiados`)
    else toast.error('Não foi possível copiar')
  }

  const pct =
    populacao > 0 ? formatPercent((itens.length / populacao) * 100) : formatPercent(0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Amostra Chamados — Evidências FATAL</DialogTitle>
          <DialogDescription>
            Itens sorteados (~30% por Área × Justificativa) para abertura de chamado no
            Responsum. Copie o texto e registre o chamado manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mes-amostra-chamados">Mês</Label>
            <select
              id="mes-amostra-chamados"
              value={mes}
              onChange={(e) => onMesChange(Number(e.target.value))}
              className="flex h-9 min-w-[120px] rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              disabled={loading}
            >
              {MESES_EFICIENCIA.map((label, idx) => (
                <option key={label} value={idx + 1}>
                  {label}/{ano}
                </option>
              ))}
            </select>
          </div>
          <p className="pb-2 text-xs text-slate-500">
            {loading
              ? 'Carregando…'
              : `${itens.length} na amostra de ${populacao} excludentes (${pct})`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={loading || itens.length === 0}
            onClick={() => void handleCopyAll()}
          >
            <Copy />
            Copiar todos
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Montando amostra…
          </div>
        ) : itens.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Nenhum FATAL excludente no mês selecionado.
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">CI</th>
                    <th className="px-2 py-2">Área</th>
                    <th className="px-2 py-2">Justificativa</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itens.map((item, idx) => {
                    const ativo = selecionado?.ci === item.ci
                    return (
                      <tr
                        key={item.ci}
                        className={ativo ? 'bg-slate-100' : 'hover:bg-slate-50'}
                      >
                        <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            className="font-medium text-slate-900 underline-offset-2 hover:underline"
                            onClick={() => setSelecionado(item)}
                          >
                            {item.ci}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">{item.area}</td>
                        <td className="max-w-[140px] truncate px-2 py-1.5 text-slate-600" title={item.justificativa}>
                          {item.justificativa}
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copiar texto do chamado"
                            onClick={() => void handleCopy(item)}
                          >
                            {copiadoCi === item.ci ? (
                              <Check className="text-emerald-600" />
                            ) : (
                              <Copy />
                            )}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
              {selecionado && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      Texto — CI {selecionado.ci}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleCopy(selecionado)}
                    >
                      <Copy />
                      Copiar
                    </Button>
                  </div>
                  <pre className="max-h-[50vh] flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                    {selecionado.textoChamado}
                  </pre>
                  <p className="text-[11px] text-slate-400">
                    CNJ {selecionado.nroCnj || '—'} · {selecionado.grupoCliente || '—'} ·{' '}
                    {selecionado.responsavel || '—'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
