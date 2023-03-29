import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueJsx from '@vitejs/plugin-vue-jsx'
import react from '@vitejs/plugin-react'

import serverConfig from './server/config/index.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), react()],
  resolve: {
    alias: {
      '@normal': fileURLToPath(new URL(`./src/${serverConfig.normalUrlPrefix}`, import.meta.url)),
      '@ssr': fileURLToPath(new URL(`./src/${serverConfig.ssrUrlPrefix}`, import.meta.url))
    }
  },
  base: '/',
  publicDir: false
})
