import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReceitaMeOrdenacao } from '../utils/receitaMeCalc'

type Props<K extends string | number> = {
  chave: K
  ordenacao: ReceitaMeOrdenacao<K> | null
  onOrdenar: (chave: K) => void
  alinhamento?: 'esquerda' | 'direita'
  rowSpan?: number
  title?: string
  children: React.ReactNode
}

/** Cabeçalho de tabela que ordena ao clicar (seta mostra coluna e direção ativas). */
export function ReceitaMeCabecalhoOrdenavel<K extends string | number>({
  chave,
  ordenacao,
  onOrdenar,
  alinhamento = 'direita',
  rowSpan,
  title,
  children,
}: Props<K>) {
  const ativo = ordenacao?.chave === chave
  const Icone = !ativo ? ArrowUpDown : ordenacao.direcao === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      rowSpan={rowSpan}
      className={cn(
        'px-3 py-2 font-semibold',
        alinhamento === 'direita' ? 'text-right' : 'text-left',
        rowSpan && rowSpan > 1 && 'align-bottom',
      )}
      aria-sort={ativo ? (ordenacao.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={title}
    >
      <button
        type="button"
        onClick={() => onOrdenar(chave)}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider transition-colors hover:text-slate-900',
          alinhamento === 'direita' && 'flex-row-reverse',
          ativo && 'text-slate-900',
        )}
      >
        {children}
        <Icone className={cn('h-3 w-3 shrink-0', ativo ? 'text-slate-700' : 'text-slate-300')} aria-hidden />
      </button>
    </th>
  )
}
