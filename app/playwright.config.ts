import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// No ambiente de nuvem o Chromium já vem instalado nesta pasta.
const chromiumLocal = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  globalSetup: './e2e/preparar.ts',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 5'],
    locale: 'pt-BR',
    launchOptions: existsSync(chromiumLocal) ? { executablePath: chromiumLocal } : {},
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
});
