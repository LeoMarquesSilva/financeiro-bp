import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>')
  return ctx
}

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const current = value ?? internal
  const setValue = React.useCallback(
    (v: string) => {
      if (value === undefined) setInternal(v)
      onValueChange?.(v)
    },
    [value, onValueChange],
  )
  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-sm',
        className,
      )}
      {...props}
    />
  ),
)
TabsList.displayName = 'TabsList'

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: current, setValue } = useTabs()
    const active = current === value
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        className={cn(
          'inline-flex min-h-[36px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all',
          active
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
            : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
TabsTrigger.displayName = 'TabsTrigger'

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: current } = useTabs()
    if (current !== value) return null
    return <div ref={ref} role="tabpanel" className={className} {...props} />
  },
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
