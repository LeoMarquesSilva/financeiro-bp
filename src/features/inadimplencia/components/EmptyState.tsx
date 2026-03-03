import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileQuestion, Plus, RotateCcw } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'

interface EmptyStateProps {
  hasActiveFilters: boolean
  onNovoCliente: () => void
  onLimparFiltros: () => void
}

export function EmptyState({ hasActiveFilters, onNovoCliente, onLimparFiltros }: EmptyStateProps) {
  const { role } = useAuth()
  const canEdit = role === 'admin' || role === 'financeiro'

  return (
    <Card className="border-slate-200">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-slate-100 p-4">
          <FileQuestion className="h-10 w-10 text-slate-400" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-slate-900">
            {hasActiveFilters
              ? 'Nenhum resultado com os filtros aplicados'
              : 'Nenhum cliente inadimplente'}
          </p>
          <p className="text-sm text-slate-500">
            {hasActiveFilters
              ? 'Tente alterar os filtros ou limpar para ver todos os clientes.'
              : canEdit
                ? 'Inclua um inadimplente no comitê selecionando o grupo do cliente.'
                : 'Não há clientes inadimplentes no momento.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canEdit && (
            <Button type="button" onClick={onNovoCliente} className="gap-2">
              <Plus className="h-4 w-4" />
              Incluir Inadimplente no Comitê
            </Button>
          )}
          {hasActiveFilters && (
            <Button type="button" variant="outline" onClick={onLimparFiltros} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
