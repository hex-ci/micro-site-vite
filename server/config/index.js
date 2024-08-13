// 线上用的配置文件，勿动！

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routes } from './router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  // 服务器端口
  port: 3000,

  // 服务器绑定地址
  host: '0.0.0.0',

  // 资源不使用 OSS 的话，需要配置
  resUrlPrefix: 'res',

  // 项目文件位置
  projectPath: resolve(__dirname, '../../project'),

  // public 文件位置
  publicPath: resolve(__dirname, '../../public'),

  // 资源文件位置（不使用 OSS 才需要）
  resPath: resolve(__dirname, '../../res'),

  // 路由配置
  routes,
};
