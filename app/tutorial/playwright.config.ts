/** Gera as telas dos vídeos do tutorial: npx playwright test -c tutorial (com CRADS_TUTORIAL_DIR). */
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// No ambiente de nuvem o Chromium já vem instalado (a pasta muda com a versão).
const chromiumLocal = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((c) => existsSync(c)) ?? '';

export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  workers: 1,
  globalSetup: './preparar.ts',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 5'],
    locale: 'pt-BR',
    launchOptions: chromiumLocal ? { executablePath: chromiumLocal } : {},
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', cwd: '..', port: 4173, reuseExistingServer: true },
});
