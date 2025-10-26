import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath, URL } from 'url' // <-- ADD THIS IMPORT

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // THIS IS THE FIX FOR __dirname
      "@": path.resolve(fileURLToPath(new URL('.', import.meta.url)), "src"),
    },
  },
}) // <-- EXTRA PARENTHESES REMOVED