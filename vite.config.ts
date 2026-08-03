/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Build stamp baked into the bundle (telemetry context + lobby footer):
// pkg.version + git short hash + build date, e.g. "2.0.0+c3e8b77+20260731".
// Playtesters read it back to us; telemetry rows carry it so a crash can be
// matched to the exact deploy.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};
let gitHash = 'unknown';
try {
  gitHash = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
} catch {
  // No git (e.g. a bare CI checkout) — 'unknown' still versions the build by date.
}
const buildDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const appVersion = `${pkg.version}+${gitHash}+${buildDate}`;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      // Custom SW (src/sw.ts): precache + the push/notificationclick handlers
      // that generateSW can't express.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt' + manual registration (src/services/swUpdate.ts): autoUpdate
      // left a returning player on the previous build until some later
      // refresh, so playtest bugs got filed against a build we'd already
      // fixed. The injected registration has nowhere to hand the callback.
      registerType: 'prompt',
      injectRegister: null,
      // Keep the plugin out of vitest runs.
      disable: !!process.env.VITEST,
      injectManifest: {
        // Default is js/css/html only; include icons + sounds so the
        // game is fully playable (and audible) offline. `glb` covers the
        // robot meshes the 3D board loads — without it they'd silently miss
        // the precache and the board would come up empty offline.
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,glb}'],
      },
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
