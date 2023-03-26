import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// import vueJsx from '@vitejs/plugin-vue-jsx'
import react from '@vitejs/plugin-react'

const virtualHtmlTemplatePlugin = () => {
  return {
    name: 'vite-plugin-micro-site',

    generateBundle(_, bundle) {
      // bundle['src/site/react/index.html'].fileName = 'index.html';
      bundle['src/site/vue/index.html'].fileName = 'index.html';
    }
  }
}

const prod = process.env.NODE_ENV === 'production';


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), react(), {
    ...virtualHtmlTemplatePlugin(),
    apply: 'build',
    enforce: 'post',
  }],
  resolve: {
    alias: {
      '@site': fileURLToPath(new URL('./src/site', import.meta.url)),
      '@ssr': fileURLToPath(new URL('./src/ssr', import.meta.url)),
    }
  },
  // base: 'https://domain.com/site/react/',
  // base: 'https://domain.com/site/vue/',
  base: prod ? 'https://domain.com/site/vue/' : '/',
  publicDir: false,
  build: {
    // outDir: 'dist/site/react',
    outDir: 'dist/site/vue',
    rollupOptions: {
      // input: 'src/site/react/index.html',
      input: 'src/site/vue/index.html',
    }
  }
})
