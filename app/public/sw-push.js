/* Avisos com o app fechado (Web Push): mostra a notificação do celular (com o
   som do próprio aparelho) e, ao tocar, abre a tela certa do app. */
self.addEventListener('push', (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch (e) {
    d = { titulo: 'CRAD', texto: evento.data ? evento.data.text() : '' };
  }
  evento.waitUntil(
    self.registration.showNotification(d.titulo || 'CRAD', {
      body: d.texto || '',
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      tag: d.titulo || 'crad',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { rota: d.rota || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.rota) || '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ('navigate' in j) return j.focus().then(() => j.navigate(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
