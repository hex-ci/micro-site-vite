import { mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default function myViteConfig(defaultConfig) {
  defaultConfig.plugins = defaultConfig.plugins.filter((item) => item.name !== 'vite:vue-jsx' && item.name !== 'vite:vue');

  return mergeConfig(defaultConfig, {
    plugins: [react()]
  });
}
