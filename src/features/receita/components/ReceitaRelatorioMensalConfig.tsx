import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, GripVertical, Mail, Plus, Send, Trash2, Users } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/lib/AuthContext'
import { teamMembersService } from '@/lib/teamMembersService'
import type { TeamMember } from '@/lib/database.types'
import { RECEITA_META_CONTRIBUICAO_AREA, RECEITA_DEPARTAMENTO_LABELS } from '../constants'
import { useRelatorioMensalConfig } from '../hooks/useRelatorioMensalConfig'
import {
  buildDestinatariosPadrao,
  groupDestinatariosPorArea,
} from '../utils/relatorioMensalDestinatarios'
import {
  SECOES_ORDEM_DEFAULT,
  type RelatorioMensalConfig,
  type RelatorioMensalDestinatario,
  type RelatorioMensalLogEntry,
  type RelatorioMensalSecoes,
  type RelatorioSecaoKey,
} from '../services/relatorioMensalService'
import { toast } from 'sonner'
import { formatDate } from '@/shared/utils/format'
import { ReceitaConfigCollapsibleSection } from './ReceitaConfigCollapsibleSection'

const SECAO_LABELS: Record<keyof RelatorioMensalSecoes, string> = {
  indicadores_operacionais: 'Indicadores operacionais (tabela)',
  receita_visao_mes: 'Gestão à vista — previsto, recebido, meta, inad.',
  receita_composicao: 'Composição do recebido (até ontem)',
  receita_inad_grupos: 'Inad. por grupo — top 5 (até ontem)',
  receita_grafico_resumo: 'Resumo mensal — gráfico (removido do e-mail)',
  eficiencia_overview: 'Overview eficiência (KPIs)',
}

/** Seções configuráveis na UI (resumo mensal não entra no e-mail). */
type RelatorioSecaoUiKey = Exclude<RelatorioSecaoKey, 'receita_grafico_resumo'>
const SECOES_UI: RelatorioSecaoUiKey[] = SECOES_ORDEM_DEFAULT.filter(
  (k): k is RelatorioSecaoUiKey => k !== 'receita_grafico_resumo',
)

type DestForm = {
  id?: string
  nome: string
  email: string
  area_key: string
  ativo: boolean
}

const emptyDest = (): DestForm => ({ nome: '', email: '', area_key: 'insolvencia', ativo: true })

type Props = {
  /** Só consulta Supabase quando o sheet de configurações está aberto. */
  enabled?: boolean
}

