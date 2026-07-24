import { useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
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

export function CobrancaSeguimentoInadimplenciaAlert({
  grupos,
  valorTotal,
  qtdTitulos,
  loading,
  onRevisar,
}: Props) {
  const [expandido, setExpandido] = useState(false)

  if (loading || grupos.length === 0) return null

  const titulo =
    grupos.length === 1
      ? '1 grupo com títulos vencidos há mais de 60 dias fora do Comitê de Inadimplência'
      : `${grupos.length} grupos com títulos vencidos há mais de 60 dias fora do Comitê de Inadimplência`

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 shadow-sm">
      <div className="flex gap-3 sm:items-start">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-amber-950">{titulo}</p>
              <p className="mt-1 text-xs text-amber-800/85">
                {qtdTitulos} título{qtdTitulos !== 1 ? 's' : ''} · {formatCurrency(valorTotal)} em
                aberto
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-amber-950 hover:bg-amber-100 hover:text-amber-950"
                onClick={() => setExpandido((v) => !v)}
                aria-expanded={expandido}
              >
                {expandido ? (
                  <>
                    Recolher
                    <ChevronUp className="ml-1 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Expandir
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-amber-300 bg-white text-amber-950 hover:bg-amber-100"
                onClick={onRevisar}
              >
                Revisar no Comitê
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>

          {expandido && (
            <>
              <p className="text-sm leading-relaxed text-amber-900/90">
                Após 60 dias de atraso, o grupo sai da Inadimplência Pontual e deve ser incluído no{' '}
                <strong>Comitê de Inadimplência</strong>. Revise a listagem completa de grupos e
                títulos e inclua no comitê por aqui.
              </p>

              <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {grupos.map((g) => (
                  <li
                    key={g.grupo_chave}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
                  >
                    <span className="font-medium text-amber-950">{g.grupo_chave}</span>
                    <span className="text-amber-800/80">
                      {g.max_dias_atraso} dias · {formatCurrency(g.valor_total)} · {g.qtd_titulos}{' '}
                      título{g.qtd_titulos !== 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
