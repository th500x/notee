/* 07-coin-index · 仅 Web Push，不拦截 fetch（避免把站点缓存脏） */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'ETH 均线信号'
  const options = {
    body: data.body || '',
    data: { url: data.url || '/07-coin-index/' },
    tag: data.tag || 'eth-ma-cross',
    renotify: true,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/07-coin-index/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => String(client.url || '').includes('/07-coin-index'))
      if (existing) {
        if (typeof existing.navigate === 'function') {
          return existing.navigate(url).then((client) => (client && client.focus ? client.focus() : existing.focus()))
        }
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
