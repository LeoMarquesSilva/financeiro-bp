import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, indeterminate = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked || indeterminate
            ? 'border-slate-900 bg-slate-900 text-slate-50'
            : 'border-slate-300 bg-white hover:border-slate-400',
          className,
        )}
        {...props}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" strokeWidth={3} />
        ) : checked ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : null}
      </button>
    )
  },
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
