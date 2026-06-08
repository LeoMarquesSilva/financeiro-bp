/* Service worker — notificações push do WhatsApp (SIOE) */

self.addEventListener('push', (event) => {
  let payload = { title: 'Nova mensagem no WhatsApp', body: 'Você recebeu uma mensagem', url: '/financeiro/cobranca', tag: 'whatsapp' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // usa defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/fenix.png',
      badge: '/fenix.png',
      tag: payload.tag ?? 'whatsapp',
      data: { url: payload.url ?? '/financeiro/cobranca' },
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/financeiro/cobranca'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
