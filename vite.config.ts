import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueJsx from '@vitejs/plugin-vue-jsx'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), react()],
  resolve: {
    alias: {
      '@site': fileURLToPath(new URL('./src/site', import.meta.url)),
      '@ssr': fileURLToPath(new URL('./src/ssr', import.meta.url)),
    }
  },
  base: '/',
  publicDir: false
})
