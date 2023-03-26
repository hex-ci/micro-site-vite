// 线上用的配置文件，勿动！

const path = require('path');

module.exports = {
  // 服务器端口
  port: 5173,

  // 服务器绑定地址
  host: '0.0.0.0',

  // api 的 bese url
  baseUrl: 'http://domain.com',

  // 首页使用的项目，只能是 SSR 项目
  defaultProject: 'hello/world',

  ssrUrlPrefix: 'ssr',

  // site 文件位置
  sitePath: path.resolve(__dirname, '../../site'),

  // ssr 文件位置
  ssrPath: path.resolve(__dirname, '../../ssr'),

  // static 文件位置
  staticPath: path.resolve(__dirname, '../../static')
};
