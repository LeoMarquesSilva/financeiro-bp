import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
// @deno-types="npm:@types/web-push@3"
import webpush from 'npm:web-push@3'

export interface WhatsappPushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

function previewBody(texto: string | null | undefined): string {
  const t = (texto ?? '').trim()
  if (!t) return 'Nova mensagem recebida'
  return t.length > 120 ? `${t.slice(0, 120)}…` : t
}

export function buildWhatsappPushPayload(
  conteudo: string | null | undefined,
  remoteJid?: string,
  senderName?: string | null,
): WhatsappPushPayload {
  const title = senderName?.trim()
    ? `WhatsApp — ${senderName.trim()}`
    : 'Nova mensagem no WhatsApp'
  return {
    title,
    body: previewBody(conteudo),
    url: '/financeiro/cobranca',
    tag: remoteJid ? `wa-${remoteJid}` : 'whatsapp',
  }
}

/** Envia Web Push para todas as inscrições ativas (somente usuários admin/financeiro se inscreveram). */
export async function sendWhatsappPushToSubscribers(
  supabase: SupabaseClient,
  payload: WhatsappPushPayload,
): Promise<void> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return

  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:financeiro@bpplaw.com.br'
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  if (error || !subs?.length) return

  const body = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        )
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }),
  )
}
