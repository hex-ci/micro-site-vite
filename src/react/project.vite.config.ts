import { mergeConfig, type UserConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

export default function viteConfig(defaultConfig: UserConfig) {
  if (defaultConfig.plugins) {
    defaultConfig.plugins = defaultConfig.plugins.filter((item) => (item as Plugin).name !== 'vite:vue-jsx' && (item as Plugin).name !== 'vite:vue');
  }

  return mergeConfig(defaultConfig, {
    plugins: [react()],
  });
}
