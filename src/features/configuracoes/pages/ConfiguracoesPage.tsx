import { useEffect, useState } from 'react'
import { Settings, BellRing } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useExibirTaxaRecuperacaoComite } from '../hooks/useExibirTaxaRecuperacaoComite'
import { usePrioridadeConfig } from '../hooks/usePrioridadeConfig'
import { useCobrancaTemplates } from '@/features/cobranca/hooks/useCobrancaTemplates'
import type { CobrancaTemplates } from '@/features/cobranca/services/cobrancaTemplatesService'
import type { PrioridadeConfig } from '@/features/inadimplencia/services/prioridade'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function ConfiguracoesPage() {
  const {
    exibirTaxaRecuperacaoComite,
    isLoading,
    setExibirTaxaRecuperacaoComite,
    isUpdating,
  } = useExibirTaxaRecuperacaoComite()

  const {
    config: prioridadeConfig,
    isLoading: prioridadeLoading,
    updateConfig: updatePrioridadeConfig,
    isUpdating: prioridadeUpdating,
  } = usePrioridadeConfig()

  const [prioridadeForm, setPrioridadeForm] = useState<PrioridadeConfig>({
    controlado_max: 2,
    atencao_min: 3,
    atencao_max: 5,
    urgente_min: 6,
  })

  const { templates, isLoading: templatesLoading, saveTemplates, isSaving: templatesSaving } =
    useCobrancaTemplates()
  const [templatesForm, setTemplatesForm] = useState<CobrancaTemplates>({
    whatsapp: '',
    emailAssunto: '',
    emailCorpo: '',
  })

  useEffect(() => {
    if (!prioridadeLoading && prioridadeConfig) {
      setPrioridadeForm(prioridadeConfig)
    }
  }, [prioridadeLoading, prioridadeConfig])

  useEffect(() => {
    if (!templatesLoading && templates) {
      setTemplatesForm(templates)
    }
  }, [templatesLoading, templates])

  const handleTemplatesSave = async () => {
    try {
      await saveTemplates(templatesForm)
      toast.success('Modelos de cobrança salvos')
    } catch {
      toast.error('Erro ao salvar modelos de cobrança')
    }
  }

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

  const handlePrioridadeChange = (field: keyof PrioridadeConfig, value: number) => {
    setPrioridadeForm((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrioridadeSave = async () => {
    const { controlado_max, atencao_min, atencao_max, urgente_min } = prioridadeForm
    if (
      controlado_max >= atencao_min ||
      atencao_min > atencao_max ||
      atencao_max >= urgente_min
    ) {
      toast.error(
        'Valores inválidos: Controlado (máx) < Atenção (mín) ≤ Atenção (máx) < Urgente (mín)'
      )
      return
    }
    try {
      await updatePrioridadeConfig(prioridadeForm)
      toast.success('Configuração de urgência salva. A prioridade dos clientes será recalculada.')
    } catch {
      toast.error('Erro ao salvar configuração de urgência')
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prioridade (urgência)</CardTitle>
          <p className="text-sm font-normal text-slate-500">
            Define os limites de <strong>dias em atraso</strong> para exibir cada nível de prioridade nos cards e no detalhe do cliente. A prioridade é calculada apenas com base nos dias; o valor em aberto não entra no cálculo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="controlado_max">Controlado (máx. dias)</Label>
              <Input
                id="controlado_max"
                type="number"
                min={0}
                value={prioridadeForm.controlado_max}
                onChange={(e) =>
                  handlePrioridadeChange('controlado_max', parseInt(e.target.value, 10) || 0)
                }
                disabled={prioridadeLoading}
              />
              <p className="text-xs text-slate-400">0 a X dias = Controlado</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="atencao_min">Atenção (mín. dias)</Label>
              <Input
                id="atencao_min"
                type="number"
                min={0}
                value={prioridadeForm.atencao_min}
                onChange={(e) =>
                  handlePrioridadeChange('atencao_min', parseInt(e.target.value, 10) || 0)
                }
                disabled={prioridadeLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="atencao_max">Atenção (máx. dias)</Label>
              <Input
                id="atencao_max"
                type="number"
                min={0}
                value={prioridadeForm.atencao_max}
                onChange={(e) =>
                  handlePrioridadeChange('atencao_max', parseInt(e.target.value, 10) || 0)
                }
                disabled={prioridadeLoading}
              />
              <p className="text-xs text-slate-400">Atenção = entre mín e máx</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="urgente_min">Urgente (mín. dias)</Label>
              <Input
                id="urgente_min"
                type="number"
                min={0}
                value={prioridadeForm.urgente_min}
                onChange={(e) =>
                  handlePrioridadeChange('urgente_min', parseInt(e.target.value, 10) || 0)
                }
                disabled={prioridadeLoading}
              />
              <p className="text-xs text-slate-400">≥ X dias = Urgente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrioridadeSave}
              disabled={prioridadeLoading || prioridadeUpdating}
            >
              {prioridadeUpdating ? 'Salvando...' : 'Salvar configuração de urgência'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-slate-600" />
            Modelos de cobrança
          </CardTitle>
          <p className="text-sm font-normal text-slate-500">
            Mensagens usadas no módulo de Cobrança. Placeholders disponíveis:{' '}
            <code className="rounded bg-slate-100 px-1">{'{{nome}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{titulo}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{descricao}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{valor}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{vencimento}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{dias_atraso}}'}</code>{' '}
            <code className="rounded bg-slate-100 px-1">{'{{usuario}}'}</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-whatsapp">Mensagem de WhatsApp</Label>
            <Textarea
              id="tpl-whatsapp"
              rows={4}
              value={templatesForm.whatsapp}
              onChange={(e) => setTemplatesForm((p) => ({ ...p, whatsapp: e.target.value }))}
              disabled={templatesLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-email-assunto">Assunto do e-mail</Label>
            <Input
              id="tpl-email-assunto"
              value={templatesForm.emailAssunto}
              onChange={(e) => setTemplatesForm((p) => ({ ...p, emailAssunto: e.target.value }))}
              disabled={templatesLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-email-corpo">Corpo do e-mail</Label>
            <Textarea
              id="tpl-email-corpo"
              rows={8}
              value={templatesForm.emailCorpo}
              onChange={(e) => setTemplatesForm((p) => ({ ...p, emailCorpo: e.target.value }))}
              disabled={templatesLoading}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleTemplatesSave} disabled={templatesLoading || templatesSaving}>
              {templatesSaving ? 'Salvando...' : 'Salvar modelos de cobrança'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
