import { useEffect, useMemo, useState } from 'react'
import { Palette, RotateCcw } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  RECEITA_DEPARTAMENTO_CORES,
  RECEITA_DEPARTAMENTO_LABELS,
} from '../constants'
import type { ReceitaDepartamentoCoresConfig } from '../types/receita.types'
import { toast } from 'sonner'

type Props = {
  cores: ReceitaDepartamentoCoresConfig
  onSave: (config: ReceitaDepartamentoCoresConfig) => Promise<void>
  isSaving: boolean
  onSaved?: () => void
}

function labelForKey(key: string): string {
  return (
    RECEITA_DEPARTAMENTO_LABELS[key] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function normalizeHexInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (withHash.length === 7) return withHash.toLowerCase()
  return withHash.slice(0, 7).toLowerCase()
}

export function ReceitaDepartamentoCoresConfig({ cores, onSave, isSaving, onSaved }: Props) {
  const [form, setForm] = useState(cores)

  const sortedKeys = useMemo(
    () =>
      Object.keys(form).sort((a, b) =>
        labelForKey(a).localeCompare(labelForKey(b), 'pt-BR'),
      ),
    [form],
  )

  useEffect(() => {
    setForm(cores)
  }, [cores])

  const setColor = (key: string, hex: string) => {
    const normalized = normalizeHexInput(hex)
    if (normalized.length !== 7) return
    setForm((f) => ({ ...f, [key]: normalized }))
  }

  const resetKey = (key: string) => {
    const def = RECEITA_DEPARTAMENTO_CORES[key]
    if (!def) return
    setForm((f) => ({ ...f, [key]: def }))
  }

  const resetAll = () => {
    setForm({ ...RECEITA_DEPARTAMENTO_CORES })
    toast.message('Cores restauradas para o padrão (clique em Salvar para gravar)')
  }

  const handleSave = async () => {
    try {
      await onSave(form)
      toast.success('Cores das áreas salvas no Supabase (válidas para todos os usuários)')
      onSaved?.()
    } catch {
      toast.error('Erro ao salvar cores das áreas')
    }
  }

  return (
    <section className="space-y-4 border-t border-slate-200 pt-8">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Palette className="h-4 w-4 text-slate-500" aria-hidden />
          Cores por área (departamento)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Cor de cada departamento no gráfico &quot;Recebido por área&quot;.
        </p>
      </div>
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Salvo em{' '}
          <code className="rounded bg-slate-100 px-1">app_settings.receita_departamento_cores</code>.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedKeys.map((key) => {
              const hex = form[key] ?? RECEITA_DEPARTAMENTO_CORES[key] ?? '#64748b'
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2"
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded-md border border-white shadow-sm ring-1 ring-slate-200"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <Label className="truncate text-xs font-medium text-slate-800">
                      {labelForKey(key)}
                    </Label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => setColor(key, e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        aria-label={`Cor de ${labelForKey(key)}`}
                      />
                      <Input
                        className="h-8 font-mono text-xs"
                        value={hex}
                        onChange={(e) => setColor(key, e.target.value)}
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-400"
                    title="Restaurar cor padrão"
                    onClick={() => resetKey(key)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar cores'}
          </Button>
          <Button type="button" variant="outline" onClick={resetAll}>
            Restaurar todos os padrões
          </Button>
        </div>
      </div>
    </section>
  )
}
