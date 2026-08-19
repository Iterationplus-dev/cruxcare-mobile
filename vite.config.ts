/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    legacy()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // The local Capacitor plugin is consumed straight from source: npm only
      // needs to link it so `cap sync` finds the native module, and this keeps
      // Vite/vue-tsc/vitest off a separate build step for it.
      '@cruxcare/capacitor-monnify': path.resolve(
        __dirname,
        './packages/capacitor-monnify/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  }
})
