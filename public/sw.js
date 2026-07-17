// Service worker do Oslo (PWA). Recebe pushes e trata o clique na notificação.
// Sem cache/offline por ora — o foco é notificação e instalação na home.

self.addEventListener('install', () => {
  // Ativa a nova versão imediatamente, sem esperar abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Oslo', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Oslo';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge.png',
    tag: data.tag,
    // Reexibe/atualiza uma notificação de mesmo tag em vez de acumular.
    renotify: Boolean(data.tag),
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se já há uma aba do app aberta, foca nela e navega para o destino.
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(destino).catch(() => {});
            return undefined;
          }
        }
        return self.clients.openWindow(destino);
      }),
  );
});
