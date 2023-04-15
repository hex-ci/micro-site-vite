// 线上用的配置文件，勿动！

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  // 服务器端口
  port: 3000,

  // 服务器绑定地址
  host: '0.0.0.0',

  // api 的 bese url
  baseApiUrl: 'http://domain.com',

  // 首页使用的项目，只能是 SSR 项目
  homeProject: 'home',

  // 常规项目前缀，会影响 URL 和文件存储，慎重修改
  normalFolderPrefix: 'site',

  // SSR 项目前缀，会影响 URL 和文件存储，慎重修改
  ssrFolderPrefix: 'ssr',

  // 资源不使用 OSS 的话，需要配置
  resUrlPrefix: 'res',

  // 项目文件位置
  projectPath: resolve(__dirname, '../..'),

  // public 文件位置
  publicPath: resolve(__dirname, '../../public'),

  // 资源文件位置（不使用 OSS 才需要）
  resPath: resolve(__dirname, '../../res')
};
