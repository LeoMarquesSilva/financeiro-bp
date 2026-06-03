import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  WHATSAPP_CATEGORIAS,
  getWhatsappCategoria,
  type WhatsappChatCategoriaId,
} from '../constants/whatsappCategorias'

interface Props {
  value: string | null | undefined
  disabled?: boolean
  compact?: boolean
  showHint?: boolean
  onChange: (value: WhatsappChatCategoriaId | '') => void
}

export function WhatsappChatCategoriaSelect({
  value,
  disabled,
  compact,
  showHint,
  onChange,
}: Props) {
  const ativa = getWhatsappCategoria(value)

  return (
    <div className={cn('space-y-1', compact ? 'min-w-0' : 'w-full')}>
      <label
        className={cn(
          'flex items-center gap-1.5 font-medium text-slate-600',
          compact ? 'text-[10px] uppercase tracking-wide text-slate-400' : 'text-xs',
        )}
      >
        <Tag className={cn('shrink-0 text-slate-400', compact ? 'h-3 w-3' : 'h-4 w-4')} />
        Categoria
      </label>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as WhatsappChatCategoriaId | '')}
        className={cn(
          'w-full rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1',
          compact ? 'h-8 max-w-[11rem] px-2 text-xs' : 'h-9 px-2 text-sm',
          ativa && 'border-slate-300',
        )}
        aria-label="Categoria da conversa"
      >
        <option value="">Sem categoria</option>
        {WHATSAPP_CATEGORIAS.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.label}
          </option>
        ))}
      </select>
      {showHint && !compact && (
        <p className="text-[11px] text-slate-500">
          Conversas abertas pelo painel de cobrança recebem <strong>Cobrança</strong> automaticamente.
        </p>
      )}
    </div>
  )
}
