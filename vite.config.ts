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

  return {
    base: '/txobank/',
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
