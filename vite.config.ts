import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_secret_')) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY contiene una clave secreta (sb_secret_...). ' +
        'La clave secreta nunca debe ir en el navegador: usa la clave publicable (sb_publishable_...).',
    )
  }

  // Versión que se muestra en el inicio de sesión y en Ajustes → Acerca de.
  const version = (JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }).version
  const commit = (() => {
    if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
    try {
      return execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      return 'local'
    }
  })()

  return {
    base: '/txobank/',
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __APP_COMMIT__: JSON.stringify(commit),
      __APP_FECHA_BUILD__: JSON.stringify(new Date().toISOString()),
    },
    build: { chunkSizeWarningLimit: 700 },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
        manifest: {
          name: 'TxoBank',
          short_name: 'TxoBank',
          description: 'Control del gasto mensual',
          lang: 'es-ES',
          start_url: '/txobank/',
          scope: '/txobank/',
          display: 'standalone',
          background_color: '#F3F7F5',
          theme_color: '#0B8A64',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    test: { include: ['src/**/*.test.ts'] },
  }
})