export function ReceitaRelatorioMensalConfig({ enabled = true }: Props) {
  const { user, role, loading: authLoading } = useAuth()
  const userEmail = user?.email ?? null
  const isAdmin = role === 'admin'
  const {
    config,
    destinatarios,
    log,
    isLoading,
    isError,
    error,
    saveConfig,
    saveDestinatario,
    deleteDestinatario,
    replaceDestinatarios,
    enviar,
  } = useRelatorioMensalConfig(enabled && isAdmin)

  const usuariosQuery = useQuery({
    queryKey: ['team_members', 'relatorio-mensal'],
    queryFn: () => teamMembersService.list(),
    enabled: enabled && isAdmin,
  })

  const usuariosAtivos = useMemo(
    () => (usuariosQuery.data ?? []).filter((u: TeamMember) => u.is_active !== false),
    [usuariosQuery.data],
  )

  const destinatariosPorArea = useMemo(
    () => groupDestinatariosPorArea(destinatarios),
    [destinatarios],
  )

  const [form, setForm] = useState<RelatorioMensalConfig | null>(null)
  const [destForm, setDestForm] = useState<DestForm>(emptyDest())
  const [enviando, setEnviando] = useState<'manual' | 'teste' | null>(null)

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  if (authLoading) {
    return null
  }

  if (!isAdmin) {
    return null
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : 'Erro ao carregar configuração'
    return (
      <ReceitaConfigCollapsibleSection
        icon={<Mail className="h-4 w-4 text-slate-500" aria-hidden />}
        title="Envio automático de e-mail"
        description="Gestão à vista diária via Microsoft Graph. Somente administradores."
        summary="Erro ao carregar"
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Configuração indisponível</p>
          <p className="mt-1 text-xs">{msg}</p>
          <p className="mt-2 text-xs text-amber-800/90">
            Confira se a migração{' '}
            <code className="rounded bg-amber-100/80 px-1">20260813180000_receita_relatorio_mensal</code>{' '}
            foi aplicada no Supabase e se seu usuário é admin ativo.
          </p>
        </div>
      </ReceitaConfigCollapsibleSection>
    )
  }

  if (isLoading || !form) {
    return (
      <ReceitaConfigCollapsibleSection
        icon={<Mail className="h-4 w-4 text-slate-500" aria-hidden />}
        title="Envio automático de e-mail"
        description="Gestão à vista diária via Microsoft Graph. Somente administradores."
        summary="Carregando…"
      >
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      </ReceitaConfigCollapsibleSection>
    )
  }

  const handleSave = async () => {
    try {
      await saveConfig.mutateAsync(form)
      toast.success('Configuração de envio automático salva')
    } catch {
      toast.error('Erro ao salvar configuração')
    }
  }

  const toggleSecao = (key: keyof RelatorioMensalSecoes, checked: boolean) => {
    setForm((f) => f && { ...f, secoes: { ...f.secoes, [key]: checked } })
  }

  const moveSecao = (key: RelatorioSecaoUiKey, direction: -1 | 1) => {
    setForm((f) => {
      if (!f) return f
      const ordemUi = f.secoes_ordem.filter((k) => k !== 'receita_grafico_resumo')
      const index = ordemUi.indexOf(key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= ordemUi.length) return f
      const next = [...f.secoes_ordem]
      const a = ordemUi[index]!
      const b = ordemUi[target]!
      const ia = next.indexOf(a)
      const ib = next.indexOf(b)
      ;[next[ia], next[ib]] = [next[ib], next[ia]]
      return { ...f, secoes_ordem: next }
    })
  }

  const handleAddDest = async () => {
    if (!destForm.email.trim()) {
      toast.error('Informe o e-mail do destinatário')
      return
    }
    try {
      await saveDestinatario.mutateAsync({
        id: destForm.id ?? crypto.randomUUID(),
        nome: destForm.nome.trim() || destForm.email.trim(),
        email: destForm.email.trim(),
        area_key: destForm.area_key || null,
        ativo: destForm.ativo,
      })
      setDestForm(emptyDest())
      toast.success('Destinatário salvo')
    } catch {
      toast.error('Erro ao salvar destinatário')
    }
  }

  const handleAplicarPadrao = async () => {
    if (
      !window.confirm(
        'Substituir todos os destinatários pela lista padrão?\n\n' +
          '• Liderança (Samuel, Gustavo, Ricardo, Felipe) em cada área meta\n' +
          '• Gerente de cada área (RH)',
      )
    ) {
      return
    }
    try {
      await replaceDestinatarios.mutateAsync(buildDestinatariosPadrao())
      toast.success('Destinatários padrão aplicados')
    } catch {
      toast.error('Erro ao aplicar destinatários padrão')
    }
  }

  const handleEditDest = (d: RelatorioMensalDestinatario) => {
    setDestForm({
      id: d.id,
      nome: d.nome,
      email: d.email,
      area_key: d.area_key ?? '',
      ativo: d.ativo,
    })
  }

  const handleEnviar = async (modo: 'manual' | 'teste') => {
    setEnviando(modo)
    try {
      const res = await enviar.mutateAsync({
        modo,
        emailTeste: modo === 'teste' ? userEmail ?? undefined : undefined,
      })
      if (res.enviados === res.total) {
        toast.success(modo === 'teste' ? 'E-mail de teste enviado' : 'Relatório enviado')
      } else {
        toast.warning(`Enviados ${res.enviados}/${res.total}. Verifique o histórico.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha no envio')
    } finally {
      setEnviando(null)
    }
  }

  const ultimoLog = log[0]

  return (
    <ReceitaConfigCollapsibleSection
      icon={<Mail className="h-4 w-4 text-slate-500" aria-hidden />}
      title="Envio automático de e-mail"
      description="Gestão à vista diária: recorte do mês corrente (dia 1 até ontem) — receita e eficiência — via Microsoft Graph. Somente administradores."
      summary={`${form.enabled ? 'Ativo' : 'Inativo'} · ${form.hora_local} · ${destinatarios.length} destinatário(s)`}
    >
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <Label htmlFor="relatorio-enabled" className="font-medium">
            Envio automático ativo
          </Label>
          <p className="text-xs text-slate-500">Cron horário verifica o horário configurado</p>
        </div>
        <Checkbox
          id="relatorio-enabled"
          checked={form.enabled}
          onCheckedChange={(v) => setForm((f) => f && { ...f, enabled: v === true })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="relatorio-hora">Horário (America/Sao_Paulo)</Label>
          <Input
            id="relatorio-hora"
            type="time"
            value={form.hora_local}
            onChange={(e) => setForm((f) => f && { ...f, hora_local: e.target.value })}
          />
        </div>
        <div className="flex flex-col justify-end rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">Período do relatório</p>
          <p className="mt-1 text-xs text-slate-500">
            Sempre o mês corrente, do dia 1 até a data do envio (gestão à vista).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Seções incluídas no e-mail</Label>
        <p className="text-xs text-slate-500">
          Marque o que entra no relatório e use as setas para definir a ordem no e-mail.
          Indicadores operacionais: digest completo → consolidado; destinatário com área → seção da área.
        </p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {SECOES_UI.map((key, index) => (
            <li key={key} className="flex items-center gap-2 px-3 py-2">
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0}
                  aria-label={`Mover ${SECAO_LABELS[key]} para cima`}
                  onClick={() => moveSecao(key, -1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === SECOES_UI.length - 1}
                  aria-label={`Mover ${SECAO_LABELS[key]} para baixo`}
                  onClick={() => moveSecao(key, 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              <Checkbox
                id={`secao-${key}`}
                checked={form.secoes[key]}
                onCheckedChange={(c) => toggleSecao(key, c === true)}
              />
              <label htmlFor={`secao-${key}`} className="min-w-0 flex-1 cursor-pointer text-sm text-slate-700">
                {SECAO_LABELS[key]}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saveConfig.isPending}>
          Salvar configuração
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={enviando != null}
          onClick={() => void handleEnviar('manual')}
        >
          <Send className="h-4 w-4" />
          Enviar agora
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={enviando != null || !userEmail}
          onClick={() => void handleEnviar('teste')}
        >
          <Send className="h-4 w-4" />
          Enviar teste
        </Button>
      </div>

      {ultimoLog && (
        <p className="text-xs text-slate-500">
          Último envio: {formatDate(ultimoLog.enviado_em)} — {ultimoLog.email} —{' '}
          <span className={ultimoLog.status === 'sucesso' ? 'text-emerald-700' : 'text-red-700'}>
            {ultimoLog.status}
          </span>
          {ultimoLog.erro ? ` (${ultimoLog.erro.slice(0, 80)})` : ''}
        </p>
      )}

      <div className="space-y-4 border-t border-slate-200 pt-6">
        <div>
          <Label>Destinatários por área meta</Label>
          <p className="mt-1 text-xs text-slate-500">
            Cada área gera <strong>1 e-mail por dia</strong> com todos os destinatários cadastrados
            nela no campo Para (visão do escritório + aquela área). Cadastre liderança e gerente na
            mesma área — não são envios separados por pessoa.
          </p>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 text-xs text-sky-950">
          <p className="font-medium">Como funciona o campo “Área”</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sky-900/90">
            <li>
              <strong>Insolvência, Trabalhista…</strong> — e-mail focado na área (indicadores +
              receita + eficiência da área).
            </li>
            <li>
              <strong>Escritório completo</strong> — um único e-mail com as 5 áreas (use só se não
              quiser cadastrar área a área).
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={replaceDestinatarios.isPending}
            onClick={() => void handleAplicarPadrao()}
          >
            <Users className="h-4 w-4" />
            Aplicar lista padrão (liderança + gerentes)
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-slate-500">Usuário SIOE (opcional)</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value=""
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                const u = usuariosAtivos.find((m: TeamMember) => m.id === id)
                if (u) {
                  setDestForm((d) => ({
                    ...d,
                    nome: u.full_name ?? d.nome,
                    email: u.email ?? d.email,
                  }))
                }
              }}
            >
              <option value="">Selecionar de Usuários…</option>
              {usuariosAtivos.map((u: TeamMember) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Área meta do e-mail</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={destForm.area_key || '__all__'}
              onChange={(e) =>
                setDestForm((d) => ({
                  ...d,
                  area_key: e.target.value === '__all__' ? '' : e.target.value,
                }))
              }
            >
              <option value="__all__">Escritório completo (todas as áreas em 1 e-mail)</option>
              {RECEITA_META_CONTRIBUICAO_AREA.map((a) => (
                <option key={a.key} value={a.key}>
                  {RECEITA_DEPARTAMENTO_LABELS[a.key] ?? a.key}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Nome"
            value={destForm.nome}
            onChange={(e) => setDestForm((d) => ({ ...d, nome: e.target.value }))}
          />
          <Input
            placeholder="E-mail"
            type="email"
            value={destForm.email}
            onChange={(e) => setDestForm((d) => ({ ...d, email: e.target.value }))}
          />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="secondary" className="gap-1" onClick={() => void handleAddDest()}>
            <Plus className="h-4 w-4" />
            {destForm.id ? 'Atualizar' : 'Adicionar'}
          </Button>
          {destForm.id && (
            <Button type="button" variant="ghost" onClick={() => setDestForm(emptyDest())}>
              Cancelar
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {destinatariosPorArea.map((grupo) => (
            <div key={grupo.area_key ?? 'digest'} className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">{grupo.label}</p>
                <p className="text-xs text-slate-500">
                  {grupo.items.length === 0
                    ? 'Nenhum destinatário'
                    : `1 e-mail/dia · ${grupo.items.length} destinatário(s) no Para`}
                </p>
              </div>
              {grupo.items.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-400">—</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {grupo.items.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left hover:text-slate-900"
                        onClick={() => handleEditDest(d)}
                      >
                        <span className="font-medium">{d.nome || d.email}</span>
                        <span className="block truncate text-xs text-slate-500">{d.email}</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-600 hover:text-red-700"
                        onClick={() => void deleteDestinatario.mutateAsync(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {destinatarios.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhum destinatário cadastrado. Use &quot;Aplicar lista padrão&quot; ou adicione manualmente.
          </p>
        )}
      </div>

      {log.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <Label className="text-xs text-slate-500">Histórico recente</Label>
          <div className="max-h-40 overflow-y-auto rounded border border-slate-100 text-xs">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Quando</th>
                  <th className="px-2 py-1">E-mail</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {log.slice(0, 15).map((entry: RelatorioMensalLogEntry) => (
                  <tr key={entry.id} className="border-t border-slate-50">
                    <td className="px-2 py-1 whitespace-nowrap">{formatDate(entry.enviado_em)}</td>
                    <td className="px-2 py-1 truncate max-w-[140px]">{entry.email}</td>
                    <td className="px-2 py-1">
                      <span
                        className={
                          entry.status === 'sucesso' ? 'text-emerald-700' : 'text-red-700'
                        }
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReceitaConfigCollapsibleSection>
  )
}
