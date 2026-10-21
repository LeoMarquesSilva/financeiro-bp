import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrencyCompact } from '@/shared/utils/format'
import type {
  ReceitaMeNovidade,
  ReceitaMeNovidadeNovo,
  ReceitaMeNovidadePagou,
} from '../utils/receitaMeCalc'
import { receitaMeMesRotulo } from '../utils/receitaMeLabels'

type Props = {
  ano: number
  novidades: ReceitaMeNovidade[]
  podeEditar: boolean
  onManter: (n: ReceitaMeNovidadeNovo) => void
  onNaoPaga: (n: ReceitaMeNovidadeNovo) => void
  onBaixarEstimativa: (n: ReceitaMeNovidadeNovo) => void
  onEntendiPagamento: (n: ReceitaMeNovidadePagou) => void
  onManterTodas: () => void
}

function mesesValores(ano: number, n: ReceitaMeNovidadeNovo): string {
  return n.meses
    .map((m) => `${receitaMeMesRotulo(ano, m.mes)} ${formatCurrencyCompact(m.incremento)}`)
    .join(', ')
}

function textoNovo(ano: number, n: ReceitaMeNovidadeNovo): string {
  const aumentouExistente = n.meses.some((m) => m.previsto - m.incremento > 1)
  if (n.duplicidade) {
    const meses = n.duplicidade.meses.map((m) => receitaMeMesRotulo(ano, m)).join(', ')
    return `Título novo de ${n.grupo} (${mesesValores(ano, n)}) bate com a nova receita "${n.duplicidade.nome}" estimada para ${meses}. Pode estar contado duas vezes.`
  }
  if (aumentouExistente) {
    return `Valor maior no VIOS para ${n.grupo}: ${mesesValores(ano, n)} a mais. Já entrou na estimativa.`
  }
  return `Título novo no VIOS: ${n.grupo}, ${mesesValores(ano, n)}. Já entrou na estimativa.`
}

function textoPagou(ano: number, n: ReceitaMeNovidadePagou): string {
  const mes = receitaMeMesRotulo(ano, n.mes)
  if (!n.houvePagamento) {
    return `O valor de ${n.grupo} em ${mes} caiu ${formatCurrencyCompact(n.reducao)} no VIOS (sem pagamento registrado). Estava como não deve pagar.`
  }
  return `${n.grupo} pagou ${formatCurrencyCompact(n.reducao)} de ${mes}, que estava como não deve pagar. Esse valor saiu do desconto sozinho.`
}

export function ReceitaMeNovidades({
  ano,
  novidades,
  podeEditar,
  onManter,
  onNaoPaga,
  onBaixarEstimativa,
  onEntendiPagamento,
  onManterTodas,
}: Props) {
  if (novidades.length === 0) return null
  const simples = novidades.filter((n) => n.tipo === 'novo' && !n.duplicidade).length

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3" aria-label="Novidades para revisar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <Bell className="h-4 w-4" aria-hidden />
          Novidades desde a confirmação ({novidades.length})
        </h3>
        {podeEditar && simples > 1 && (
          <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={onManterTodas}>
            Manter todos os títulos novos
          </Button>
        )}
      </div>
      <ul className="mt-2 divide-y divide-amber-200/70">
        {novidades.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center gap-2 py-2 text-sm text-amber-950">
            <span className="min-w-0 flex-1">{n.tipo === 'novo' ? textoNovo(ano, n) : textoPagou(ano, n)}</span>
            {podeEditar && n.tipo === 'novo' && n.duplicidade && (
              <>
                <Button type="button" size="sm" className="h-7 text-xs" onClick={() => onBaixarEstimativa(n)}>
                  Baixar estimativa
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => onManter(n)}>
                  São receitas diferentes
                </Button>
              </>
            )}
            {podeEditar && n.tipo === 'novo' && !n.duplicidade && (
              <>
                <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => onManter(n)}>
                  Manter
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs text-red-600" onClick={() => onNaoPaga(n)}>
                  Não deve pagar
                </Button>
              </>
            )}
            {podeEditar && n.tipo === 'pagou' && (
              <Button type="button" size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => onEntendiPagamento(n)}>
                Entendi
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
