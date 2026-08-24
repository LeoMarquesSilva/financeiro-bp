import { useMemo, useState } from 'react'
import { Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/lib/AuthContext'
import { MESES_EFICIENCIA } from '../constants'
import { useOnboardingExclusoes } from '../hooks/useOnboardingExclusoes'
import {
  exclusaoCobreAno,
  formatPeriodoOnboarding,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
} from '../utils/onboardingExclusoes'
import { GrupoClienteCombobox } from './GrupoClienteCombobox'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  canEdit: boolean
}

const ANOS_FORM = [2025, 2026, 2027]

const SELECT_CLASS =
  'flex h-9 rounded-md border border-slate-200 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950'

export function OnboardingExclusoesDialog({ open, onOpenChange, ano, canEdit }: Props) {
  const { user } = useAuth()
  const { exclusoes, loading, create, remove } = useOnboardingExclusoes()
  const agora = new Date()
  const [grupo, setGrupo] = useState('')
  const [mesIni, setMesIni] = useState(agora.getMonth() + 1)
  const [anoIni, setAnoIni] = useState(ano)
  const [mesFim, setMesFim] = useState(agora.getMonth() + 1)
  const [anoFim, setAnoFim] = useState(ano)

  const ordenadas = useMemo(
    () =>
      [...exclusoes].sort((a, b) => {
        const anoA = exclusaoCobreAno(a, ano) ? 0 : 1
        const anoB = exclusaoCobreAno(b, ano) ? 0 : 1
        if (anoA !== anoB) return anoA - anoB
        return b.vigencia_inicio.localeCompare(a.vigencia_inicio)
      }),
    [exclusoes, ano],
  )

  const resetForm = () => {
    setGrupo('')
    setMesIni(agora.getMonth() + 1)
    setAnoIni(ano)
    setMesFim(agora.getMonth() + 1)
    setAnoFim(ano)
  }

  const handleAdd = async () => {
    const nome = grupo.trim()
    if (!nome) {
      toast.error('Escolha o grupo cliente.')
      return
    }
    const inicio = primeiroDiaDoMes(anoIni, mesIni)
    const fim = ultimoDiaDoMes(anoFim, mesFim)
    if (fim < inicio) {
      toast.error('O fim do período precisa ser igual ou posterior ao início.')
      return
    }
    try {
      await create.mutateAsync({
        grupo_cliente: nome,
        vigencia_inicio: inicio,
        vigencia_fim: fim,
        created_by: user?.id ?? null,
      })
      toast.success('Exclusão de onboarding salva. As métricas serão recalculadas.')
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await remove.mutateAsync(id)
      toast.success('Exclusão removida.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-500" />
            Exclusões por onboarding
          </DialogTitle>
          <DialogDescription>
            No período informado, o grupo sai da % de <strong>SLA Protocolo</strong>,{' '}
            <strong>Eficiência Protocolo</strong>, <strong>SLA Ciência Agendamentos</strong> e{' '}
            <strong>SLA Vistagem</strong> (risco e normal). No racional, as linhas aparecem como{' '}
            <strong>Excludente</strong>. Em Eficiência Protocolo a razão social é resolvida para o
            grupo no cadastro de clientes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(48vh,380px)] flex-1 px-6 py-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Carregando…</p>
          ) : ordenadas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nenhum grupo em onboarding. As métricas usam a carteira completa.
            </p>
          ) : (
            <ul className="space-y-2">
              {ordenadas.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{e.grupo_cliente}</p>
                    <p className="text-xs text-slate-500">
                      {formatPeriodoOnboarding(e.vigencia_inicio, e.vigencia_fim)}
                      {e.motivo ? ` · ${e.motivo}` : ''}
                    </p>
                  </div>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-500 hover:text-red-600"
                      onClick={() => void handleRemove(e.id)}
                      disabled={remove.isPending}
                      aria-label={`Remover ${e.grupo_cliente}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {canEdit ? (
          <div className="space-y-3 border-t border-slate-200 px-6 py-4">
            <p className="text-sm font-semibold text-slate-800">Incluir grupo</p>
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-grupo">Grupo</Label>
              <GrupoClienteCombobox id="onboarding-grupo" value={grupo} onChange={setGrupo} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="onboarding-ini">De</Label>
                <div className="flex gap-1.5">
                  <select
                    id="onboarding-ini"
                    className={SELECT_CLASS}
                    value={mesIni}
                    onChange={(e) => setMesIni(Number(e.target.value))}
                  >
                    {MESES_EFICIENCIA.map((label, i) => (
                      <option key={label} value={i + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={SELECT_CLASS}
                    value={anoIni}
                    onChange={(e) => setAnoIni(Number(e.target.value))}
                    aria-label="Ano inicial"
                  >
                    {ANOS_FORM.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboarding-fim">Até</Label>
                <div className="flex gap-1.5">
                  <select
                    id="onboarding-fim"
                    className={SELECT_CLASS}
                    value={mesFim}
                    onChange={(e) => setMesFim(Number(e.target.value))}
                  >
                    {MESES_EFICIENCIA.map((label, i) => (
                      <option key={label} value={i + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={SELECT_CLASS}
                    value={anoFim}
                    onChange={(e) => setAnoFim(Number(e.target.value))}
                    aria-label="Ano final"
                  >
                    {ANOS_FORM.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
            Somente administradores podem incluir ou remover exclusões.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {canEdit ? (
            <Button type="button" onClick={() => void handleAdd()} disabled={create.isPending}>
              {create.isPending ? 'Salvando…' : 'Adicionar'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
