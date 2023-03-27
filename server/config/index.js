// 线上用的配置文件，勿动！

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  normalUrlPrefix: 'site',

  // SSR 项目前缀，会影响 URL 和文件存储，慎重修改
  ssrUrlPrefix: 'ssr',

  // 项目文件位置
  projectPath: path.resolve(__dirname, '../..'),

  // public 文件位置
  publicPath: path.resolve(__dirname, '../../public'),

  assetsPath: path.resolve(__dirname, '../../assets')
};
