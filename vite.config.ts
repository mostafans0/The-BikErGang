import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Vite + React + Tailwind v4 config for the React Router SPA.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Pre-bundle the heavy 3D libraries at server start so the Fitting Room's
  // lazy chunk doesn't race Vite's on-demand dependency optimizer.
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', '@mediapipe/tasks-vision'],
  },
})
