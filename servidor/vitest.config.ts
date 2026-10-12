import { defineConfig } from 'vitest/config';

// Cada arquivo de teste sobe um PocketBase de verdade; em máquina lenta isso passa de 10 s.
export default defineConfig({ test: { hookTimeout: 60_000, testTimeout: 30_000 } });
