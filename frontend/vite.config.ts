import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    // Node environment is enough for domain/pure-logic tests.
    // A DOM environment will be added when component tests are actually needed.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
    restoreMocks: true,
  },
})
