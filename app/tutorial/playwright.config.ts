/** Gera as telas dos vídeos do tutorial: npx playwright test -c tutorial (com CRADS_TUTORIAL_DIR). */
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromiumLocal = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  workers: 1,
  globalSetup: './preparar.ts',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 5'],
    locale: 'pt-BR',
    launchOptions: existsSync(chromiumLocal) ? { executablePath: chromiumLocal } : {},
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', cwd: '..', port: 4173, reuseExistingServer: true },
});
