import { basename } from 'node:path';

export default function renameHtml() {
  return {
    name: 'vite-plugin-rename-html',
    apply: 'build',
    enforce: 'post',

    generateBundle(_, bundle) {
      for (const key in bundle) {
        if (key.endsWith('.html')) {
          bundle[key].fileName = basename(key);
        }
      }
    },
  }
}
