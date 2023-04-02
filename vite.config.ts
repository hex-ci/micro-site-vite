import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

import serverConfig from './server/config/index.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@normal': fileURLToPath(new URL(`./src/${serverConfig.normalUrlPrefix}`, import.meta.url)),
      '@ssr': fileURLToPath(new URL(`./src/${serverConfig.ssrUrlPrefix}`, import.meta.url)),
      '@static': fileURLToPath(new URL(`./src/static`, import.meta.url)),
    }
  },
  publicDir: false
})
