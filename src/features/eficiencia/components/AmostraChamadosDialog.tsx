import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  Send,
  Ticket,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'
import { getTeamMember, TEAM_BY_EMAIL } from '@/lib/teamAvatars'
import { colaboradoresService } from '@/features/colaboradores/services/colaboradoresService'
import type { Colaborador } from '@/features/colaboradores/types'
import { MESES_EFICIENCIA } from '../constants'
import { eficienciaService } from '../services/eficienciaService'
import { normalizeNomeChave } from '../utils/racionalQuery'
import type {
  AbrirChamadosResultado,
  AbrirChamadosResultadoItem,
  AmostraChamadoItem,
  EvidenciaFatalDecisao,
} from '../utils/amostraChamados'
import { formatPercent } from '@/shared/utils/format'

/** Gradiente oficial RESPONSUM (ticket-bp-2026 / design-tokens). */
const RESPONSUM_BRAND_GRADIENT =
  'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ano: number
  mes: number
  onMesChange: (mes: number) => void
}

type PessoaResolvida = {
  name: string
  email: string | null
  area: string | null
  cargo: string | null
  avatarUrl: string | null
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function iniciais(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function emailLocalPart(email: string | null | undefined): string | null {
  const local = email?.split('@')[0]?.trim().toLowerCase()
  return local || null
}

/**
 * Ordem: avatar do RESPONSUM (colaboradores.avatar_url) → TEAM_BY_EMAIL (gestores)
 * → match por local-part do e-mail. Não usa `/team/...` inventado (404 → só iniciais).
 */
function resolveAvatar(
  preferredUrl: string | null | undefined,
  email: string | null,
  name: string,
): string | null {
  const fromResponsum = preferredUrl?.trim()
  if (fromResponsum) return fromResponsum

  if (email) {
    const byEmail = getTeamMember(email)
    if (byEmail?.avatar) return byEmail.avatar
  }

  const local = emailLocalPart(email)
  if (local) {
    for (const [emailKey, member] of Object.entries(TEAM_BY_EMAIL)) {
      if (emailLocalPart(emailKey) === local && member.avatar) return member.avatar
    }
  }

  const key = normalizeNomeChave(name)
  if (key) {
    for (const member of Object.values(TEAM_BY_EMAIL)) {
      if (normalizeNomeChave(member.name) === key && member.avatar) return member.avatar
    }
  }

  return null
}

function matchColaborador(nome: string, colaboradores: Colaborador[]): Colaborador | null {
  const key = normalizeNomeChave(nome)
  if (!key) return null
  const exact = colaboradores.find((c) => normalizeNomeChave(c.full_name) === key)
  if (exact) return exact
  // Fallback: nome do VIOS às vezes vem sem sobrenome completo ou com ordem diferente
  const parts = key.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    const partial = colaboradores.find((c) => {
      const ck = normalizeNomeChave(c.full_name)
      return ck.startsWith(parts[0]!) && parts.every((p) => ck.includes(p))
    })
    if (partial) return partial
  }
  return null
}

function resolvePessoa(
  nomeBruto: string | null | undefined,
  colaboradores: Colaborador[],
): PessoaResolvida | null {
  const nome = (nomeBruto ?? '').trim()
  if (!nome) return null
  const colab = matchColaborador(nome, colaboradores)
  if (colab) {
    return {
      name: colab.full_name,
      email: colab.email,
      area: colab.area,
      cargo: colab.cargo,
      avatarUrl: resolveAvatar(colab.avatar_url, colab.email ?? colab.responsum_email, colab.full_name),
    }
  }
  return {
    name: nome,
    email: null,
    area: null,
    cargo: null,
    avatarUrl: resolveAvatar(null, null, nome),
  }
}

function StatusBadge({ status }: { status?: AbrirChamadosResultadoItem }) {
  if (!status) {
    return (
      <Badge variant="outline" className="border-slate-200 bg-white text-slate-400">
        Pendente
      </Badge>
    )
  }
  if (!status.ok) {
    return (
      <Badge
        variant="outline"
        className="border-red-200 bg-red-50 text-red-700"
        title={status.erro}
      >
        Erro
      </Badge>
    )
  }
  if (status.ja_existia) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        Já existia
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
      Aberto
    </Badge>
  )
}

