/**
 * Guardar vídeos no celular para ver sem internet. O vídeo inteiro vai para o
 * Cache Storage; o service worker (vite.config.ts) entrega dali, em pedaços,
 * quando o player pede (sem sinal ou não).
 */
export const CACHE_VIDEOS = 'videos-ajuda';

const disponivel = () => typeof caches !== 'undefined';

export async function videosGuardados(): Promise<Set<string>> {
  if (!disponivel()) return new Set();
  try {
    const c = await caches.open(CACHE_VIDEOS);
    return new Set((await c.keys()).map((r) => new URL(r.url).pathname));
  } catch {
    return new Set();
  }
}

export async function guardarVideo(caminho: string): Promise<void> {
  if (!disponivel()) throw new Error('Este navegador não guarda vídeos.');
  const resposta = await fetch(caminho);
  if (!resposta.ok) throw new Error('Não foi possível baixar o vídeo. Verifique a internet.');
  const c = await caches.open(CACHE_VIDEOS);
  await c.put(caminho, resposta);
}

export async function apagarVideo(caminho: string): Promise<void> {
  if (!disponivel()) return;
  const c = await caches.open(CACHE_VIDEOS);
  await c.delete(caminho);
}
