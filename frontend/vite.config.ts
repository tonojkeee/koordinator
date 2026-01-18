import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom', 'zustand', '@tanstack/react-query', 'axios', 'i18next'],
          'charts': ['recharts'],
          'exceljs': ['exceljs'],
          'mammoth': ['mammoth'],
          'ui-libs': ['emoji-picker-react', 'lucide-react'],
        },
      },
    },
  },
})
