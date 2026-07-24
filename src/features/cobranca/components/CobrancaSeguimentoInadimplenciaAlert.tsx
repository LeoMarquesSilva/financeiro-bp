import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/shared/utils/format'
import type { CobrancaSeguimentoGrupoAcima60 } from '../types/cobrancaSeguimento.types'

type Props = {
  grupos: CobrancaSeguimentoGrupoAcima60[]
  valorTotal: number
  qtdTitulos: number
  loading?: boolean
  onRevisar: () => void
}

const MAX_LISTADOS = 5

export function CobrancaSeguimentoInadimplenciaAlert({
  grupos,
  valorTotal,
  qtdTitulos,
  loading,
  onRevisar,
}: Props) {
  if (loading || grupos.length === 0) return null

  const listados = grupos.slice(0, MAX_LISTADOS)
  const restantes = grupos.length - listados.length

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 shadow-sm sm:flex-row sm:items-start">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-semibold text-amber-950">
            {grupos.length === 1
              ? '1 grupo com títulos vencidos há mais de 60 dias'
              : `${grupos.length} grupos com títulos vencidos há mais de 60 dias`}{' '}
            fora do Comitê de Inadimplência
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
            Após 60 dias de atraso, o grupo sai deste painel de seguimento e deve ser incluído no{' '}
            <strong>Comitê de Inadimplência</strong>. Revise a listagem completa de grupos e
            títulos e inclua no comitê por aqui.
          </p>
          <p className="mt-1 text-xs text-amber-800/85">
            {qtdTitulos} título{qtdTitulos !== 1 ? 's' : ''} · {formatCurrency(valorTotal)} em aberto
          </p>
        </div>

        <ul className="space-y-1">
          {listados.map((g) => (
            <li key={g.grupo_chave} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-medium text-amber-950">{g.grupo_chave}</span>
              <span className="text-amber-800/80">
                {g.max_dias_atraso} dias · {formatCurrency(g.valor_total)} · {g.qtd_titulos} título
                {g.qtd_titulos !== 1 ? 's' : ''}
              </span>
            </li>
          ))}
          {restantes > 0 && (
            <li className="text-xs text-amber-800/75">+ {restantes} grupo{restantes !== 1 ? 's' : ''}</li>
          )}
        </ul>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
        onClick={onRevisar}
      >
        Revisar no Comitê
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  )
}
