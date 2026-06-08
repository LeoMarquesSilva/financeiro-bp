import { supabase } from '@/lib/supabaseClient'

const PUSH_ENABLED_KEY = 'whatsapp_push_enabled'
const SW_PATH = '/sw.js'

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64Safe)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function getPushPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as PushPermissionState
}

export function isPushEnabledLocally(): boolean {
  try {
    return localStorage.getItem(PUSH_ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

function setPushEnabledLocally(enabled: boolean): void {
  try {
    localStorage.setItem(PUSH_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_PATH)
  } catch {
    return null
  }
}

function previewBody(texto: string | null): string {
  const t = (texto ?? '').trim()
  if (!t) return 'Nova mensagem recebida'
  return t.length > 120 ? `${t.slice(0, 120)}…` : t
}

/** Notificação nativa do navegador (aba em segundo plano, sem Web Push configurado). */
export function showBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void,
  tag?: string,
): void {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      icon: '/fenix.png',
      tag: tag ?? 'whatsapp',
    })
    n.onclick = () => {
      window.focus()
      n.close()
      onClick?.()
    }
  } catch {
    // ignore
  }
}

export function showWhatsappBrowserNotification(
  conteudo: string | null,
  onClick?: () => void,
  remoteJid?: string,
): void {
  showBrowserNotification(
    'Nova mensagem no WhatsApp',
    previewBody(conteudo),
    onClick,
    remoteJid ? `wa-${remoteJid}` : 'whatsapp',
  )
}

export async function enableWhatsappPush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: 'Seu navegador não suporta notificações push.' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'Permissão de notificação negada.' }
  }

  const registration = await registerServiceWorker()
  if (!registration) {
    return { ok: false, reason: 'Não foi possível registrar o service worker.' }
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (vapidPublicKey?.trim()) {
    await subscribeWebPush(registration, vapidPublicKey.trim())
  }

  setPushEnabledLocally(true)
  return { ok: true }
}

async function subscribeWebPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<void> {
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) return

  const { error } = await supabase.functions.invoke('push-subscribe', {
    body: { endpoint, p256dh, auth },
  })
  if (error) throw error
}

export async function disableWhatsappPush(): Promise<void> {
  setPushEnabledLocally(false)
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await supabase.functions.invoke('push-subscribe', {
        body: { action: 'unsubscribe', endpoint },
      })
    }
  } catch {
    // ignore
  }
}

/** Reativa inscrição push após login (se o usuário já havia habilitado). */
export async function ensureWhatsappPushSubscription(): Promise<void> {
  if (!isPushSupported()) return
  if (!isPushEnabledLocally()) return
  if (Notification.permission !== 'granted') return

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapidPublicKey?.trim()) return

  const registration = await registerServiceWorker()
  if (!registration) return

  try {
    await subscribeWebPush(registration, vapidPublicKey.trim())
  } catch {
    // falha silenciosa — toast/som continuam funcionando
  }
}
