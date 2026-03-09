import { Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useExibirTaxaRecuperacaoComite } from '../hooks/useExibirTaxaRecuperacaoComite'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ConfiguracoesPage() {
  const {
    exibirTaxaRecuperacaoComite,
    isLoading,
    setExibirTaxaRecuperacaoComite,
    isUpdating,
  } = useExibirTaxaRecuperacaoComite()

  const handleToggle = async () => {
    try {
      await setExibirTaxaRecuperacaoComite(!exibirTaxaRecuperacaoComite)
      toast.success(
        exibirTaxaRecuperacaoComite
          ? 'Taxa de recuperação ocultada para todos os usuários'
          : 'Taxa de recuperação exibida para todos os usuários'
      )
    } catch {
      toast.error('Erro ao atualizar configuração')
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          <Settings className="h-7 w-7 shrink-0 text-slate-600" />
          Configurações
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          Configurações globais da aplicação. Apenas administradores podem alterar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inadimplência</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">Exibir Taxa de recuperação do comitê</Label>
              <p className="text-sm text-slate-500">
                Controla a visibilidade da Taxa de recuperação (desde 05/02/2026) para usuários, comitê e financeiro.
                A fórmula da conta ainda está em validação.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={exibirTaxaRecuperacaoComite}
              disabled={isLoading || isUpdating}
              onClick={handleToggle}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                exibirTaxaRecuperacaoComite ? 'bg-emerald-600' : 'bg-slate-200'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
                  exibirTaxaRecuperacaoComite ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {exibirTaxaRecuperacaoComite ? 'Ativado' : 'Desativado'} – {exibirTaxaRecuperacaoComite ? 'todos veem o KPI e a seção no Dashboard.' : 'apenas % Recuperação do mês é exibido.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
