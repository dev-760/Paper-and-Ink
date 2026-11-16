import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { buildSafeClientDefine, buildSharedAliases } from '../packages/viteShared.ts';

const rootDir = path.resolve(import.meta.dirname, '..');

export default defineConfig(({ command }) => ({
  define: buildSafeClientDefine(rootDir, { isServe: command === 'serve' }),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      ...buildSharedAliases(rootDir),
    },
    dedupe: ['react', 'react-dom', 'lucide-react', '@supabase/supabase-js'],
  },
  server: {
    port: 5174,
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
}));
