import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA as vitePwa } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vitePwa({
    registerType: 'auto-update',
    includeAssets: ['favicon.png', 'robots.txt', 'apple-touch-icon.png'],
    manifest: {
      name: 'LIKHA-SIS',
      short_name: 'LIKHA-SIS',
      description: 'Learner Information & Knowledge Hub for Academic Systems',
      theme_color: '#1A2F5F',
      background_color: '#F2A93B',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: 'icons/pwa/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'icons/pwa/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'icons/pwa/icon-512x512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    },
    workbox: {
      // Default runtime caching for images and CSS
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\./,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'images',
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 30 // <== 30 days
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
    }
  })],
})
