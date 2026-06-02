import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MESES_ABREV } from '../constants'
import type { ReceitaMetasConfig } from '../types/receita.types'
import { parseCurrencyBr, formatCurrencyInput } from '@/shared/utils/format'
import { toast } from 'sonner'

type Props = {
  metas: ReceitaMetasConfig
  onSave: (config: ReceitaMetasConfig) => Promise<void>
  isSaving: boolean
}

function numToInput(n: number): string {
  if (!n) return ''
  return formatCurrencyInput(String(Math.round(n * 100)))
}

export function ReceitaMetasConfig({ metas, onSave, isSaving }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(metas)

  useEffect(() => {
    setForm(metas)
  }, [metas])

  const handleSave = async () => {
    try {
      await onSave(form)
      toast.success('Metas salvas no Supabase (válidas para todos os usuários)')
      setOpen(false)
    } catch {
      toast.error('Erro ao salvar metas')
    }
  }

  const setProjetadoReal = (mes: number, raw: string) => {
    const n = parseCurrencyBr(raw)
    setForm((f) => ({
      ...f,
      projetado_real: { ...f.projetado_real, [String(mes)]: n },
    }))
  }

  return (
    <Card className="rounded-xl border-slate-200/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4 text-slate-500" />
          Metas e projeções (configurável)
        </CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Ocultar' : 'Editar metas'}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 border-t border-slate-100 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="receita-ano">Ano de referência</Label>
              <Input
                id="receita-ano"
                type="number"
                min={2020}
                max={2035}
                value={form.ano}
                onChange={(e) => setForm((f) => ({ ...f, ano: Number(e.target.value) || f.ano }))}
              />
            </div>
            <div>
              <Label htmlFor="receita-meta">Meta (mensal)</Label>
              <Input
                id="receita-meta"
                value={numToInput(form.meta)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, meta: parseCurrencyBr(e.target.value) }))
                }
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="receita-base-abril">Projetado base abril (mensal)</Label>
              <Input
                id="receita-base-abril"
                value={numToInput(form.projetado_base_abril)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    projetado_base_abril: parseCurrencyBr(e.target.value),
                  }))
                }
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Meses no gráfico</Label>
            <div className="flex flex-wrap gap-2">
              {MESES_ABREV.map((label, i) => {
                const mes = i + 1
                const checked = form.meses.includes(mes)
                return (
                  <label
                    key={mes}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-sm has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      className="rounded border-slate-300"
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          meses: checked
                            ? f.meses.filter((m) => m !== mes)
                            : [...f.meses, mes].sort((a, b) => a - b),
                        }))
                      }}
                    />
                    {label}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Projetado real por mês</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {form.meses.map((mes) => (
                <div key={mes}>
                  <Label className="text-xs text-slate-500">{MESES_ABREV[mes - 1]}</Label>
                  <Input
                    value={numToInput(form.projetado_real[String(mes)] ?? 0)}
                    onChange={(e) => setProjetadoReal(mes, e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando…' : 'Salvar metas'}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
