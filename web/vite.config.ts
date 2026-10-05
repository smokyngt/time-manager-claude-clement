import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const target = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        background_color: '#f8f9fb',
        categories: ['productivity'],
        description: 'Clock in, track your hours and manage your teams.',
        display: 'standalone',
        icons: [
          { purpose: 'any', sizes: '192x192', src: '/icons/icon-192.png', type: 'image/png' },
          { purpose: 'any', sizes: '512x512', src: '/icons/icon-512.png', type: 'image/png' },
          {
            purpose: 'maskable',
            sizes: '512x512',
            src: '/icons/maskable-512.png',
            type: 'image/png',
          },
        ],
        name: 'Time Manager',
        scope: '/',
        short_name: 'TimeMgr',
        start_url: '/',
        theme_color: '#4f46e5',
      },
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/v1/, /^\/docs/],
        // Never cache API responses or docs: they contain personal data.
        runtimeCaching: [
          {
            handler: 'NetworkOnly',
            urlPattern: ({ url }) => url.pathname.startsWith('/v1/'),
          },
          {
            handler: 'NetworkOnly',
            urlPattern: ({ url }) => url.pathname.startsWith('/docs'),
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@time-manager/sdk': path.resolve(import.meta.dirname, '../sdks/typescript/src/index.ts'),
    },
  },
  server: {
    fs: { allow: ['..'] },
    host: true,
    port: 5173,
    proxy: {
      '/docs': target,
      '/v1': target,
    },
  },
  test: {
    css: false,
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
