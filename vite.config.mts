import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const packageVersion = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          if (id.includes('framer-motion')) return 'motion-vendor'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor'
          if (id.includes('@tauri-apps')) return 'tauri-vendor'
          return 'vendor'
        },
      },
    },
  },
  base: './', // Recommended for Tauri to load assets correctly in production
})
