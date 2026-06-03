import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useWhatsappChats,
  useWhatsappConversa,
  useTitulosCliente,
  useContatoNomes,
  useGroupParticipants,
  useLidContactIndex,
} from '../hooks/useWhatsapp'
import { useCobrancaTemplates } from '../hooks/useCobrancaTemplates'
import { whatsappService } from '../services/whatsappService'
import { cobrancaService } from '../services/cobrancaService'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Search,
  RefreshCw,
  MessageSquare,
  BellRing,
  PanelRightClose,
  PanelRightOpen,
  Phone,
  Mail,
  CheckCircle2,
  Circle,
  CalendarClock,
  Wallet,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react'
import {
  WHATSAPP_CATEGORIAS,
  WHATSAPP_CATEGORIA_COBRANCA_AUTO,
  WHATSAPP_FILTRO_NAO_LIDAS,
  categoriaLabel,
  getWhatsappCategoria,
  type WhatsappCategoriaFiltro,
  type WhatsappChatCategoriaId,
} from '../constants/whatsappCategorias'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/shared/utils/format'
import { applyTemplate, buildTemplateVars, prefixoAtendente } from '../utils/template'
import { phoneToRemoteJid, phonesMatch, canonicalJid } from '../utils/phone'
import { formatPhoneMasked } from '../utils/phoneMask'
import { pickContactLabel } from '../utils/contactNames'
import { isGroupJid, isLidJid, groupFallbackLabel, chatSubtitle, groupIdFromJid } from '../utils/jid'
import { resolveChatDisplayName, lidFromJid } from '../utils/lidIndex'
import {
  buildMentionMap,
  buildSenderNamesFromMessages,
  resolveGroupParticipants,
  senderLabelFromMessage,
} from '../utils/participants'
import { WhatsappMessageBubble } from './WhatsappMessageBubble'
import { WhatsappComposer } from './WhatsappComposer'
import { WhatsappGroupMembers } from './WhatsappGroupMembers'
import { WhatsappChatCategoriaSelect } from './WhatsappChatCategoriaSelect'
import { WhatsappComposerResizeHandle } from './WhatsappComposerResizeHandle'
import { useComposerResize } from '../hooks/useComposerResize'
import { isNotifMuted, setNotifMuted, playNotificationSound } from '../utils/sound'
import { useWhatsappNotifications } from '../notifications/WhatsappNotificationsProvider'
import type { PendingWhatsappCobranca } from '../types/cobranca.types'
import type {
  CobrancaTituloAbertoRow,
  WhatsappChatRow,
  WhatsappMensagemRow,
} from '@/lib/database.types'

interface Props {
  pendingCobranca?: PendingWhatsappCobranca | null
  onPendingSent?: () => void
}

function jidToNumber(jid: string): string {
  return canonicalJid(jid).split('@')[0]
}

function initials(name: string): string {
  const clean = name.trim()
  const letras = clean.replace(/[^a-zA-ZÀ-ÿ ]/g, '').trim()
  if (letras) {
    const partes = letras.split(/\s+/)
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || letras.slice(0, 2).toUpperCase()
  }
  return clean.replace(/\D/g, '').slice(-2) || '?'
}

