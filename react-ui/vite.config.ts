import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../js/react-app',
    emptyOutDir: true,
    cssCodeSplit: false, // Force single CSS file
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app-[name].js',
        assetFileNames: 'app.[ext]',
        format: 'iife', // Use IIFE for Drupal compatibility
        inlineDynamicImports: true, // Bundle everything in one file
      },
    },
  },
})
