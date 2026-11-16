import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Crosshair, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { receitaMeService } from '../services/receitaMeService'
import { RECEITA_ME_QUERY_KEY, useReceitaMeAcesso, useReceitaMeResponsaveis } from '../hooks/useReceitaMe'
import { RECEITA_ME_AREAS, receitaMeAreaLabel } from '../utils/receitaMeLabels'
import type { ReceitaMeResponsavel } from '../types/receitaMe.types'
import { ReceitaConfigCollapsibleSection } from './ReceitaConfigCollapsibleSection'

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2'

type Props = {
  /** Só consulta Supabase quando o sheet de configurações está aberto. */
  enabled?: boolean
}

/** Gerentes que preenchem a melhor estimativa de cada área. Só quem edita todas as áreas altera. */
export function ReceitaMeResponsaveisConfig({ enabled = true }: Props) {
  const { editorGeral } = useReceitaMeAcesso()
  const qc = useQueryClient()
  const { data, isLoading } = useReceitaMeResponsaveis(enabled && editorGeral)
  const [form, setForm] = useState({ area_key: RECEITA_ME_AREAS[0].key, nome: '', email: '' })
  const [salvando, setSalvando] = useState(false)

  if (!editorGeral) return null

  const recarregar = () => qc.invalidateQueries({ queryKey: RECEITA_ME_QUERY_KEY })

  const executar = async (fn: () => Promise<void>, ok: string) => {
    setSalvando(true)
    try {
      await fn()
      await recarregar()
      toast.success(ok)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const incluir = () => {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error('Informe nome e e-mail do responsável')
      return
    }
    void executar(async () => {
      await receitaMeService.saveResponsavel({ ...form, ativo: true })
      setForm((f) => ({ ...f, nome: '', email: '' }))
    }, 'Responsável incluído')
  }

  const alternarAtivo = (r: ReceitaMeResponsavel) =>
    void executar(() => receitaMeService.saveResponsavel({ ...r, ativo: !r.ativo }), r.ativo ? 'Responsável desativado' : 'Responsável reativado')

  const remover = (r: ReceitaMeResponsavel) => {
    if (!window.confirm(`Remover ${r.nome} dos responsáveis de ${receitaMeAreaLabel(r.area_key)}?`)) return
    void executar(() => receitaMeService.deleteResponsavel(r.id), 'Responsável removido')
  }

  const lista = data ?? []
  const ativos = lista.filter((r) => r.ativo).length

  return (
    <ReceitaConfigCollapsibleSection
      icon={<Crosshair className="h-4 w-4 text-slate-500" aria-hidden />}
      title="Responsáveis pela melhor estimativa"
      description="Quem preenche a melhor estimativa de cada área. O responsável edita só a própria área; admin e Controladoria editam todas."
      summary={isLoading ? 'Carregando…' : `${ativos} responsáveis ativos`}
    >
      <div className="space-y-4 pt-3">
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {RECEITA_ME_AREAS.map((area) => {
            const daArea = lista.filter((r) => r.area_key === area.key)
            return (
              <li key={area.key} className="px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{receitaMeAreaLabel(area.key)}</p>
                {daArea.length === 0 ? (
                  <p className="mt-1 text-sm text-amber-700">Sem responsável: só admin e Controladoria conseguem preencher.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {daArea.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={r.ativo}
                          onCheckedChange={() => alternarAtivo(r)}
                          disabled={salvando}
                          aria-label={`${r.nome} ativo`}
                        />
                        <span className={r.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}>{r.nome}</span>
                        <span className="text-xs text-slate-500">{r.email}</span>
                        <button
                          type="button"
                          className="ml-auto rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => remover(r)}
                          disabled={salvando}
                          aria-label={`Remover ${r.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="me-resp-area">Área</Label>
            <select
              id="me-resp-area"
              className={SELECT_CLASS}
              value={form.area_key}
              onChange={(e) => setForm((f) => ({ ...f, area_key: e.target.value }))}
            >
              {RECEITA_ME_AREAS.map((a) => (
                <option key={a.key} value={a.key}>
                  {receitaMeAreaLabel(a.key)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="me-resp-nome">Nome</Label>
            <Input id="me-resp-nome" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Daniel Pressatto Fernandes" />
          </div>
          <div>
            <Label htmlFor="me-resp-email">E-mail</Label>
            <Input
              id="me-resp-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="daniel@bismarchipires.com.br"
            />
          </div>
          <Button type="button" variant="outline" onClick={incluir} disabled={salvando}>
            Incluir
          </Button>
        </div>
      </div>
    </ReceitaConfigCollapsibleSection>
  )
}
