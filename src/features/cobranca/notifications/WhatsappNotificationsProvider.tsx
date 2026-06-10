import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/AuthContext'
import { whatsappService } from '../services/whatsappService'
import { playNotificationSound } from '../utils/sound'
import {
  ensureWhatsappPushSubscription,
  getPushPermissionState,
  isPushEnabledLocally,
  showWhatsappBrowserNotification,
} from '../utils/pushNotifications'
import type { WhatsappMensagemRow } from '@/lib/database.types'

interface WhatsappNotificationsValue {
  /** Soma de mensagens não lidas (badge da aba WhatsApp). */
  unreadTotal: number
  /** Conversas com unread_count > 0 (filtro "Não lidas"). */
  unreadChats: number
  refreshUnread: () => void
}

const WhatsappNotificationsContext = createContext<WhatsappNotificationsValue>({
  unreadTotal: 0,
  unreadChats: 0,
  refreshUnread: () => {},
})

export function useWhatsappNotifications(): WhatsappNotificationsValue {
  return useContext(WhatsappNotificationsContext)
}

// Janela (ms) para considerar uma mensagem como "nova" e notificar.
// Evita disparar avisos durante o backfill (sincronização de histórico antigo).
const JANELA_NOVA_MS = 2 * 60 * 1000
// Intervalo mínimo entre sons, para não estourar em rajada de mensagens.
const THROTTLE_SOM_MS = 3000

function previewTexto(texto: string | null): string {
  const t = (texto ?? '').trim()
  if (!t) return 'Nova mensagem recebida'
  return t.length > 90 ? `${t.slice(0, 90)}…` : t
}

export function WhatsappNotificationsProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const enabled = role === 'admin' || role === 'financeiro'

  const [unreadTotal, setUnreadTotal] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const ultimoSomRef = useRef(0)

  const unreadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshUnread = useCallback(() => {
    if (!enabled) return
    if (unreadDebounceRef.current) clearTimeout(unreadDebounceRef.current)
    unreadDebounceRef.current = setTimeout(() => {
      whatsappService
        .getUnreadCounts()
        .then(({ total, chats }) => {
          setUnreadTotal(total)
          setUnreadChats(chats)
        })
        .catch(() => {})
    }, 1500)
  }, [enabled])

  useEffect(() => {
    refreshUnread()
  }, [refreshUnread])

  // Reativa inscrição Web Push após login (se o usuário já havia habilitado).
  useEffect(() => {
    if (!enabled) return
    void ensureWhatsappPushSubscription()
  }, [enabled])

  // Atualiza o total de não lidas quando as conversas mudam.
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('wa_notif_chats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chats' },
        () => refreshUnread(),
      )
      .subscribe()
    return () => {
      if (unreadDebounceRef.current) clearTimeout(unreadDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [enabled, refreshUnread])

  // Avisa (toast + som) quando chega mensagem nova de cliente (from_me=false).
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('wa_notif_msgs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_mensagens',
          filter: 'from_me=eq.false',
        },
        (payload) => {
          const msg = payload.new as WhatsappMensagemRow
          // Ignora histórico antigo trazido pelo sync.
          if (msg.timestamp) {
            const idade = Date.now() - new Date(msg.timestamp).getTime()
            if (Number.isFinite(idade) && idade > JANELA_NOVA_MS) return
          }

          const agora = Date.now()
          if (agora - ultimoSomRef.current > THROTTLE_SOM_MS) {
            ultimoSomRef.current = agora
            playNotificationSound()
          }

          const openCobranca = () => navigate('/financeiro/cobranca')

          if (document.hidden) {
            // Aba em segundo plano: notificação nativa (se push Web não estiver ativo).
            if (!isPushEnabledLocally() || getPushPermissionState() !== 'granted') {
              showWhatsappBrowserNotification(msg.conteudo, openCobranca, msg.remote_jid)
            }
          } else {
            toast.message('Nova mensagem no WhatsApp', {
              description: previewTexto(msg.conteudo),
              icon: <MessageCircle className="h-4 w-4 text-emerald-600" />,
              action: {
                label: 'Abrir',
                onClick: openCobranca,
              },
            })
          }

          refreshUnread()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, navigate, refreshUnread])

  return (
    <WhatsappNotificationsContext.Provider value={{ unreadTotal, unreadChats, refreshUnread }}>
      {children}
    </WhatsappNotificationsContext.Provider>
  )
}
