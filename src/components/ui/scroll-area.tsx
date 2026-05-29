import * as React from 'react'
import { cn } from '@/lib/utils'

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent]',
      className,
    )}
    {...props}
  >
    {children}
  </div>
))
ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
