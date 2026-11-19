import { useEffect, useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ModalConfirmacao } from '@/components/ui/modal-confirmacao'
import { MESES_NOME } from '@/features/receita/constants'
import { useDlFecharMes, useDlFechamentos, useDlReabrirMes } from '../hooks/useDl'
import type { DlFechamento } from '../types/dl.types'

type Props = {
  ano: number
}

/** Último mês já terminado do ano (só ele e os anteriores podem ser fechados). */
function ultimoMesEncerrado(ano: number, hoje = new Date()): number {
  if (ano < hoje.getFullYear()) return 12
  if (ano > hoje.getFullYear()) return 0
  return hoje.getMonth()
}

export function DlFechamentoBar({ ano }: Props) {
  const { data } = useDlFechamentos(ano)
  const fechamentos: DlFechamento[] = data ?? []
  const fechar = useDlFecharMes(ano)
  const reabrir = useDlReabrirMes(ano)
  const ultimoFechado = Math.max(0, ...fechamentos.map((f) => f.mes))
  const encerrado = ultimoMesEncerrado(ano)
  const opcoes = Array.from({ length: Math.max(0, encerrado - ultimoFechado) }, (_, i) => ultimoFechado + 1 + i)
  const [alvo, setAlvo] = useState(opcoes[opcoes.length - 1] ?? 0)
  const [confirmar, setConfirmar] = useState<'fechar' | 'reabrir' | null>(null)

  useEffect(() => {
    setAlvo(opcoes[opcoes.length - 1] ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoFechado, encerrado])

  const ultimo = fechamentos.find((f) => f.mes === ultimoFechado)
  const nome = (m: number) => MESES_NOME[m - 1]?.toLowerCase() ?? ''
  const periodo =
    alvo > ultimoFechado + 1 ? `${nome(ultimoFechado + 1)} a ${nome(alvo)}/${ano}` : `${nome(alvo)}/${ano}`

  const onFechar = async () => {
    try {
      const n = await fechar.mutateAsync({ mes: alvo, observacao: null })
      toast.success(n === 1 ? 'Mês fechado.' : `${n} meses fechados.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao fechar o mês')
    }
  }

  const onReabrir = async () => {
    try {
      await reabrir.mutateAsync(ultimoFechado)
      toast.success(`${MESES_NOME[ultimoFechado - 1]} reaberto.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reabrir o mês')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-xs shadow-sm">
      <p className="flex items-center gap-2 text-slate-600">
        <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {ultimoFechado > 0 ? (
          <span>
            Fechado até <span className="font-semibold text-slate-900">{nome(ultimoFechado)}/{ano}</span>
            {ultimo && (
              <span className="text-slate-400">
                {' '}
                · em {new Date(ultimo.fechado_em).toLocaleDateString('pt-BR')}
                {ultimo.fechado_por ? ` por ${ultimo.fechado_por}` : ''}
              </span>
            )}
          </span>
        ) : (
          <span>Nenhum mês de {ano} fechado. Os valores são recalculados com o VIOS de hoje.</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {opcoes.length > 0 && (
          <>
            <label className="inline-flex items-center gap-1.5 font-medium text-slate-600">
              Fechar até
              <select
                value={alvo}
                onChange={(e) => setAlvo(Number(e.target.value))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800"
              >
                {opcoes.map((m) => (
                  <option key={m} value={m}>
                    {MESES_NOME[m - 1]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setConfirmar('fechar')} disabled={fechar.isPending}>
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Fechar
            </Button>
          </>
        )}
        {ultimoFechado > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setConfirmar('reabrir')}
            disabled={reabrir.isPending}
          >
            <LockOpen className="h-3.5 w-3.5" aria-hidden />
            Reabrir {nome(ultimoFechado)}
          </Button>
        )}
      </div>

      <ModalConfirmacao
        open={confirmar === 'fechar'}
        onClose={() => setConfirmar(null)}
        title={`Fechar ${periodo}?`}
        description="O SIOE grava a foto do DL desses meses (áreas e gestores). Depois disso, o que mudar no VIOS para esses meses não altera o valor fechado: a diferença entra como ajuste no DL do próximo mês. Confira a alíquota do imposto de cada mês antes de fechar."
        confirmLabel="Fechar"
        onConfirm={onFechar}
      />
      <ModalConfirmacao
        open={confirmar === 'reabrir'}
        onClose={() => setConfirmar(null)}
        title={`Reabrir ${nome(ultimoFechado)}/${ano}?`}
        description="A foto do mês é apagada e os valores voltam a ser recalculados com o VIOS de hoje. Use só para corrigir um fechamento feito antes da hora."
        confirmLabel="Reabrir"
        variant="destructive"
        onConfirm={onReabrir}
      />
    </div>
  )
}
