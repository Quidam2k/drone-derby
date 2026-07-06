/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Custom SW (src/sw.ts): precache + the push/notificationclick handlers
      // that generateSW can't express.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Keep the plugin out of vitest runs.
      disable: !!process.env.VITEST,
      manifest: {
        name: 'Drone Derby',
        short_name: 'Drone Derby',
        description: 'Program your robot. Survive the factory. Beat your friends.',
        display: 'standalone',
        start_url: '/',
        background_color: '#14161f',
        theme_color: '#14161f',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
