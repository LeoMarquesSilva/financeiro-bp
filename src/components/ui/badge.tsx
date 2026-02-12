import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-slate-900 text-slate-50',
        secondary:
          'border-slate-200 bg-slate-100 text-slate-700',
        destructive:
          'border-transparent bg-red-50 text-red-600 border-red-200',
        outline: 'text-slate-950 border-slate-200',
        // Classe (inadimplência): A = bom, B = atenção, C = crítico
        classeA: 'border-blue-200 bg-blue-50 text-blue-700',
        classeB: 'border-amber-200 bg-amber-50 text-amber-700',
        classeC: 'border-red-200 bg-red-50 text-red-600',
        // Prioridade: urgente, atenção, controlado
        urgente: 'border-red-200 bg-red-50 text-red-600',
        atencao: 'border-amber-200 bg-amber-50 text-amber-700',
        controlado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
