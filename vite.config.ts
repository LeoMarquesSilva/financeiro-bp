import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Build browser-friendly (evita fs/stream do Node no Vite).
      exceljs: path.resolve(__dirname, 'node_modules/exceljs/dist/exceljs.min.js'),
    },
  },
  optimizeDeps: {
    entries: ['src/main.tsx'],
    holdUntilCrawlEnd: true,
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      'react-router-dom',
      '@tanstack/react-query',
      'sonner',
      'exceljs',
    ],
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
  },
})
