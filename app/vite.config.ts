import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Versão mostrada em Ajustes: o commit do build (Cloudflare informa; localmente, o git).
function versao(): string {
  const env = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'local';
  }
}

// Prévia do link (WhatsApp): og:image e og:url precisam do endereço completo do app.
// Sem VITE_APP_URL no build, essas duas linhas saem (o resto da prévia continua).
function enderecoNaPrevia(): Plugin {
  const url = (process.env.VITE_APP_URL ?? '').replace(/\/$/, '');
  return {
    name: 'endereco-na-previa',
    transformIndexHtml: (html) => (url ? html.replaceAll('%URL_DO_APP%', url) : html.replace(/\s*<meta property="og:(url|image)" content="%URL_DO_APP%[^"]*" \/>/g, '')),
  };
}

export default defineConfig({
  define: { __VERSAO__: JSON.stringify(versao()), __DATA_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: [
    enderecoNaPrevia(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icones/*.png', 'marca/*.png'],
      manifest: {
        name: 'CRAD — Mudas Nativas',
        short_name: 'CRAD',
        description: 'Da árvore matriz ao plantio: matrizes, sementes, viveiro, doação e pós-plantio.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icones/icone-512-mascara.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // O app inteiro fica guardado no aparelho e abre sem internet.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}', 'ajuda/*.jpg'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Avisos com o app fechado (Web Push).
        // e vídeos de ajuda guardados para ver sem internet (antes das rotas do Workbox).
        importScripts: ['sw-push.js', 'sw-videos.js'],
        // Fotos do catálogo ficam guardadas para abrir sem internet.
        runtimeCaching: [
          {
            // Mapa de fundo da rota de coleta: os pedaços já vistos ficam no aparelho para usar sem internet.
            urlPattern: ({ url }) => url.hostname === 'server.arcgisonline.com',
            handler: 'CacheFirst',
            options: { cacheName: 'mapa-hibrido', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 180 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/files/especie_foto/'),
            handler: 'CacheFirst',
            options: { cacheName: 'fotos-catalogo', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 120 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
});
