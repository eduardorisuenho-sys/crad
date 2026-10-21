/* Vídeos de ajuda guardados no celular (tela Ajuda -> "Guardar para ver sem
   internet"): entrega do Cache Storage, em pedaços (Range), como o player pede.
   Vídeo não guardado vem da internet, sem guardar sozinho (não enche o celular). */
const CACHE_VIDEOS = 'videos-ajuda';

async function videoGuardado(pedido) {
  const cache = await caches.open(CACHE_VIDEOS);
  const guardado = await cache.match(new URL(pedido.url).pathname);
  if (!guardado) return fetch(pedido);
  const faixa = /bytes=(\d*)-(\d*)/.exec(pedido.headers.get('range') || '');
  if (!faixa) return guardado;
  const corpo = await guardado.blob();
  const ini = faixa[1] ? Number(faixa[1]) : Math.max(0, corpo.size - Number(faixa[2]));
  const fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), corpo.size - 1) : corpo.size - 1;
  return new Response(corpo.slice(ini, fim + 1), {
    status: 206,
    headers: {
      'Content-Type': guardado.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${ini}-${fim}/${corpo.size}`,
      'Content-Length': String(fim - ini + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method === 'GET' && url.origin === self.location.origin && /^\/ajuda\/[^/]+\.mp4$/.test(url.pathname)) {
    evento.respondWith(videoGuardado(evento.request));
  }
});
