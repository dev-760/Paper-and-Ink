import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { buildSafeClientDefine, buildSharedAliases } from '../packages/viteShared.ts';

const rootDir = path.resolve(import.meta.dirname, '..');

export default defineConfig(({ command }) => ({
  define: buildSafeClientDefine(rootDir, { isServe: command === 'serve' }),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      ...buildSharedAliases(rootDir),
    },
    dedupe: ['react', 'react-dom', 'lucide-react', '@supabase/supabase-js'],
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png'],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'Paper & Ink Reader',
        short_name: 'Paper & Ink',
        description: 'Warm, physical-inspired library and tactile long-form reader.',
        theme_color: '#F6EFE4',
        background_color: '#F6EFE4',
        display: 'standalone',
        icons: [
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
}));