function DecisaoBadge({ decisao }: { decisao?: EvidenciaFatalDecisao }) {
  if (!decisao) return null
  if (decisao.decisao === 'excludente_mantida') {
    return (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-sky-800"
        title={
          decisao.decidido_por_nome
            ? `Evidência ok · ${decisao.decidido_por_nome}`
            : 'Evidência enviada — excludente mantida'
        }
      >
        Excludente mantida
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-rose-200 bg-rose-50 text-rose-800"
      title={
        decisao.decidido_por_nome
          ? `Sem evidência · ${decisao.decidido_por_nome}`
          : 'Sem evidência — incluído no FATAL'
      }
    >
      Incluído no FATAL
    </Badge>
  )
}

function PessoaChip({
  pessoa,
  size = 'sm',
}: {
  pessoa: PessoaResolvida
  size?: 'sm' | 'md'
}) {
  const avatarClass = size === 'md' ? 'h-9 w-9' : 'h-7 w-7'
  const nameClass = size === 'md' ? 'text-sm font-semibold' : 'text-xs font-medium'
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className={cn(avatarClass, 'shrink-0 ring-1 ring-slate-200')}>
        {pessoa.avatarUrl ? (
          <AvatarImage src={pessoa.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : null}
        <AvatarFallback className="bg-slate-100 text-[10px] text-slate-600">
          {iniciais(pessoa.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className={cn('truncate text-slate-900', nameClass)}>{pessoa.name}</p>
        {(pessoa.cargo || pessoa.area) && (
          <p className="truncate text-[10px] text-slate-500">
            {[pessoa.cargo, pessoa.area].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}

export function AmostraChamadosDialog({
  open,
  onOpenChange,
  ano,
  mes,
  onMesChange,
}: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [itens, setItens] = useState<AmostraChamadoItem[]>([])
  const [populacao, setPopulacao] = useState(0)
  const [previewCi, setPreviewCi] = useState<string | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set())
  const [copiadoCi, setCopiadoCi] = useState<string | null>(null)
  const [abrindoChamados, setAbrindoChamados] = useState(false)
  const [resultadoAbertura, setResultadoAbertura] = useState<AbrirChamadosResultado | null>(null)
  const [areaFiltro, setAreaFiltro] = useState<string>('all')
  const [detalhesAbertos, setDetalhesAbertos] = useState(true)
  const [decisoesPorCi, setDecisoesPorCi] = useState<Map<string, EvidenciaFatalDecisao>>(
    () => new Map(),
  )

  const { data: colaboradoresData } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => colaboradoresService.list(),
    enabled: open,
  })
  const colaboradores: Colaborador[] = colaboradoresData ?? []

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setPreviewCi(null)
    setMarcados(new Set())
    setResultadoAbertura(null)
    setAreaFiltro('all')
    setDecisoesPorCi(new Map())
    void eficienciaService
      .fetchIndicadoresResultadoMes(ano, mes)
      .then(async (data) => {
        if (cancelled) return
        setItens(data.amostraChamados)
        setPopulacao(data.detalhesExcludentes.length)
        setPreviewCi(data.amostraChamados[0]?.ci ?? null)
        // Por padrão nada marcado — o usuário escolhe o que enviar
        setMarcados(new Set())
        try {
          const decisoes = await eficienciaService.fetchEvidenciaFatalDecisoesPorCi(
            data.amostraChamados.map((i) => i.ci),
          )
          if (!cancelled) setDecisoesPorCi(decisoes)
        } catch {
          if (!cancelled) setDecisoesPorCi(new Map())
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Erro ao carregar amostra')
          setItens([])
          setPopulacao(0)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, ano, mes])

  const areas = useMemo(
    () =>
      [...new Set(itens.map((i) => i.area).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [itens],
  )

  const itensFiltrados = useMemo(
    () => (areaFiltro === 'all' ? itens : itens.filter((i) => i.area === areaFiltro)),
    [itens, areaFiltro],
  )

  useEffect(() => {
    if (itensFiltrados.length === 0) {
      setPreviewCi(null)
      return
    }
    setPreviewCi((prev) => {
      if (prev && itensFiltrados.some((i) => i.ci === prev)) return prev
      return itensFiltrados[0]?.ci ?? null
    })
  }, [itensFiltrados])

  const selecionado = useMemo(
    () => itens.find((i) => i.ci === previewCi) ?? null,
    [itens, previewCi],
  )

  const itensMarcados = useMemo(
    () => itens.filter((i) => marcados.has(i.ci)),
    [itens, marcados],
  )

  const marcadosNoFiltro = useMemo(
    () => itensFiltrados.filter((i) => marcados.has(i.ci)).length,
    [itensFiltrados, marcados],
  )

  const todosFiltradosMarcados =
    itensFiltrados.length > 0 && marcadosNoFiltro === itensFiltrados.length
  const algunsFiltradosMarcados = marcadosNoFiltro > 0 && !todosFiltradosMarcados

  const resultadoPorCi = useMemo(
    () => new Map((resultadoAbertura?.resultados ?? []).map((r) => [r.ci, r])),
    [resultadoAbertura],
  )

  const falhasAbertura = resultadoAbertura
    ? resultadoAbertura.resultados.filter((r) => !r.ok).length
    : 0

  const pct =
    populacao > 0 ? formatPercent((itens.length / populacao) * 100) : formatPercent(0)

  const pessoaSelecionada = useMemo(
    () => resolvePessoa(selecionado?.responsavel, colaboradores),
    [selecionado?.responsavel, colaboradores],
  )

  const toggleMarcado = (ci: string) => {
    setMarcados((prev) => {
      const next = new Set(prev)
      if (next.has(ci)) next.delete(ci)
      else next.add(ci)
      return next
    })
  }

  const toggleTodosFiltrados = () => {
    setMarcados((prev) => {
      const next = new Set(prev)
      if (todosFiltradosMarcados) {
        for (const item of itensFiltrados) next.delete(item.ci)
      } else {
        for (const item of itensFiltrados) next.add(item.ci)
      }
      return next
    })
  }

  const handleCopy = async (item: AmostraChamadoItem) => {
    const ok = await copyText(item.textoChamado)
    if (ok) {
      setCopiadoCi(item.ci)
      toast.success(`Texto do CI ${item.ci} copiado`)
      window.setTimeout(() => setCopiadoCi((c) => (c === item.ci ? null : c)), 1500)
    } else {
      toast.error('Não foi possível copiar')
    }
  }

  const handleCopySelecionados = async () => {
    const alvo = itensMarcados.length > 0 ? itensMarcados : selecionado ? [selecionado] : []
    if (alvo.length === 0) {
      toast.error('Marque ao menos um caso ou abra o preview de um item')
      return
    }
    const bloco = alvo.map((i) => i.textoChamado).join('\n\n---\n\n')
    const ok = await copyText(bloco)
    if (ok) toast.success(`${alvo.length} texto(s) copiado(s)`)
    else toast.error('Não foi possível copiar')
  }

  const handleAbrirChamados = async () => {
    let alvo = itensMarcados
    if (alvo.length === 0 && selecionado) {
      alvo = [selecionado]
    }
    if (alvo.length === 0) {
      toast.error('Marque os casos que deseja abrir, ou selecione um na lista')
      return
    }
    setAbrindoChamados(true)
    try {
      const resultado = await eficienciaService.abrirChamadosEvidenciaResponsum(
        alvo,
        user?.email ?? null,
      )
      setResultadoAbertura((prev) => {
        if (!prev) return resultado
        const map = new Map(prev.resultados.map((r) => [r.ci, r]))
        for (const r of resultado.resultados) map.set(r.ci, r)
        const merged = [...map.values()]
        return {
          criados: merged.filter((r) => r.ok && !r.ja_existia).length,
          ja_existiam: merged.filter((r) => r.ja_existia).length,
          total: merged.length,
          resultados: merged,
        }
      })
      const falhas = resultado.resultados.filter((r) => !r.ok).length
      if (resultado.criados > 0) {
        toast.success(
          `${resultado.criados} chamado(s) aberto(s) no RESPONSUM` +
            (resultado.ja_existiam > 0 ? ` (${resultado.ja_existiam} já existiam)` : ''),
        )
      }
      if (falhas > 0) {
        toast.error(`${falhas} item(ns) não puderam abrir chamado — veja o status na lista.`)
      }
      if (resultado.criados === 0 && falhas === 0 && resultado.ja_existiam > 0) {
        toast.info('Todos os chamados selecionados já existiam no RESPONSUM.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao abrir chamados no RESPONSUM')
    } finally {
      setAbrindoChamados(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(1120px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-slate-500" />
            Amostra de chamados — evidências FATAL
          </DialogTitle>
          <DialogDescription>
            Marque os casos desejados (um ou vários) e envie no RESPONSUM — ou copie o texto
            como fallback.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mes-amostra-chamados">Mês</Label>
                <select
                  id="mes-amostra-chamados"
                  value={mes}
                  onChange={(e) => onMesChange(Number(e.target.value))}
                  className="flex h-9 min-w-[140px] rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                  disabled={loading}
                >
                  {MESES_EFICIENCIA.map((label, idx) => (
                    <option key={label} value={idx + 1}>
                      {label}/{ano}
                    </option>
                  ))}
                </select>
              </div>

              {!loading && (
                <div className="flex flex-wrap gap-2 pb-0.5">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Amostra
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{itens.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Marcados
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{marcados.size}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Cobertura
                    </p>
                    <p className="text-sm font-semibold text-slate-900">{pct}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!loading && areas.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAreaFiltro('all')}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  areaFiltro === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                Todas ({itens.length})
              </button>
              {areas.map((area) => {
                const count = itens.filter((i) => i.area === area).length
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFiltro(area)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      areaFiltro === area
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {area} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {resultadoAbertura && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
                falhasAbertura > 0
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900',
              )}
            >
              {falhasAbertura > 0 ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <span>
                <strong>{resultadoAbertura.criados}</strong> aberto(s)
                {' · '}
                <strong>{resultadoAbertura.ja_existiam}</strong> já existia(m)
                {falhasAbertura > 0 && (
                  <>
                    {' · '}
                    <strong>{falhasAbertura}</strong> com erro
                  </>
                )}{' '}
                de {resultadoAbertura.total}
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              Montando amostra estratificada…
            </div>
          ) : itens.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20">
              <FileText className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">
                Nenhum FATAL excludente no mês selecionado.
              </p>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                    <Checkbox
                      checked={todosFiltradosMarcados}
                      indeterminate={algunsFiltradosMarcados}
                      onCheckedChange={toggleTodosFiltrados}
                      aria-label="Marcar todos visíveis"
                    />
                    {marcadosNoFiltro > 0
                      ? `${marcadosNoFiltro} de ${itensFiltrados.length} marcado(s)`
                      : `${itensFiltrados.length} caso${itensFiltrados.length === 1 ? '' : 's'}`}
                    {areaFiltro !== 'all' ? ` · ${areaFiltro}` : ''}
                  </label>
                  {marcados.size > 0 && (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                      onClick={() => setMarcados(new Set())}
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>
                <ScrollArea className="max-h-[min(52vh,480px)] flex-1">
                  <ul className="divide-y divide-slate-100">
                    {itensFiltrados.map((item, idx) => {
                      const ativo = previewCi === item.ci
                      const marcado = marcados.has(item.ci)
                      const statusChamado = resultadoPorCi.get(item.ci)
                      const pessoa = resolvePessoa(item.responsavel, colaboradores)
                      return (
                        <li
                          key={item.ci}
                          className={cn(
                            'flex items-start gap-2 px-2 py-2 transition-colors',
                            ativo
                              ? 'bg-slate-100/90 ring-inset ring-1 ring-slate-200'
                              : 'hover:bg-slate-50',
                            marcado && !ativo && 'bg-sky-50/40',
                          )}
                        >
                          <div className="mt-1.5 shrink-0 pl-1">
                            <Checkbox
                              checked={marcado}
                              onCheckedChange={() => toggleMarcado(item.ci)}
                              aria-label={`Marcar CI ${item.ci}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewCi(item.ci)}
                            className="flex min-w-0 flex-1 items-start gap-3 rounded-md px-1 py-1 text-left"
                          >
                            <span className="mt-0.5 w-5 shrink-0 text-center text-xs tabular-nums text-slate-400">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold tabular-nums text-slate-900">
                                  CI {item.ci}
                                </span>
                                <StatusBadge status={statusChamado} />
                                <DecisaoBadge decisao={decisoesPorCi.get(item.ci)} />
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                                  {item.area || 'Sem área'}
                                </span>
                                <span
                                  className="truncate text-[11px] text-slate-500"
                                  title={item.justificativa}
                                >
                                  {item.justificativa || '—'}
                                </span>
                              </div>
                              {pessoa ? (
                                <PessoaChip pessoa={pessoa} />
                              ) : (
                                <p className="truncate text-[11px] text-slate-400">
                                  {item.grupoCliente || 'Sem grupo'}
                                </p>
                              )}
                            </div>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-0.5 h-8 w-8 shrink-0 text-slate-400 hover:text-slate-700"
                            title="Copiar texto"
                            onClick={() => void handleCopy(item)}
                          >
                            {copiadoCi === item.ci ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200">
                {selecionado ? (
                  <>
                    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div className="min-w-0 space-y-2">
                        <p className="text-sm font-semibold text-slate-900">
                          Preview · CI {selecionado.ci}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{selecionado.area || 'Sem área'}</Badge>
                          <StatusBadge status={resultadoPorCi.get(selecionado.ci)} />
                          <DecisaoBadge decisao={decisoesPorCi.get(selecionado.ci)} />
                          {marcados.has(selecionado.ci) && (
                            <Badge
                              variant="outline"
                              className="border-sky-200 bg-sky-50 text-sky-700"
                            >
                              Marcado para envio
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                        <Button
                          type="button"
                          size="sm"
                          variant={marcados.has(selecionado.ci) ? 'secondary' : 'outline'}
                          onClick={() => toggleMarcado(selecionado.ci)}
                        >
                          {marcados.has(selecionado.ci) ? 'Desmarcar' : 'Marcar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleCopy(selecionado)}
                        >
                          {copiadoCi === selecionado.ci ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copiar
                        </Button>
                      </div>
                    </div>

                    {pessoaSelecionada && (
                      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          Responsável pela conclusão
                        </p>
                        <PessoaChip pessoa={pessoaSelecionada} size="md" />
                      </div>
                    )}

                    <div className="shrink-0 border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => setDetalhesAbertos((v) => !v)}
                        aria-expanded={detalhesAbertos}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 bg-slate-50/80 px-3 py-2 text-left',
                          'transition-colors hover:bg-slate-100/80',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/60',
                        )}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Detalhes do caso
                          {!detalhesAbertos && selecionado.nroCnj ? (
                            <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                              · CNJ {selecionado.nroCnj}
                            </span>
                          ) : null}
                        </span>
                        {detalhesAbertos ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                        )}
                      </button>
                      {detalhesAbertos && (
                        <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-3">
                          {[
                            { label: 'CNJ', value: selecionado.nroCnj || '—' },
                            { label: 'Grupo', value: selecionado.grupoCliente || '—' },
                            {
                              label: 'Atraso',
                              value:
                                selecionado.atrasoDias == null
                                  ? '—'
                                  : `${selecionado.atrasoDias.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    })} dia(s)`,
                            },
                            { label: 'Justificativa', value: selecionado.justificativa || '—' },
                            { label: 'Evidência', value: selecionado.evidencia || '—' },
                            { label: 'Tarefa', value: selecionado.tarefa || '—' },
                          ].map((meta) => (
                            <div key={meta.label} className="bg-white px-3 py-2">
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                {meta.label}
                              </p>
                              <p
                                className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-700"
                                title={meta.value}
                              >
                                {meta.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <ScrollArea className="max-h-[min(32vh,280px)] flex-1 bg-slate-50/50">
                      <pre className="whitespace-pre-wrap p-4 font-sans text-xs leading-relaxed text-slate-700">
                        {selecionado.textoChamado}
                      </pre>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-400">
                    Selecione um caso na lista
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={loading || (itensMarcados.length === 0 && !selecionado)}
            onClick={() => void handleCopySelecionados()}
          >
            <Copy className="h-4 w-4" />
            {itensMarcados.length > 0
              ? `Copiar marcados (${itensMarcados.length})`
              : 'Copiar este'}
          </Button>
          <Button
            type="button"
            disabled={
              loading ||
              abrindoChamados ||
              (itensMarcados.length === 0 && !selecionado)
            }
            onClick={() => void handleAbrirChamados()}
            className="border-0 font-bold text-white shadow-md hover:opacity-95 active:scale-[0.98]"
            style={{ background: RESPONSUM_BRAND_GRADIENT }}
          >
            {abrindoChamados ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {itensMarcados.length > 1
              ? `Enviar ${itensMarcados.length} no RESPONSUM`
              : itensMarcados.length === 1
                ? 'Enviar 1 no RESPONSUM'
                : 'Enviar no RESPONSUM'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
