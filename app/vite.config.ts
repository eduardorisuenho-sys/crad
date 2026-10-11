import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Fotos do catálogo ficam guardadas para abrir sem internet.
        runtimeCaching: [
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
