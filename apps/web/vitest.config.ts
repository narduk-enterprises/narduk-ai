import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#server': resolve(__dirname, './server'),
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './app'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