function formatHora(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function formatDiaHora(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function SafeAvatarImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <AvatarImage src={src} alt={alt} onError={() => setFailed(true)} />
}

function chatFromPending(pending: PendingWhatsappCobranca): WhatsappChatRow {
  return {
    remote_jid: phoneToRemoteJid(pending.telefone),
    instance: null,
    push_name: pending.nome,
    profile_pic_url: null,
    last_message_at: null,
    last_message_preview: null,
    unread_count: 0,
    categoria: WHATSAPP_CATEGORIA_COBRANCA_AUTO,
    updated_at: new Date().toISOString(),
  }
}

async function aplicarCategoriaCobrancaNoChat(
  remoteJid: string,
  refetchChats: () => Promise<unknown>,
  setSelected: Dispatch<SetStateAction<WhatsappChatRow | null>>,
): Promise<void> {
  await whatsappService.ensureChatCategoriaCobranca(remoteJid)
  const key = remoteJid
  setSelected((prev) =>
    prev && (prev.remote_jid === key || canonicalJid(prev.remote_jid) === canonicalJid(key))
      ? { ...prev, categoria: WHATSAPP_CATEGORIA_COBRANCA_AUTO }
      : prev,
  )
  await refetchChats()
}

function TituloCard({
  titulo: t,
  onCobrar,
}: {
  titulo: CobrancaTituloAbertoRow
  onCobrar: (t: CobrancaTituloAbertoRow) => void
}) {
  const atraso = t.dias_atraso > 0
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {t.descricao || `Título ${t.nro_titulo ?? '-'}`}
          </p>
          <p className="text-[11px] text-slate-400">{t.plano_contas || 'Sem plano de contas'}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-slate-900">
          {formatCurrency(Number(t.valor ?? 0))}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <CalendarClock className="h-3.5 w-3.5" />
        <span>venc. {formatDate(t.data_vencimento)}</span>
        <Badge
          variant="secondary"
          className={cn(
            'ml-auto',
            atraso ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600',
          )}
        >
          {atraso ? `${t.dias_atraso}d em atraso` : `vence em ${Math.abs(t.dias_atraso)}d`}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        <span
          className={cn(
            'inline-flex items-center gap-1',
            t.tem_whatsapp ? 'text-emerald-600' : 'text-slate-400',
          )}
        >
          {t.tem_whatsapp ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          Cobrança registrada
        </span>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        onClick={() => onCobrar(t)}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Cobrar este título
      </Button>
    </div>
  )
}

export function WhatsappInbox({ pendingCobranca, onPendingSent }: Props) {
  const { fullName } = useAuth()
  const { templates } = useCobrancaTemplates()
  const [busca, setBusca] = useState('')
  const [selected, setSelected] = useState<WhatsappChatRow | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [activeCobranca, setActiveCobranca] = useState<PendingWhatsappCobranca | null>(null)
  const [muted, setMuted] = useState(isNotifMuted())
  const [filtroCategoria, setFiltroCategoria] = useState<WhatsappCategoriaFiltro>(null)
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)
  const { refreshUnread } = useWhatsappNotifications()
  const queryClient = useQueryClient()
  const { composerHeight, onHandlePointerDown, resetHeight: resetComposerHeight } =
    useComposerResize()

  const { chats: chatsRaw, loading: loadingChats, refetch: refetchChats } = useWhatsappChats(busca)

  const contagemPorCategoria = useMemo(() => {
    const counts = {
      todas: chatsRaw.length,
      nao_lidas: 0,
      sem_categoria: 0,
      COBRANCA: 0,
      COLABORADOR_BP: 0,
      SOCIO: 0,
    }
    for (const c of chatsRaw) {
      if ((c.unread_count ?? 0) > 0) counts.nao_lidas += 1
      if (!c.categoria) counts.sem_categoria += 1
      else if (c.categoria in counts) counts[c.categoria as WhatsappChatCategoriaId] += 1
    }
    return counts
  }, [chatsRaw])

  const chats = useMemo(() => {
    if (!filtroCategoria) return chatsRaw
    if (filtroCategoria === 'nao_lidas') {
      return chatsRaw.filter((c: WhatsappChatRow) => (c.unread_count ?? 0) > 0)
    }
    if (filtroCategoria === 'sem_categoria') {
      return chatsRaw.filter((c: WhatsappChatRow) => !c.categoria)
    }
    return chatsRaw.filter((c: WhatsappChatRow) => c.categoria === filtroCategoria)
  }, [chatsRaw, filtroCategoria])
  const nomesPorTelefone = useContatoNomes()
  const lidIndex = useLidContactIndex()
  const { mensagens, loading: loadingMsgs, refetch: refetchMsgs } = useWhatsappConversa(
    selected?.remote_jid ?? null,
  )
  const groupJid = selected && isGroupJid(selected.remote_jid) ? selected.remote_jid : null
  const { members: groupMembersRaw, loading: loadingMembers } = useGroupParticipants(groupJid)
  const messagesScrollRef = useRef<HTMLDivElement>(null)

  const senderNames = useMemo(
    () => buildSenderNamesFromMessages(mensagens),
    [mensagens],
  )
  const resolvedMembers = useMemo(
    () => resolveGroupParticipants(groupMembersRaw, senderNames, nomesPorTelefone),
    [groupMembersRaw, senderNames, nomesPorTelefone],
  )
  const mentionMap = useMemo(() => buildMentionMap(resolvedMembers), [resolvedMembers])

  // Resolve o nome exibido: grupo > cadastro > @lid > push_name > telefone.
  const resolveName = (chat: WhatsappChatRow): string =>
    resolveChatDisplayName(
      chat.remote_jid,
      chat.push_name,
      nomesPorTelefone,
      lidIndex,
      isGroupJid(chat.remote_jid),
      groupFallbackLabel,
    )

  const phoneForTitulos = (chat: WhatsappChatRow | null): string | null => {
    if (!chat || isGroupJid(chat.remote_jid)) return null
    if (isLidJid(chat.remote_jid)) {
      const lid = lidFromJid(chat.remote_jid)
      const entry = lid ? lidIndex.get(lid) : undefined
      return entry?.phone_number ? entry.phone_number.split('@')[0] : null
    }
    return jidToNumber(chat.remote_jid)
  }

  // Rola só o painel de mensagens (não a página) ao abrir conversa ou chegar mensagem nova.
  useEffect(() => {
    if (!selected || loadingMsgs) return
    const el = messagesScrollRef.current
    if (!el) return
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [selected?.remote_jid, mensagens.length, loadingMsgs])

  // Número da conversa (sem sufixo de dispositivo); vazio para JIDs @lid (número oculto).
  const numeroConversa = phoneForTitulos(selected)
  const { titulos, refetch: refetchTitulos } = useTitulosCliente(numeroConversa)

  useEffect(() => {
    if (!pendingCobranca) return
    const jid = phoneToRemoteJid(pendingCobranca.telefone)
    if (!jid) {
      toast.error('Telefone inválido para WhatsApp.')
      return
    }
    const existente = chats.find(
      (c: WhatsappChatRow) =>
        c.remote_jid === jid || phonesMatch(jidToNumber(c.remote_jid), pendingCobranca.telefone),
    )
    const base = existente ?? chatFromPending(pendingCobranca)
    setSelected({ ...base, categoria: WHATSAPP_CATEGORIA_COBRANCA_AUTO })
    setShowDetails(true)
    setActiveCobranca(pendingCobranca)
    setTexto(pendingCobranca.mensagem)

    let cancelled = false
    aplicarCategoriaCobrancaNoChat(jid, refetchChats, setSelected).catch(() => {
      if (!cancelled) toast.error('Não foi possível aplicar a categoria Cobrança')
    })
    return () => {
      cancelled = true
    }
  }, [pendingCobranca, chats, refetchChats])

  const cliente = titulos[0] ?? null

  const telefoneExibicao = useMemo(() => {
    if (!selected || isGroupJid(selected.remote_jid)) return null
    const raw =
      cliente?.pessoa_telefone?.trim() ||
      numeroConversa ||
      jidToNumber(selected.remote_jid)
    if (!raw) return 'Não informado'
    return formatPhoneMasked(raw) || raw
  }, [selected, cliente?.pessoa_telefone, numeroConversa])
  const vencidos = useMemo(
    () => titulos.filter((t) => !t.a_vencer && !t.arquivado),
    [titulos],
  )
  const aVencer = useMemo(
    () => titulos.filter((t) => t.a_vencer && !t.arquivado),
    [titulos],
  )
  const totalVencido = useMemo(
    () => vencidos.reduce((acc, r) => acc + Number(r.valor ?? 0), 0),
    [vencidos],
  )
  const totalAVencer = useMemo(
    () => aVencer.reduce((acc, r) => acc + Number(r.valor ?? 0), 0),
    [aVencer],
  )
  const ultimaCobranca = useMemo(() => {
    const datas = titulos
      .map((t) => t.ultima_cobranca_at)
      .filter((d): d is string => !!d)
      .sort()
    return datas.length ? datas[datas.length - 1] : null
  }, [titulos])

  const handleSyncChats = async () => {
    setSincronizando(true)
    try {
      const res = await whatsappService.sync()
      await Promise.all([
        refetchChats(),
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'lid-index'] }),
      ])
      toast.success(`Conversas sincronizadas${res.conversas != null ? ` (${res.conversas})` : ''}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao sincronizar conversas')
    } finally {
      setSincronizando(false)
    }
  }

  const handleSelect = async (chat: WhatsappChatRow) => {
    setSelected(chat)
    setShowDetails(true)
    setActiveCobranca(null)
    setTexto('')
    if (chat.unread_count > 0) {
      whatsappService
        .markChatRead(chat.remote_jid)
        .then(() => refreshUnread())
        .catch(() => {})
    }
    try {
      await whatsappService.syncConversa(chat.remote_jid)
      const tasks: Promise<unknown>[] = [refetchMsgs(), refetchChats()]
      if (isGroupJid(chat.remote_jid)) {
        tasks.push(
          queryClient.invalidateQueries({ queryKey: ['whatsapp', 'group-members', chat.remote_jid] }),
        )
      }
      await Promise.all(tasks)
    } catch {
      // sincronização é best-effort; mensagens já existentes continuam visíveis
    }
  }

  const handleToggleMute = () => {
    const novo = !muted
    setMuted(novo)
    setNotifMuted(novo)
    if (!novo) playNotificationSound()
  }

  const handleCobrarParcela = (row: CobrancaTituloAbertoRow) => {
    if (!row.pessoa_telefone) {
      toast.error('Título sem telefone cadastrado.')
      return
    }
    const mensagem = applyTemplate(templates.whatsapp, buildTemplateVars(row, fullName))
    setActiveCobranca({
      parcela_id: row.parcela_id,
      pessoa_id: row.pessoa_id,
      telefone: row.pessoa_telefone,
      nome: row.pessoa_nome || row.cliente,
      mensagem,
    })
    setTexto(mensagem)
    const jid = phoneToRemoteJid(row.pessoa_telefone)
    if (jid && selected) {
      aplicarCategoriaCobrancaNoChat(jid, refetchChats, setSelected).catch(() => {})
    }
  }

  const handleSend = async () => {
    if (!selected || !texto.trim()) return
    setEnviando(true)
    try {
      if (activeCobranca) {
        const result = await cobrancaService.enviarWhatsapp(
          [
            {
              parcela_id: activeCobranca.parcela_id,
              pessoa_id: activeCobranca.pessoa_id,
              number: activeCobranca.telefone,
              mensagem: texto.trim(),
            },
          ],
          fullName,
        )
        if (result.enviados > 0) {
          toast.success('Cobrança enviada e registrada no painel')
          await aplicarCategoriaCobrancaNoChat(selected.remote_jid, refetchChats, setSelected).catch(
            () => {},
          )
          setTexto('')
          setActiveCobranca(null)
          onPendingSent?.()
          refetchMsgs()
          refetchTitulos()
        } else {
          const erro = result.results.find((r) => !r.ok)?.erro
          toast.error(erro ?? 'Não foi possível enviar a cobrança')
        }
      } else {
        const corpo = `${prefixoAtendente(fullName)}${texto.trim()}`
        await whatsappService.sendMessage({ remoteJid: selected.remote_jid, text: corpo })
        setTexto('')
        await Promise.all([refetchMsgs(), refetchChats()])
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar mensagem')
    } finally {
      setEnviando(false)
    }
  }

  const handleSendAudio = async (base64: string) => {
    if (!selected) return
    setEnviando(true)
    try {
      await whatsappService.sendAudio({ remoteJid: selected.remote_jid, audio: base64 })
      await Promise.all([refetchMsgs(), refetchChats()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar áudio')
    } finally {
      setEnviando(false)
    }
  }

  const handleSendFile = async (params: {
    mediatype: 'image' | 'video' | 'document'
    media: string
    mimetype: string
    fileName: string
  }) => {
    if (!selected) return
    setEnviando(true)
    try {
      await whatsappService.sendMediaFile({ remoteJid: selected.remote_jid, ...params })
      await Promise.all([refetchMsgs(), refetchChats()])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar arquivo')
    } finally {
      setEnviando(false)
    }
  }

  const handleCategoriaChange = async (categoria: WhatsappChatCategoriaId | '') => {
    if (!selected) return
    const valor = categoria === '' ? null : categoria
    setSalvandoCategoria(true)
    try {
      await whatsappService.updateChatCategoria(selected.remote_jid, valor)
      setSelected((prev) => (prev ? { ...prev, categoria: valor } : prev))
      await refetchChats()
      toast.success(valor ? `Categoria: ${categoriaLabel(valor)}` : 'Categoria removida')
    } catch {
      toast.error('Erro ao salvar categoria')
    } finally {
      setSalvandoCategoria(false)
    }
  }

  const handleReact = async (messageId: string, fromMe: boolean, emoji: string) => {
    if (!selected || fromMe) return
    try {
      await whatsappService.sendReaction({
        remoteJid: selected.remote_jid,
        messageId,
        fromMe,
        emoji,
      })
      await refetchMsgs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reagir')
    }
  }

  const modoCobranca = !!activeCobranca

  return (
    <div className="flex flex-col gap-3">
      {/* Barra superior — categorias + tempo real */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroCategoria(null)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filtroCategoria === null
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
            )}
          >
            Todas ({contagemPorCategoria.todas})
          </button>
          <button
            type="button"
            onClick={() => setFiltroCategoria('nao_lidas')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filtroCategoria === 'nao_lidas'
                ? WHATSAPP_FILTRO_NAO_LIDAS.chipActive
                : WHATSAPP_FILTRO_NAO_LIDAS.chipIdle,
            )}
          >
            {WHATSAPP_FILTRO_NAO_LIDAS.label} ({contagemPorCategoria.nao_lidas})
          </button>
          {WHATSAPP_CATEGORIAS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFiltroCategoria(cat.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filtroCategoria === cat.id ? cat.chipActive : cat.chipIdle,
              )}
            >
              {cat.label} ({contagemPorCategoria[cat.id]})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFiltroCategoria('sem_categoria')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filtroCategoria === 'sem_categoria'
                ? 'border-slate-500 bg-slate-500 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100',
            )}
          >
            Sem categoria ({contagemPorCategoria.sem_categoria})
          </button>
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700"
            title="Atualização em tempo real"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Tempo real
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleToggleMute}
            title={muted ? 'Ativar som de notificação' : 'Silenciar som de notificação'}
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-slate-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-600" />
            )}
            {muted ? 'Som desativado' : 'Som ativo'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleSyncChats}
            disabled={sincronizando}
          >
            <RefreshCw className={cn('h-4 w-4', sincronizando && 'animate-spin')} />
            Sincronizar Evolution
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-280px)] min-h-[480px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Coluna 1 — Conversas */}
        <div className="flex w-[260px] shrink-0 flex-col border-r border-slate-200">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar conversa"
                className="pl-8"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingChats && <p className="p-4 text-sm text-slate-400">Carregando…</p>}
            {!loadingChats && chats.length === 0 && !modoCobranca && (
              <div className="p-4 text-center text-sm text-slate-400">
                Nenhuma conversa. Clique em sincronizar.
              </div>
            )}
            {modoCobranca &&
              selected &&
              !chats.some((c: WhatsappChatRow) => c.remote_jid === selected.remote_jid) && (
                <button
                  type="button"
                  onClick={() => handleSelect(selected)}
                  className="flex w-full items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-3 py-2.5 text-left"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-emerald-100 text-xs text-emerald-700">
                      {initials(resolveName(selected))}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-emerald-800">
                      {resolveName(selected)}
                    </span>
                    <p className="truncate text-xs text-emerald-600">Nova cobrança</p>
                  </div>
                </button>
              )}
            {!loadingChats && filtroCategoria && chats.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-400">
                {filtroCategoria === 'nao_lidas'
                  ? 'Nenhuma conversa não lida.'
                  : 'Nenhuma conversa nesta categoria.'}
              </div>
            )}
            {chats.map((chat: WhatsappChatRow) => {
              const name = resolveName(chat)
              const isGroup = isGroupJid(chat.remote_jid)
              const active = selected?.remote_jid === chat.remote_jid
              const catDef = getWhatsappCategoria(chat.categoria)
              return (
                <button
                  key={chat.remote_jid}
                  type="button"
                  onClick={() => handleSelect(chat)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-50',
                    active && 'bg-emerald-50/60',
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {chat.profile_pic_url && (
                      <SafeAvatarImage src={chat.profile_pic_url} alt={name} />
                    )}
                    <AvatarFallback
                      className={cn(
                        'text-xs',
                        isGroup ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700',
                      )}
                    >
                      {isGroup ? <Users className="h-4 w-4" /> : initials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-800">{name}</span>
                        {isGroup && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-50"
                          >
                            Grupo
                          </Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatHora(chat.last_message_at)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{chat.last_message_preview || ''}</p>
                    {catDef && (
                      <span
                        className={cn(
                          'mt-0.5 inline-block rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide',
                          catDef.badgeClass,
                        )}
                      >
                        {catDef.label}
                      </span>
                    )}
                  </div>
                  {chat.unread_count > 0 && (
                    <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                      {chat.unread_count}
                    </span>
                  )}
                </button>
              )
            })}
          </ScrollArea>
        </div>

        {/* Coluna 2 — Conversa */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <MessageSquare className="h-10 w-10" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {modoCobranca && (
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  <BellRing className="h-4 w-4 shrink-0" />
                  <span>
                    Cobrança pendente para <strong>{activeCobranca!.nome}</strong> — revise a mensagem e
                    envie para registrar no painel.
                  </span>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    Categoria: Cobrança (automática)
                  </Badge>
                </div>
              )}
              <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <Avatar className="h-9 w-9">
                  {selected.profile_pic_url && (
                    <SafeAvatarImage src={selected.profile_pic_url} alt="" />
                  )}
                  <AvatarFallback
                    className={cn(
                      'text-xs',
                      isGroupJid(selected.remote_jid)
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-emerald-100 text-emerald-700',
                    )}
                  >
                    {isGroupJid(selected.remote_jid) ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      initials(resolveName(selected))
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{resolveName(selected)}</p>
                    {isGroupJid(selected.remote_jid) && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-50"
                      >
                        Grupo
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">{chatSubtitle(selected.remote_jid)}</p>
                </div>
                <WhatsappChatCategoriaSelect
                  compact
                  value={selected.categoria}
                  disabled={salvandoCategoria}
                  onChange={handleCategoriaChange}
                />
                <Button
                  variant={showDetails ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                  title={showDetails ? 'Ocultar painel de detalhes' : 'Mostrar painel de detalhes'}
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {showDetails ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                  Detalhes
                </Button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={messagesScrollRef}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
                >
                  {loadingMsgs && (
                    <p className="text-center text-sm text-slate-400">Carregando mensagens…</p>
                  )}
                  {!loadingMsgs && mensagens.length === 0 && (
                    <p className="text-center text-sm text-slate-400">
                      {modoCobranca
                        ? 'Revise a mensagem abaixo e envie a cobrança.'
                        : 'Sem mensagens nesta conversa.'}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {mensagens.map((m: WhatsappMensagemRow) => {
                      const senderLabel =
                        groupJid && !m.from_me ? senderLabelFromMessage(m, mentionMap) : null
                      return (
                        <div
                          key={m.id}
                          className={cn('flex flex-col', m.from_me ? 'items-end' : 'items-start')}
                        >
                          {senderLabel && (
                            <span className="mb-0.5 max-w-[75%] truncate px-1 text-[10px] font-medium text-violet-600">
                              {senderLabel}
                            </span>
                          )}
                          <WhatsappMessageBubble
                            message={m}
                            remoteJid={selected.remote_jid}
                            mentionMap={mentionMap}
                            onReact={modoCobranca ? undefined : handleReact}
                          />
                        </div>
                      )
                    })}
                    <div aria-hidden className="h-px shrink-0" />
                  </div>
                </div>

                <WhatsappComposerResizeHandle
                  onPointerDown={onHandlePointerDown}
                  onDoubleClickReset={resetComposerHeight}
                />

                <WhatsappComposer
                  panelHeight={composerHeight}
                  texto={texto}
                  onTextoChange={setTexto}
                  onSendText={handleSend}
                  onSendAudio={handleSendAudio}
                  onSendFile={handleSendFile}
                  enviando={enviando}
                  modoCobranca={modoCobranca}
                  placeholder={
                    modoCobranca ? 'Edite a mensagem de cobrança…' : 'Digite uma mensagem…'
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* Coluna 3 — Detalhes do cliente */}
        {selected && showDetails && (
          <div className="flex w-[280px] shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Detalhes da conversa
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-5 p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Avatar className="h-16 w-16">
                    {selected.profile_pic_url && (
                    <SafeAvatarImage src={selected.profile_pic_url} alt="" />
                  )}
                    <AvatarFallback
                      className={cn(
                        'text-lg',
                        isGroupJid(selected.remote_jid)
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-emerald-100 text-emerald-700',
                      )}
                    >
                      {isGroupJid(selected.remote_jid) ? (
                        <Users className="h-6 w-6" />
                      ) : (
                        initials(
                          pickContactLabel(cliente?.pessoa_nome, cliente?.cliente, cliente?.grupo_cliente) ||
                            resolveName(selected),
                        )
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{resolveName(selected)}</p>
                    {isGroupJid(selected.remote_jid) ? (
                      <p className="text-xs text-slate-400">Grupo WhatsApp</p>
                    ) : (
                      cliente?.grupo_cliente && (
                        <p className="text-xs text-slate-400">{cliente.grupo_cliente}</p>
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                  <WhatsappChatCategoriaSelect
                    value={selected.categoria}
                    disabled={salvandoCategoria}
                    showHint
                    onChange={handleCategoriaChange}
                  />
                </div>

                {/* Contato / Grupo */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {isGroupJid(selected.remote_jid) ? 'Grupo' : 'Contato'}
                  </h4>
                  {isGroupJid(selected.remote_jid) ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Users className="h-4 w-4 text-violet-500" />
                        <span className="truncate">{resolveName(selected)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">ID: {groupIdFromJid(selected.remote_jid)}</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span>{telefoneExibicao}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{cliente?.pessoa_email || 'Não informado'}</span>
                      </div>
                    </>
                  )}
                </div>

                {isGroupJid(selected.remote_jid) && (
                  <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 text-[11px] text-violet-800">
                    Conversa de grupo. Cobrança individual e vínculo com títulos não se aplicam aqui.
                  </div>
                )}

                {isGroupJid(selected.remote_jid) && (
                  <WhatsappGroupMembers members={resolvedMembers} loading={loadingMembers} />
                )}

                {/* Resumo financeiro — apenas contatos individuais */}
                {!isGroupJid(selected.remote_jid) && (
                <>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Resumo financeiro
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5">
                      <p className="text-[10px] uppercase text-rose-400">Vencido</p>
                      <p className="text-sm font-semibold text-rose-600">{formatCurrency(totalVencido)}</p>
                      <p className="text-[10px] text-rose-400">{vencidos.length} título(s)</p>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                      <p className="text-[10px] uppercase text-amber-500">A vencer</p>
                      <p className="text-sm font-semibold text-amber-600">{formatCurrency(totalAVencer)}</p>
                      <p className="text-[10px] text-amber-500">{aVencer.length} título(s)</p>
                    </div>
                  </div>
                  {ultimaCobranca && (
                    <p className="text-[11px] text-slate-400">
                      Última cobrança: {formatDiaHora(ultimaCobranca)}
                    </p>
                  )}
                </div>

                {/* Sem vínculo */}
                {!numeroConversa && (
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-200 py-6 text-center text-slate-400">
                    <Wallet className="h-6 w-6" />
                    <p className="text-xs">Número oculto (privacidade): não é possível vincular títulos.</p>
                  </div>
                )}
                {numeroConversa && titulos.length === 0 && (
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-200 py-6 text-center text-slate-400">
                    <Wallet className="h-6 w-6" />
                    <p className="text-xs">Sem títulos em aberto vinculados a este número.</p>
                  </div>
                )}

                {/* Vencidos */}
                {vencidos.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-500">
                      Vencidos
                      <span className="text-[10px] font-normal text-slate-400">{vencidos.length}</span>
                    </h4>
                    {vencidos.map((t) => (
                      <TituloCard key={t.parcela_id} titulo={t} onCobrar={handleCobrarParcela} />
                    ))}
                  </div>
                )}

                {/* A vencer */}
                {aVencer.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-500">
                      A vencer
                      <span className="text-[10px] font-normal text-slate-400">{aVencer.length}</span>
                    </h4>
                    {aVencer.map((t) => (
                      <TituloCard key={t.parcela_id} titulo={t} onCobrar={handleCobrarParcela} />
                    ))}
                  </div>
                )}
                </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
